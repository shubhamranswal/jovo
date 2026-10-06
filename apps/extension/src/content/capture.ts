/**
 * Application Capture Engine
 *
 * Captures submitted or in-progress application state:
 * - Current URL and page title
 * - Whitelisted form fields and values
 * - Questions and user-approved answers
 * - Frozen JD text snippet
 * - Assembles ApplicationCreate payload for JobOS Application Capsule
 */

import type { ApplicationCreate } from "@jobos/contracts";
import type { ApplicationCapturePayload } from "../types";
import { isGenuineApplicationQuestion, sanitizeCapturedFormFields } from "./security";

export function assembleApplicationPayload(
  payload: ApplicationCapturePayload,
  userId: string
): ApplicationCreate {
  // Extract set of allowed labels/keys from the detected payload
  const allowedKeys = new Set(Object.keys(payload.formFields));
  const sanitizedFormFields = sanitizeCapturedFormFields(payload.formFields, allowedKeys);

  // Filter and sanitize questions to ensure only genuine, user-reviewed application Q&As are captured
  const genuineQuestions = payload.questions.filter(
    (q) => isGenuineApplicationQuestion(q.questionText) && q.userApproved
  );

  const initialQuestions = genuineQuestions.map((q, idx) => ({
    question_text: q.questionText.trim(),
    question_type: "free_text",
    order_index: idx + 1,
    answer: {
      answer_text: q.answerText.trim(),
      source: q.source || "jobos_assistant",
      user_approved: q.userApproved,
    },
  }));

  const initialDocs = [];
  if (payload.resumeVersionId) {
    initialDocs.push({
      document_type: "resume",
      document_id: payload.resumeVersionId,
      version_label: "Tailored Version",
    });
  }
  if (payload.coverLetterId) {
    initialDocs.push({
      document_type: "cover_letter",
      document_id: payload.coverLetterId,
      version_label: "Generated Cover Letter",
    });
  }

  const appStatus = payload.status || "Applied";
  const appliedTimestamp =
    payload.appliedAt || (appStatus === "Applied" ? new Date().toISOString() : undefined);

  return {
    user_id: userId,
    job_id: payload.jobId || null,
    company_name: payload.company,
    title: payload.title,
    source: payload.jobId ? "serpapi" : "browser_capture",
    application_url: payload.url,
    status: appStatus,
    notes: `Captured via JobOS Chrome Extension on ${new Date().toISOString()}`,
    metadata_json: {
      captured_via: "JobOS Chrome Extension",
      captured_at: new Date().toISOString(),
      ...(appliedTimestamp ? { applied_at: appliedTimestamp } : {}),
    },
    initial_snapshot: {
      job_description: payload.rawSnippet,
      page_title: payload.pageTitle,
      page_url: payload.url,
      extraction_metadata_json: {
        role_title: payload.title,
        company: payload.company,
        original_job_url: payload.url,
        captured_at: new Date().toISOString(),
        captured_fields: sanitizedFormFields,
        detected_questions_count: initialQuestions.length,
      },
    },
    initial_documents: initialDocs,
    initial_questions: initialQuestions,
  };
}
