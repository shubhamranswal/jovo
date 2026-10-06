/**
 * Unit tests for Chrome Extension ATS Adapters, Field Mapping, and Capture Logic
 * Run with: node tests/extension.test.mjs
 */

import assert from "node:assert";
import { JSDOM } from "jsdom";
import { resolveAdapter } from "../src/content/adapters/index.ts";
import { autofillSafeFields } from "../src/content/autofill.ts";
import { assembleApplicationPayload } from "../src/content/capture.ts";

console.log("Running Chrome Extension Unit Tests...");

// 1. Test Workday Adapter Detection & Extraction
{
  const workdayHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Senior Platform Engineer - Acme Cloud</title>
        <meta property="og:title" content="Senior Platform Engineer">
      </head>
      <body>
        <div data-automation-id="jobPostingHeader">
          <h1 data-automation-id="jobTitle">Senior Platform Engineer</h1>
        </div>
        <div data-automation-id="companyName">Acme Cloud</div>
        <div data-automation-id="locations">San Francisco, CA</div>
        <div data-automation-id="requisitionId">REQ-84920</div>
        <div data-automation-id="jobPostingDescription">
          We are seeking a Senior Platform Engineer to build scalable microservices.
        </div>

        <form id="applyForm">
          <input data-automation-id="legalNameSection_firstName" name="firstName" value="" />
          <input data-automation-id="legalNameSection_lastName" name="lastName" value="" />
          <input data-automation-id="email" name="email" value="" />
          <input data-automation-id="phone-number" name="phone" value="" />
          <textarea data-automation-id="whyUsQuestion" name="whyUs">Tell us why you want to join Acme Cloud.</textarea>
        </form>
      </body>
    </html>
  `;

  const dom = new JSDOM(workdayHtml, { url: "https://acme.wd1.myworkdayjobs.com/en-US/careers/job/REQ-84920" });
  const doc = dom.window.document;
  const adapter = resolveAdapter(dom.window.location.href, doc);

  assert.strictEqual(adapter.name, "Workday", "Should resolve WorkdayAdapter for workday URL");

  const jobMeta = adapter.extractJob(dom.window.location.href, doc);
  assert.strictEqual(jobMeta.title, "Senior Platform Engineer", "Job title should match");
  assert.strictEqual(jobMeta.company, "Acme Cloud", "Company extracted from URL/DOM");
  assert.strictEqual(jobMeta.location, "San Francisco, CA", "Location should match");
  assert.strictEqual(jobMeta.externalId, "REQ-84920", "Req ID should match");
  assert.strictEqual(jobMeta.isWorkday, true, "IsWorkday flag must be true");

  const fields = adapter.detectFormFields(doc);
  assert.strictEqual(fields.length, 4, "Should detect 4 safe form fields");
  assert.ok(fields.some(f => f.fieldType === "firstName"), "firstName detected");
  assert.ok(fields.some(f => f.fieldType === "email"), "email detected");

  const questions = adapter.detectQuestions(doc);
  assert.strictEqual(questions.length, 1, "Should detect 1 application question");

  console.log("✓ Workday Adapter extraction and field detection verified.");

  // Test safe autofill on Workday DOM
  const mockProfile = {
    id: "prof-123",
    user_id: "user-123",
    headline: "Alex Chen",
    location: "San Francisco, CA",
    preferences_json: {
      email: "alex.chen@example.com",
      phone: "+1-555-0199",
      linkedin: "https://linkedin.com/in/alexchen",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const autofillResult = autofillSafeFields(doc, fields, mockProfile);
  assert.strictEqual(autofillResult.filledFieldsCount, 4, "Should autofill 4 fields");
  const emailInput = doc.querySelector('[data-automation-id="email"]');
  assert.strictEqual(emailInput.value, "alex.chen@example.com", "Email value should be filled");

  console.log("✓ Safe field autofill verified.");
}

// 2. Test Generic Adapter Fallback
{
  const genericHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Staff Backend Engineer at Stripe</title>
        <meta property="og:site_name" content="Stripe">
      </head>
      <body>
        <h1>Staff Backend Engineer</h1>
        <form>
          <label for="fullName">Full Name</label>
          <input id="fullName" name="fullName" type="text" />
          <label for="emailAddr">Email Address</label>
          <input id="emailAddr" name="email" type="email" />
          <textarea id="coverLetter">Why Stripe?</textarea>
        </form>
      </body>
    </html>
  `;

  const dom = new JSDOM(genericHtml, { url: "https://stripe.com/jobs/staff-backend" });
  const doc = dom.window.document;
  const adapter = resolveAdapter(dom.window.location.href, doc);

  assert.strictEqual(adapter.name, "Generic", "Should resolve GenericAdapter");
  const job = adapter.extractJob(dom.window.location.href, doc);
  assert.strictEqual(job.title, "Staff Backend Engineer");
  assert.strictEqual(job.company, "Stripe");

  const fields = adapter.detectFormFields(doc);
  assert.strictEqual(fields.length, 2, "Detects 2 fields in generic form");
  const questions = adapter.detectQuestions(doc);
  assert.strictEqual(questions.length, 1, "Detects 1 textarea question");

  console.log("✓ Generic ATS Adapter extraction verified.");
}

