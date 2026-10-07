"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import type { CareerProfile, Job, JobTailorResponse } from "@jobos/contracts";
import { api } from "../../../../lib/api";

export default function TailorJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [tailorResult, setTailorResult] = useState<JobTailorResponse | null>(null);

  const [generating, setGenerating] = useState(false);
  const [savingApp, setSavingApp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"resume" | "cover_letter">("resume");

  useEffect(() => {
    async function init() {
      if (!jobId) return;
      try {
        const [jobData, profileData] = await Promise.all([
          api.getJob(jobId),
          api.getActiveProfile(),
        ]);
        setJob(jobData);
        setProfile(profileData);

        // Automatically trigger tailoring generation
        setGenerating(true);
        const result = await api.tailorMaterials(jobId, {
          career_profile_id: profileData.id,
        });
        setTailorResult(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Tailoring generation failed";
        setError(msg);
      } finally {
        setGenerating(false);
      }
    }
    init();
  }, [jobId]);

  const handleCreateApplication = async () => {
    if (!job || !profile || !tailorResult) return;
    setSavingApp(true);
    setError(null);
    try {
      const app = await api.createApplication({
        job_id: job.id,
        user_id: profile.user_id,
        title: job.title,
        company_name: job.company_name || "Company",
        source: "jobos_serpapi_tailor",
        application_url: job.canonical_url || undefined,
        status: "Applied",
        notes: "Tailored and applied via Jovo intelligent tailoring golden path.",
        initial_snapshot: {
          job_description: job.description,
          page_title: job.title,
          page_url: job.canonical_url || "",
          extraction_metadata_json: {
            fingerprint: job.fingerprint,
            source: "jobos_snapshot",
          },
        },
        initial_documents: [
          {
            document_type: "resume",
            document_id: tailorResult.tailored_resume.id,
            version_label: tailorResult.tailored_resume.version_label,
          },
          {
            document_type: "cover_letter",
            document_id: tailorResult.cover_letter.id,
            version_label: `Cover Letter v${tailorResult.cover_letter.version}`,
          },
        ],
        initial_questions: [],
      });

      // Navigate to the newly captured Application Capsule!
      router.push(`/applications/${app.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save application capsule";
      setError(msg);
      setSavingApp(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: "32px" }}>
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <Link href={`/jobs/${jobId}`} className="body-sm text-muted">
          ← Back to Job Detail
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="telemetry-xs text-muted">GROUNDING PROTOCOL</span>
          <span className="badge badge-blue">Truthful Tailoring Engine</span>
        </div>
      </div>

      {/* Target Job Summary & Relationship banner */}
      <div className="card" style={{ marginBottom: "28px", padding: "22px 26px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="telemetry-xs badge badge-gray">TRANSFORMATION PIPELINE</span>
              <span className="telemetry-xs text-muted">Master Resume → Job-Specific Version</span>
            </div>
            <h1 className="headline-md" style={{ marginBottom: "4px" }}>
              Tailoring Materials for {job?.title || "Target Opportunity"}
            </h1>
            <p className="body-sm text-muted">
              Target Company:{" "}
              <strong style={{ color: "var(--ink-primary)" }}>
                {job?.company_name || "Company"}
              </strong>{" "}
              • {job?.location || "Remote"}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <a
              href="/fixtures/workday.html"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              title="Open controlled Workday application fixture in a new tab for the Chrome Extension"
            >
              Open Application Portal ↗
            </a>
            <button
              onClick={handleCreateApplication}
              disabled={savingApp || !tailorResult}
              className="btn btn-primary"
            >
              {savingApp ? "Saving Application..." : "Save Application to Capsule →"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-danger" style={{ marginBottom: "24px" }}>
          <strong>Tailoring Error:</strong> {error}
        </div>
      )}

      {generating && (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2 className="headline-md" style={{ marginBottom: "10px" }}>
            Tailoring Truthful Application Materials...
          </h2>
          <p className="body-sm text-muted" style={{ maxWidth: "520px", margin: "0 auto" }}>
            The Match Engine is cross-referencing your master resume and verified career evidence
            against target job requirements without inventing unbacked claims.
          </p>
        </div>
      )}

      {tailorResult && (
        <div className="grid-sidebar">
          {/* Main Column: Tailored Documents */}
          <div>
            {/* Tab Controls */}
            <div className="tabs-header">
              <button
                onClick={() => setActiveTab("resume")}
                className={`tab-btn ${activeTab === "resume" ? "active" : ""}`}
              >
                Tailored Resume ({tailorResult.tailored_resume.version_label})
              </button>
              <button
                onClick={() => setActiveTab("cover_letter")}
                className={`tab-btn ${activeTab === "cover_letter" ? "active" : ""}`}
              >
                Tailored Cover Letter (v{tailorResult.cover_letter.version})
              </button>
            </div>

            {/* Document Content View */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="headline-sm">
                    {activeTab === "resume"
                      ? tailorResult.tailored_resume.version_label
                      : `Tailored Cover Letter (v${tailorResult.cover_letter.version})`}
                  </h3>
                  <p className="body-sm text-muted">
                    {activeTab === "resume"
                      ? "Grounded variant • Canonical master resume preserved unmodified"
                      : "Company-aligned letter backed strictly by verified experiences"}
                  </p>
                </div>

                <button
                  onClick={() => {
                    const text =
                      activeTab === "resume"
                        ? tailorResult.tailored_resume.content
                        : tailorResult.cover_letter.content;
                    navigator.clipboard.writeText(text);
                    alert("Copied to clipboard!");
                  }}
                  className="btn btn-outline btn-sm"
                >
                  Copy Text
                </button>
              </div>

              <div className="pre-box">
                {activeTab === "resume"
                  ? tailorResult.tailored_resume.content
                  : tailorResult.cover_letter.content}
              </div>
            </div>
          </div>

          {/* Right Column: Explainability, Evidence Cited & Gaps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Explainable Changes */}
            <div className="card">
              <h3 className="headline-sm" style={{ marginBottom: "12px", fontSize: "1rem" }}>
                Why This Content Was Prioritized
              </h3>
              <ul
                style={{ paddingLeft: "18px", fontSize: "0.85rem", color: "var(--ink-secondary)" }}
              >
                {tailorResult.changes_explanation.map((exp, i) => (
                  <li key={i} style={{ marginBottom: "6px" }}>
                    {exp}
                  </li>
                ))}
              </ul>
            </div>

            {/* Evidence Cited */}
            <div className="card">
              <h3 className="headline-sm" style={{ marginBottom: "12px", fontSize: "1rem" }}>
                Verified Evidence Cited
              </h3>
              {tailorResult.evidence_used.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {tailorResult.evidence_used.map((ev, i) => (
                    <div key={i} className="evidence-item" style={{ padding: "8px 12px" }}>
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "2px",
                          }}
                        >
                          <span className="verified-evidence-badge">
                            ✓ {ev.verification_state || "verified"}
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              color: "var(--ink-primary)",
                            }}
                          >
                            {ev.title || "Career Evidence"}
                          </span>
                        </div>
                        <div className="telemetry-xs text-muted">
                          Source: {ev.source_type || "github"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="body-sm text-muted">No external evidence citations needed.</p>
              )}
            </div>

            {/* Gaps & Warnings */}
            {tailorResult.warnings.length > 0 && (
              <div className="card">
                <h3
                  className="headline-sm"
                  style={{
                    marginBottom: "12px",
                    fontSize: "1rem",
                    color: "var(--fit-moderate-text)",
                  }}
                >
                  Identified Gaps (Never Fabricated)
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {tailorResult.warnings.map((warn, i) => (
                    <div key={i} className="alert-gap" style={{ padding: "8px 10px" }}>
                      <span className="body-sm">{warn}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Capsule Action */}
            <div
              className="card"
              style={{
                background: "var(--bg-canvas)",
                textAlign: "center",
                border: "1px solid var(--border-hairline)",
              }}
            >
              <h4 className="headline-sm" style={{ fontSize: "0.95rem", marginBottom: "6px" }}>
                Preserve in Application Memory
              </h4>
              <p className="body-sm text-muted" style={{ marginBottom: "14px" }}>
                Freeze this exact JD, tailored resume, and cover letter into an immutable
                Application Capsule.
              </p>
              <button
                onClick={handleCreateApplication}
                disabled={savingApp}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                {savingApp ? "Capturing..." : "Create Application Capsule →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
