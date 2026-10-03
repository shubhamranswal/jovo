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

export function assembleApplicationPayload(
  payload: ApplicationCapturePayload,
  userId: string
): ApplicationCreate {
  const formFieldPairs: Record<string, unknown> = { ...payload.formFields };

  const initialQuestions = payload.questions.map((q, idx) => ({
    question_text: q.questionText,
    question_type: "free_text",
    order_index: idx + 1,
    answer: {
      answer_text: q.answerText,
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

  return {
    user_id: userId,
    job_id: payload.jobId || null,
    company_name: payload.company,
    title: payload.title,
    source: payload.jobId ? "serpapi" : "browser_capture",
    application_url: payload.url,
    status: "Applied",
    notes: `Captured via JobOS Chrome Extension on ${new Date().toISOString()}`,
    initial_snapshot: {
      job_description: payload.rawSnippet,
      page_title: payload.pageTitle,
      page_url: payload.url,
      extraction_metadata_json: {
        captured_fields: formFieldPairs,
        detected_questions_count: payload.questions.length,
      },
    },
    initial_documents: initialDocs,
    initial_questions: initialQuestions,
  };
}
