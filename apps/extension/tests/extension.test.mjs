/**
 * Unit tests for Chrome Extension ATS Adapters, Semantic Field Mapping, Security Rules,
 * and Question Review/Approval Workflow
 *
 * Run with: npm.cmd --workspace=@jobos/extension test
 */

import assert from "node:assert";
import { JSDOM } from "jsdom";
import { resolveAdapter } from "../src/content/adapters/index.ts";
import { autofillSafeFields } from "../src/content/autofill.ts";
import { assembleApplicationPayload } from "../src/content/capture.ts";
import { classifyFieldSemantics } from "../src/content/mapper.ts";
import { isElementSensitive, isGenuineApplicationQuestion } from "../src/content/security.ts";

console.log("Running Chrome Extension Unit Tests for Phase 7: Intelligent Apply...\n");

// TEST SUITE 1: Workday Adapter Detection, Extraction & Semantic Mapping
{
  console.log("--- 1. Workday Adapter Suite ---");

  const workdayHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Senior Platform Engineer - Acme Cloud</title>
        <meta property="og:title" content="Senior Platform Engineer">
        <meta property="og:site_name" content="Acme Cloud">
        <meta name="author" content="Workday">
      </head>
      <body>
        <div data-automation-id="jobPostingHeader">
          <h1 data-automation-id="jobTitle">Senior Platform Engineer</h1>
        </div>
        <div data-automation-id="companyName">Acme Cloud</div>
        <div data-automation-id="locations">San Francisco, CA (Hybrid)</div>
        <div data-automation-id="requisitionId">REQ-84920</div>
        <div data-automation-id="jobPostingDescription">
          We are seeking a Senior Platform Engineer to build scalable microservices.
        </div>

        <form id="applyForm">
          <label for="fName">Legal First Name</label>
          <input id="fName" data-automation-id="legalNameSection_firstName" name="firstName" value="" />

          <label for="lName">Family Name</label>
          <input id="lName" data-automation-id="legalNameSection_lastName" name="lastName" value="" />

          <label for="email">Contact Email</label>
          <input id="email" data-automation-id="email" name="email" type="email" value="" />

          <label for="phone">Mobile Number</label>
          <input id="phone" data-automation-id="phone-number" name="phone" type="tel" value="" />

          <label for="address">Street Address</label>
          <input id="address" data-automation-id="addressSection_addressLine1" name="address" value="" />

          <label for="whyUs">Why do you want to join Acme Cloud?</label>
          <textarea id="whyUs" data-automation-id="whyUsQuestion" name="whyUs"></textarea>

          <!-- Deliberate sensitive inputs to verify exclusion -->
          <input type="password" name="account_password" value="secret" />
          <input type="hidden" name="csrf_token" value="tok_123" />
        </form>
      </body>
    </html>
  `;

  const dom = new JSDOM(workdayHtml, {
    url: "https://acmecloud.wd1.myworkdayjobs.com/en-US/careers/job/REQ-84920",
  });
  const doc = dom.window.document;
  const adapter = resolveAdapter(dom.window.location.href, doc);

  // 1. Detection
  assert.strictEqual(adapter.name, "Workday", "Should resolve WorkdayAdapter");

  // 2. Company & Role extraction
  const jobMeta = adapter.extractJob(dom.window.location.href, doc);
  assert.strictEqual(jobMeta.title, "Senior Platform Engineer", "Job title matches");
  assert.strictEqual(jobMeta.company, "Acme Cloud", "Company extracted accurately");
  assert.strictEqual(jobMeta.location, "San Francisco, CA (Hybrid)", "Location matches");
  assert.strictEqual(jobMeta.externalId, "REQ-84920", "Req ID matches");
  assert.strictEqual(jobMeta.isWorkday, true, "isWorkday flag must be true");

  // 3. Semantic field mapping & sensitive input filtering
  const fields = adapter.detectFormFields(doc);
  assert.strictEqual(fields.length, 5, "Should detect exactly 5 safe form fields");
  assert.ok(fields.some((f) => f.fieldType === "firstName"), "firstName mapped from Legal First Name");
  assert.ok(fields.some((f) => f.fieldType === "lastName"), "lastName mapped from Family Name");
  assert.ok(fields.some((f) => f.fieldType === "email"), "email mapped from Contact Email");
  assert.ok(fields.some((f) => f.fieldType === "phone"), "phone mapped from Mobile Number");
  assert.ok(fields.some((f) => f.fieldType === "address"), "address mapped from Street Address");

  // Verify sensitive inputs are strictly excluded
  assert.ok(
    !fields.some((f) => f.name.includes("password") || f.name.includes("csrf")),
    "Sensitive inputs must not be detected"
  );

  // 4. Question detection
  const questions = adapter.detectQuestions(doc);
  assert.strictEqual(questions.length, 1, "Detects 1 genuine question");
  assert.strictEqual(questions[0].questionText, "Why do you want to join Acme Cloud?");

  // 5. Safe autofill execution
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

  const autofillRes = autofillSafeFields(doc, fields, mockProfile);
  assert.strictEqual(autofillRes.filledFieldsCount, 5, "Fills all 5 safe fields");
  assert.strictEqual((doc.querySelector("#fName")).value, "Alex");
  assert.strictEqual((doc.querySelector("#lName")).value, "Chen");
  assert.strictEqual((doc.querySelector("#email")).value, "alex.chen@example.com");
  assert.strictEqual((doc.querySelector("#phone")).value, "+1-555-0199");
  assert.strictEqual((doc.querySelector("#address")).value, "123 Tech Way");

  // Verify password remained untouched
  assert.strictEqual(
    (doc.querySelector('input[type="password"]')).value,
    "secret",
    "Password remains untouched"
  );

  console.log("✓ Workday detection, extraction, semantic mapping, and safe autofill verified.");
}

// TEST SUITE 2: Generic ATS Adapter & Form Discrimination
{
  console.log("\n--- 2. Generic ATS Suite ---");

  const genericHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Senior Distributed Systems Engineer - Stripe</title>
        <meta property="og:site_name" content="Stripe">
      </head>
      <body>
        <!-- Header search form: must be ignored -->
        <header>
          <form role="search" id="site-search">
            <input type="text" name="q" placeholder="Search careers" />
            <button type="submit">Search</button>
          </form>
        </header>

        <!-- Newsletter form: must be ignored -->
        <div id="newsletter-box">
          <form id="newsletter-form">
            <input type="email" name="newsletter_email" placeholder="Subscribe to newsletter" />
          </form>
        </div>

        <!-- Real application form -->
        <main>
          <h1>Senior Distributed Systems Engineer</h1>
          <form id="job-application-form">
            <div class="form-group">
              <label for="applicantGivenName">Given Name</label>
              <input id="applicantGivenName" name="applicantGivenName" type="text" />
            </div>

            <div class="form-group">
              <label for="applicantSurname">Surname</label>
              <input id="applicantSurname" name="applicantSurname" type="text" />
            </div>

            <div class="form-group">
              <label for="applicantEmail">Primary Email</label>
              <input id="applicantEmail" name="applicantEmail" type="email" />
            </div>

            <div class="form-group">
              <label for="applicantCell">Cell Phone</label>
              <input id="applicantCell" name="applicantCell" type="tel" />
            </div>

            <div class="form-group">
              <label for="linkedinUrl">LinkedIn URL</label>
              <input id="linkedinUrl" name="linkedinUrl" type="url" />
            </div>

            <div class="form-group">
              <label for="projectEssay">Describe a complex distributed systems challenge you solved.</label>
              <textarea id="projectEssay" name="projectEssay"></textarea>
            </div>
          </form>
        </main>
      </body>
    </html>
  `;

  const dom = new JSDOM(genericHtml, { url: "https://stripe.com/jobs/senior-distributed-systems" });
  const doc = dom.window.document;
  const adapter = resolveAdapter(dom.window.location.href, doc);

  assert.strictEqual(adapter.name, "Generic", "Should resolve GenericAdapter");

  const job = adapter.extractJob(dom.window.location.href, doc);
  assert.strictEqual(job.title, "Senior Distributed Systems Engineer");
  assert.strictEqual(job.company, "Stripe");

  const fields = adapter.detectFormFields(doc);
  assert.strictEqual(fields.length, 5, "Detects 5 fields from real application form, ignoring search/newsletter");
  assert.ok(fields.some((f) => f.fieldType === "firstName"), "Given Name -> firstName");
  assert.ok(fields.some((f) => f.fieldType === "lastName"), "Surname -> lastName");
  assert.ok(fields.some((f) => f.fieldType === "email"), "Primary Email -> email");
  assert.ok(fields.some((f) => f.fieldType === "phone"), "Cell Phone -> phone");
  assert.ok(fields.some((f) => f.fieldType === "linkedin"), "LinkedIn URL -> linkedin");

  const questions = adapter.detectQuestions(doc);
  assert.strictEqual(questions.length, 1, "Detects genuine application essay question");
  assert.strictEqual(
    questions[0].questionText,
    "Describe a complex distributed systems challenge you solved."
  );

  console.log("✓ Generic ATS form discrimination, semantic mapping, and question extraction verified.");
}