// 3. Test Application Capture Assembly
{
  const capturePayload = {
    jobId: "job-999",
    company: "Acme Cloud",
    title: "Senior Platform Engineer",
    url: "https://acme.wd1.myworkdayjobs.com/job/123",
    pageTitle: "Senior Platform Engineer - Acme",
    formFields: { "First Name": "Alex", "Email": "alex@example.com" },
    rawSnippet: "Full JD text snippet for capsule freeze...",
    questions: [
      {
        questionText: "Why Acme?",
        answerText: "I want to solve large-scale distributed systems challenges.",
        source: "jobos_assistant",
        userApproved: true,
      },
    ],
    resumeVersionId: "resume-v2",
    coverLetterId: "cover-letter-v1",
  };

  const appCreate = assembleApplicationPayload(capturePayload, "user-alex-1");
  assert.strictEqual(appCreate.user_id, "user-alex-1");
  assert.strictEqual(appCreate.target_company || appCreate.company_name, "Acme Cloud");
  assert.strictEqual(appCreate.status, "Applied");
  assert.strictEqual(appCreate.initial_questions.length, 1);
  assert.strictEqual(appCreate.initial_questions[0].answer.user_approved, true);
  assert.strictEqual(appCreate.initial_documents.length, 2);
  assert.strictEqual(appCreate.initial_snapshot.job_description, "Full JD text snippet for capsule freeze...");

  console.log("✓ Application Capture payload assembly verified.");
}

// 4. Test Security Sanitization of Sensitive Fields & Non-Genuine Questions
{
  const unsafeCapturePayload = {
    jobId: "job-100",
    company: "Acme",
    title: "Engineer",
    url: "https://acme.com/apply",
    pageTitle: "Apply",
    formFields: {
      "First Name": "Alex",
      "Email": "alex@example.com",
      "Password": "super-secret-password-123",
      "SSN": "000-12-3456",
      "credit_card": "4111-1111-1111-1111",
      "csrf_token": "abcde987654",
    },
    rawSnippet: "JD",
    questions: [
      {
        questionText: "Why do you want to join our engineering team?",
        answerText: "I am passionate about systems design.",
        source: "jobos_assistant",
        userApproved: true,
      },
      {
        questionText: "Enter your password to verify your account",
        answerText: "secretpwd",
        source: "candidate_manual",
        userApproved: true,
      },
      {
        questionText: "Search our jobs",
        answerText: "python",
        source: "candidate_manual",
        userApproved: true,
      },
      {
        questionText: "What is your greatest technical achievement?",
        answerText: "Unapproved draft...",
        source: "jobos_assistant",
        userApproved: false, // NOT approved
      },
    ],
  };

  const appCreate = assembleApplicationPayload(unsafeCapturePayload, "user-1");
  const capturedFields = appCreate.initial_snapshot.extraction_metadata_json.captured_fields;

  // Verify sensitive fields are strictly excluded
  assert.strictEqual(capturedFields["Password"], undefined, "Password must never be captured");
  assert.strictEqual(capturedFields["SSN"], undefined, "SSN must never be captured");
  assert.strictEqual(capturedFields["credit_card"], undefined, "Card info must never be captured");
  assert.strictEqual(capturedFields["csrf_token"], undefined, "Tokens must never be captured");
  assert.strictEqual(capturedFields["First Name"], "Alex", "Safe field preserved");
  assert.strictEqual(capturedFields["Email"], "alex@example.com", "Safe field preserved");

  // Verify only genuine, user-approved questions are captured
  assert.strictEqual(appCreate.initial_questions.length, 1, "Only genuine approved questions captured");
  assert.strictEqual(
    appCreate.initial_questions[0].question_text,
    "Why do you want to join our engineering team?"
  );

  console.log("✓ Security sanitization & question filter verified.");
}

console.log("\nALL 4 CHROME EXTENSION UNIT TESTS PASSED!");
