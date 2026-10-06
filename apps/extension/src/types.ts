/**
 * JobOS Extension Internal Types & Messages
 */

import type { ApplicationCapsule, CareerProfile, Job, JobMatch } from "@jobos/contracts";

export interface ExtractedJobMetadata {
  url: string;
  title: string;
  company: string;
  location?: string;
  descriptionSnippet?: string;
  externalId?: string;
  isWorkday: boolean;
}

export type SafeFieldType =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "address"
  | "city"
  | "state"
  | "postalCode"
  | "linkedin"
  | "github"
  | "website";

export interface DetectedFormField {
  name: string;
  label: string;
  fieldType: SafeFieldType | "unknown";
  confidence: number;
  selector: string;
  currentValue?: string;
}

export interface DetectedQuestion {
  id: string;
  questionText: string;
  selector: string;
  currentValue?: string;
}

export interface AutofillResult {
  filledFieldsCount: number;
  filledFields: Array<{ label: string; fieldType: string; value: string }>;
  unfilledFields: string[];
}

export interface SubmissionSignal {
  detected: boolean;
  confidence: number;
  signalType: "confirmation_url" | "confirmation_dom_text" | "manual_form_submit_event" | "none";
  message: string;
}

export interface ApplicationCapturePayload {
  jobId?: string;
  company: string;
  title: string;
  url: string;
  pageTitle: string;
  formFields: Record<string, string>;
  rawSnippet: string;
  questions: Array<{
    questionText: string;
    answerText: string;
    source: string;
    userApproved: boolean;
  }>;
  resumeVersionId?: string;
  coverLetterId?: string;
  status?: string;
  appliedAt?: string;
}

export interface ExtensionState {
  currentUrl: string;
  detectedJob: ExtractedJobMetadata | null;
  matchedJob: Job | null;
  matchScore: number | null;
  matchDetails: JobMatch | null;
  profile: CareerProfile | null;
  fields: DetectedFormField[];
  questions: DetectedQuestion[];
  capturedApplicationId?: string | null;
  statusMessage?: string | null;
}

// Background <-> Content <-> Popup Message protocol
export type ExtensionMessage =
  | { type: "PAGE_LOADED"; payload: { url: string } }
  | { type: "EXTRACT_PAGE_DATA" }
  | {
      type: "PAGE_DATA_EXTRACTED";
      payload: {
        job: ExtractedJobMetadata;
        fields: DetectedFormField[];
        questions: DetectedQuestion[];
      };
    }
  | { type: "AUTOFILL_SAFE_FIELDS"; payload: { profile: CareerProfile } }
  | { type: "AUTOFILL_COMPLETED"; payload: AutofillResult }
  | {
      type: "DRAFT_QUESTION";
      payload: { questionText: string; selector: string; jobId?: string; profileId: string };
    }
  | { type: "INSERT_QUESTION_ANSWER"; payload: { selector: string; answerText: string } }
  | { type: "CAPTURE_APPLICATION_CONFIRMATION"; payload: ApplicationCapturePayload }
  | {
      type: "APPLICATION_CAPTURED_SUCCESS";
      payload: { applicationId: string; capsule: ApplicationCapsule };
    }
  | { type: "GET_EXTENSION_STATE" };