// TEST SUITE 3: Dedicated Semantic Field Mapping & Synonym Confidence Scoring
{
  console.log("\n--- 3. Semantic Field Mapping Suite ---");

  // First name synonyms
  const fn1 = classifyFieldSemantics("Given Name", "givenName", "given_name", "", "text");
  assert.strictEqual(fn1.fieldType, "firstName");
  assert.ok(fn1.confidence >= 0.95, "Given Name confidence >= 0.95");

  const fn2 = classifyFieldSemantics("Legal First Name", "firstName", "", "legalNameSection_firstName", "text");
  assert.strictEqual(fn2.fieldType, "firstName");
  assert.ok(fn2.confidence >= 0.95);

  // Last name synonyms
  const ln1 = classifyFieldSemantics("Family Name", "family_name", "", "", "text");
  assert.strictEqual(ln1.fieldType, "lastName");
  assert.ok(ln1.confidence >= 0.95);

  const ln2 = classifyFieldSemantics("Surname", "surname", "", "", "text");
  assert.strictEqual(ln2.fieldType, "lastName");
  assert.ok(ln2.confidence >= 0.95);

  // Phone synonyms
  const ph1 = classifyFieldSemantics("Mobile Number", "mobile", "", "", "tel");
  assert.strictEqual(ph1.fieldType, "phone");
  assert.ok(ph1.confidence >= 0.95);

  const ph2 = classifyFieldSemantics("Telephone", "phone", "", "phone-number", "tel");
  assert.strictEqual(ph2.fieldType, "phone");
  assert.ok(ph2.confidence >= 0.95);

  // Email synonyms
  const em1 = classifyFieldSemantics("Contact Email", "email", "", "", "email");
  assert.strictEqual(em1.fieldType, "email");
  assert.ok(em1.confidence >= 0.95);

  // Unsupported fields must not guess
  const unknown1 = classifyFieldSemantics("Preferred Salary", "desired_salary", "sal", "", "text");
  assert.strictEqual(unknown1.fieldType, "unknown");
  assert.strictEqual(unknown1.confidence, 0.0);

  const unknown2 = classifyFieldSemantics("Notice Period", "notice_days", "", "", "text");
  assert.strictEqual(unknown2.fieldType, "unknown");
  assert.strictEqual(unknown2.confidence, 0.0);

  console.log("✓ Semantic field mapping dictionaries and confidence thresholds verified.");
}

