/**
 * JobOS Extension API Client
 * Interfaces exclusively with the local/configured JobOS backend API.
 * Never connects directly to external scrapers, third-party LLMs, or SerpApi.
 */

import type {
  ApplicationCapsule,
  ApplicationCreate,
  CareerProfile,
  JobIdentifyResponse,
  JobMatch,
  QuestionDraftRequest,
  QuestionDraftResponse,
} from "@jobos/contracts";

export class JobOSApiClient {
  private baseUrl: string;

  constructor(baseUrl = "http://localhost:8000/api/v1") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async getActiveProfile(): Promise<CareerProfile> {
    const res = await fetch(`${this.baseUrl}/career/active-profile`);
    if (!res.ok) {
      throw new Error(`Failed to fetch active career profile: ${res.statusText}`);
    }
    return res.json();
  }

  async identifyJob(params: {
    url?: string;
    title?: string;
    company_name?: string;
    external_id?: string;
  }): Promise<JobIdentifyResponse> {
    const res = await fetch(`${this.baseUrl}/jobs/identify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      throw new Error(`Failed to identify job: ${res.statusText}`);
    }
    return res.json();
  }

  async getJobMatch(jobId: string, careerProfileId: string): Promise<JobMatch> {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}/match/${careerProfileId}`);
    if (!res.ok) {
      throw new Error(`Failed to get job match: ${res.statusText}`);
    }
    return res.json();
  }

  async draftQuestionAnswer(payload: QuestionDraftRequest): Promise<QuestionDraftResponse> {
    const res = await fetch(`${this.baseUrl}/career/draft-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to draft question answer: ${res.statusText}`);
    }
    return res.json();
  }

  async createApplication(payload: ApplicationCreate): Promise<ApplicationCapsule> {
    const res = await fetch(`${this.baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to create application capsule: ${res.statusText}`);
    }
    const app = await res.json();
    // Retrieve full capsule
    const capsuleRes = await fetch(`${this.baseUrl}/applications/${app.id}/capsule`);
    if (!capsuleRes.ok) {
      throw new Error(`Failed to fetch application capsule: ${capsuleRes.statusText}`);
    }
    return capsuleRes.json();
  }
}

export const jobosApi = new JobOSApiClient();
