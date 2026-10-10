/**
 * JobOS Shared Contracts & Type Definitions
 * Version: 1.0.0
 * Status: LOCKED
 */

export interface HealthResponse {
  status: "ok" | "error";
  version: string;
  timestamp: string;
}

export type ApplicationStatus =
  | "Saved"
  | "Applying"
  | "Applied"
  | "Recruiter Screen"
  | "Interview"
  | "Interviewing"
  | "Technical"
  | "Final"
  | "Offer"
  | "Rejected"
  | "Withdrawn"
  | "Closed";

export interface Company {
  id: string;
  canonical_name: string;
  domain?: string | null;
}

export interface Job {
  id: string;
  company_id: string;
  company_name?: string | null;
  title: string;
  location?: string | null;
  remote_type?: string | null;
  employment_type?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  description: string;
  normalized_requirements_json: string[];
  source_urls_json: string[];
  source_names_json: string[];
  canonical_url?: string | null;
  external_id?: string | null;
  posted_at?: string | null;
  fingerprint: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JobSearchQuery {
  query?: string;
  location?: string;
  remote_type?: string;
  employment_type?: string;
  min_salary?: number;
  limit?: number;
  offset?: number;
}

export interface JobDiscoveryRequest {
  role: string;
  skills?: string[];
  company?: string;
  location?: string;
  remote?: boolean;
  experience_level?: string;
  employment_type?: string;
  start?: number;
  persist?: boolean;
}

export interface JobDiscoveryResponse {
  query_executed: string;
  total_discovered: number;
  newly_persisted: number;
  duplicates_skipped: number;
  jobs: Job[];
  search_metadata: Record<string, unknown>;
}

export interface JobMatch {
  id: string;
  job_id: string;
  career_profile_id: string;
  overall_score: number;
  component_scores_json: {
    skills?: number;
    experience?: number;
    location?: number;
    salary?: number;
    verified_evidence_count?: number;
    [key: string]: unknown;
  };
  strengths_json: string[];
  gaps_json: string[];
  explanation: string;
  created_at: string;
  updated_at: string;
}

export interface CareerSkill {
  id: string;
  name: string;
  normalized_name: string;
  proficiency?: string | null;
}

export interface CareerExperience {
  id: string;
  organization: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  evidence_status: string;
}

export interface CareerEvidence {
  id: string;
  type: string;
  title: string;
  content: string;
  source_type: string;
  source_url?: string | null;
  source_reference?: string | null;
  verification_state: string;
  metadata_json?: Record<string, unknown>;
}

export interface CareerProfile {
  id: string;
  user_id: string;
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  preferences_json: Record<string, unknown>;
  skills?: CareerSkill[];
  experiences?: CareerExperience[];
  evidence?: CareerEvidence[];
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  career_profile_id: string;
  name: string;
  source_file?: string | null;
  extracted_text: string;
  version: number;
  is_master: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResumeVersion {
  id: string;
  career_profile_id: string;
  job_id?: string | null;
  base_resume_id?: string | null;
  content: string;
  version_label: string;
  generation_metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CoverLetter {
  id: string;
  career_profile_id: string;
  job_id: string;
  content: string;
  version: number;
  generation_metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JobTailorRequest {
  career_profile_id: string;
  base_resume_id?: string | null;
}

export interface JobTailorResponse {
  job_id: string;
  career_profile_id: string;
  tailored_resume: ResumeVersion;
  cover_letter: CoverLetter;
  changes_explanation: string[];
  evidence_used: Array<{
    id?: string;
    type?: string;
    title?: string;
    verification_state?: string;
    source_type?: string;
    [key: string]: unknown;
  }>;
  gaps: string[];
  warnings: string[];
}

export interface Application {
  id: string;
  career_profile_id?: string;
  user_id?: string;
  job_id?: string | null;
  company_id?: string | null;
  title?: string;
  company_name?: string | null;
  target_role?: string;
  target_company?: string;
  status: ApplicationStatus;
  applied_at?: string | null;
  source?: string | null;
  application_url?: string | null;
  job_snapshot_json: Record<string, unknown>;
  notes?: string | null;
  metadata_json?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDocumentCreate {
  document_type: string;
  document_id?: string | null;
  version_label: string;
}

export interface ApplicationSnapshotCreate {
  job_description: string;
  page_title?: string | null;
  page_url?: string | null;
  extraction_metadata_json?: Record<string, unknown>;
}

export interface ApplicationAnswerCreate {
  answer_text: string;
  source?: string;
  user_approved?: boolean;
}

export interface ApplicationQuestionCreate {
  question_text: string;
  normalized_question?: string | null;
  question_type?: string;
  page_field_name?: string | null;
  order_index?: number;
  answer?: ApplicationAnswerCreate | null;
}

export interface ApplicationCreate {
  user_id: string;
  job_id?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  title: string;
  source: string;
  application_url?: string | null;
  status?: string;
  notes?: string | null;
  metadata_json?: Record<string, unknown>;
  initial_snapshot?: ApplicationSnapshotCreate | null;
  initial_documents?: ApplicationDocumentCreate[];
  initial_questions?: ApplicationQuestionCreate[];
}

export interface ApplicationSnapshot {
  id: string;
  application_id: string;
  captured_url: string;
  page_title?: string | null;
  form_fields_json: Record<string, unknown>;
  raw_page_text_snippet?: string | null;
  captured_at: string;
  extraction_metadata_json: Record<string, unknown>;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  document_type: string;
  document_id?: string | null;
  version_label: string;
  content?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationQuestion {
  id: string;
  application_id: string;
  question_text: string;
  field_name?: string | null;
  field_type?: string | null;
  order_index: number;
}

export interface ApplicationAnswer {
  id: string;
  question_id: string;
  question_text?: string | null;
  answer_text: string;
  source: string;
  user_approved: boolean;
}

export interface Interview {
  id: string;
  application_id: string;
  stage: string;
  scheduled_at?: string | null;
  notes?: string | null;
  preparation_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InterviewQuestionItem {
  id: string;
  question: string;
  category: "Technical" | "Behavioral" | "Application-Specific" | "Application-Followup";
  why_asked: string;
  relevant_evidence: string;
  prep_notes: string;
  user_answer?: string | null;
}

export interface InterviewReadiness {
  category: "Strong" | "Needs Review" | "Evidence Gap";
  explanation: string;
  signals: string[];
}

export interface FollowUp {
  id: string;
  application_id: string;
  type: string;
  due_at: string;
  completed_at?: string | null;
  notes?: string | null;
  status?: "Pending" | "Completed" | "Skipped";
  created_at: string;
  updated_at: string;
}

export interface ApplicationCapsule {
  application: Application;
  snapshot?: ApplicationSnapshot | null;
  documents: ApplicationDocument[];
  answers: ApplicationAnswer[];
  interviews: Interview[];
  follow_ups: FollowUp[];
}

export interface JobIdentifyRequest {
  url?: string | null;
  title?: string | null;
  company_name?: string | null;
  external_id?: string | null;
}

export interface JobIdentifyResponse {
  matched: boolean;
  job?: Job | null;
  confidence: number;
}

export interface QuestionDraftRequest {
  career_profile_id: string;
  question_text: string;
  job_id?: string | null;
}

export interface QuestionDraftResponse {
  question_text: string;
  draft_answer: string;
  evidence_used: Array<Record<string, unknown>>;
  missing_evidence: string[];
  confidence: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