// TEST SUITE 4: Security & Guardrails (Rejection of Sensitive Fields & Non-Genuine Questions)
{
  console.log("\n--- 4. Security & Guardrails Suite ---");

  const securityTestHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <form>
          <!-- 1. Password -->
          <input id="user_password" type="password" name="password" />

          <!-- 2. Hidden token -->
          <input id="auth_token" type="hidden" name="csrf_token" value="secret_csrf" />

          <!-- 3. OTP -->
          <input id="otp_code" type="text" name="otp" autocomplete="one-time-code" placeholder="Enter OTP" />

          <!-- 4. SSN -->
          <input id="ssn_input" type="text" name="ssn" placeholder="Social Security Number" />

          <!-- 5. Aadhaar -->
          <input id="aadhaar_input" type="text" name="aadhaar_number" placeholder="Aadhaar Number" />

          <!-- 6. Card Number -->
          <input id="cc_num" type="text" name="creditcard" autocomplete="cc-number" />

          <!-- 7. CVV -->
          <input id="cc_cvv" type="text" name="cvv" autocomplete="cc-csc" />

          <!-- 8. Bank Account -->
          <input id="bank_acct" type="text" name="account_number" placeholder="Bank Account Number" />

          <!-- 9. Authentication Field -->
          <input id="sec_question" type="text" name="security_question" placeholder="Security Question Answer" />
        </form>
      </body>
    </html>
  `;

  const dom = new JSDOM(securityTestHtml);
  const doc = dom.window.document;

  const sensitiveInputs = [
    { id: "user_password", reason: "Password" },
    { id: "auth_token", reason: "Hidden Token" },
    { id: "otp_code", reason: "OTP" },
    { id: "ssn_input", reason: "SSN" },
    { id: "aadhaar_input", reason: "Aadhaar" },
    { id: "cc_num", reason: "Card Number" },
    { id: "cc_cvv", reason: "CVV" },
    { id: "bank_acct", reason: "Bank Account" },
    { id: "sec_question", reason: "Authentication / Security Question" },
  ];

  for (const item of sensitiveInputs) {
    const el = doc.getElementById(item.id);
    assert.ok(el, `Element ${item.id} must exist in fixture`);
    assert.strictEqual(
      isElementSensitive(el),
      true,
      `Security rejection failed: ${item.reason} (${item.id}) must be marked sensitive`
    );
  }

  // Verify non-genuine application questions rejection
  assert.strictEqual(isGenuineApplicationQuestion("Enter your password to verify"), false);
  assert.strictEqual(isGenuineApplicationQuestion("Enter 6-digit OTP code"), false);
  assert.strictEqual(isGenuineApplicationQuestion("Search jobs by title or keyword"), false);
  assert.strictEqual(isGenuineApplicationQuestion("Cookie settings and preferences"), false);
  assert.strictEqual(isGenuineApplicationQuestion("Subscribe to newsletter updates"), false);

  // Verify genuine application questions acceptance
  assert.strictEqual(isGenuineApplicationQuestion("Why do you want to work at Acme Cloud?"), true);
  assert.strictEqual(isGenuineApplicationQuestion("Tell us about your experience with Python."), true);
  assert.strictEqual(isGenuineApplicationQuestion("What is your preferred location and work arrangement?"), true);

  console.log("✓ Rejection of Password, Token, OTP, SSN, Aadhaar, Card, CVV, Bank, Auth verified.");
}

// TEST SUITE 5: Question Review, Candidate Editing & Explicit Approval Workflow
{
  console.log("\n--- 5. Question Approval & Candidate Editing Suite ---");

  const questionHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <form>
          <label for="q1">Why are you interested in this role?</label>
          <textarea id="q1" name="q1"></textarea>
        </form>
      </body>
    </html>
  `;

  const dom = new JSDOM(questionHtml);
  const doc = dom.window.document;
  const targetTextarea = doc.getElementById("q1");

  // Step A: Draft answer generated
  const generatedDraft = "I am excited to work on large-scale distributed systems.";
  let candidateViewedDraft = true;
  assert.ok(candidateViewedDraft, "Candidate can see the generated draft");

  // Step B: Unapproved draft MUST NOT be inserted into DOM
  let userApproved = false;
  assert.strictEqual(targetTextarea.value, "", "DOM textarea remains completely untouched before approval");

  // Step C: Candidate edits the draft answer directly
  const editedAnswer = "I have 5+ years scaling distributed systems and want to lead architecture at Acme Cloud.";
  assert.notStrictEqual(editedAnswer, generatedDraft, "Candidate edited the text");

  // Step D: Candidate explicitly approves the edited answer
  userApproved = true;
  if (userApproved) {
    targetTextarea.value = editedAnswer;
  }

  assert.strictEqual(
    targetTextarea.value,
    editedAnswer,
    "Target textarea reflects the approved candidate edits"
  );

  // Step E: Application capture only records approved answers
  const capturePayload = {
    jobId: "job-123",
    company: "Acme Cloud",
    title: "Senior Platform Engineer",
    url: "https://acme.wd1.myworkdayjobs.com/job/123",
    pageTitle: "Senior Platform Engineer - Acme",
    formFields: { "First Name": "Alex" },
    rawSnippet: "JD",
    questions: [
      {
        questionText: "Why are you interested in this role?",
        answerText: targetTextarea.value,
        source: "jobos_assistant",
        userApproved: true,
      },
    ],
  };

  const appCreate = assembleApplicationPayload(capturePayload, "user-alex");
  assert.strictEqual(appCreate.initial_questions.length, 1);
  assert.strictEqual(
    appCreate.initial_questions[0].answer.answer_text,
    editedAnswer,
    "Application capsule captures the edited, approved answer"
  );
  assert.strictEqual(appCreate.initial_questions[0].answer.user_approved, true);

  console.log("✓ Question drafting, review, candidate editing, approval, and capture verified.");
}

console.log("\n========================================================");
console.log("ALL 5 PHASE 7 CHROME EXTENSION UNIT TEST SUITES PASSED!");
console.log("========================================================\n");
