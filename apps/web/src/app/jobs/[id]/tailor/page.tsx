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
          marginBottom: "24px",
        }}
      >
        <Link href={`/jobs/${jobId}`} className="text-sm text-muted">
          ← Back to Job Detail
        </Link>
        <span className="badge badge-blue">Intelligent Grounded Tailoring</span>
      </div>

      {/* Target Job Summary */}
      <div className="card" style={{ marginBottom: "28px", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="title-md" style={{ fontSize: "1.25rem", marginBottom: "4px" }}>
              Tailoring Materials for {job?.title || "Target Opportunity"}
            </h1>
            <p className="text-xs text-muted">
              Target Company:{" "}
              <strong style={{ color: "var(--text-main)" }}>
                {job?.company_name || "Company"}
              </strong>{" "}
              • {job?.location || "Remote"}
            </p>
          </div>

          <button
            onClick={handleCreateApplication}
            disabled={savingApp || !tailorResult}
            className="btn btn-primary"
            style={{ padding: "10px 22px" }}
          >
            {savingApp ? "Saving Application..." : "Save Application to Capsule →"}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="alert-gap"
          style={{ marginBottom: "24px", background: "var(--danger-bg)", color: "#f87171" }}
        >
          <strong>Tailoring Error:</strong> {error}
        </div>
      )}

      {generating && (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <h2 className="title-md" style={{ marginBottom: "10px" }}>
            Tailoring Truthful Application Materials...
          </h2>
          <p className="text-sm text-muted" style={{ maxWidth: "500px", margin: "0 auto" }}>
            The Match Engine is cross-referencing your master resume and verified GitHub evidence
            against the target job requirements without inventing unbacked claims.
          </p>
        </div>
      )}

      {tailorResult && (
        <div className="grid-sidebar">
          {/* Main Column: Tailored Documents */}
          <div>
            {/* Tab Controls */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button
                onClick={() => setActiveTab("resume")}
                className={`btn ${activeTab === "resume" ? "btn-primary" : "btn-secondary"} btn-sm`}
              >
                Tailored Resume
              </button>
              <button
                onClick={() => setActiveTab("cover_letter")}
                className={`btn ${activeTab === "cover_letter" ? "btn-primary" : "btn-secondary"} btn-sm`}
              >
                Tailored Cover Letter
              </button>
            </div>

            {/* Document Content View */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="title-md">
                    {activeTab === "resume"
                      ? tailorResult.tailored_resume.version_label
                      : `Tailored Cover Letter (v${tailorResult.cover_letter.version})`}
                  </h3>
                  <p className="text-xs text-muted">
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
              <h3 className="title-md" style={{ marginBottom: "12px", fontSize: "1rem" }}>
                Why This Content Was Prioritized
              </h3>
              <ul style={{ paddingLeft: "18px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {tailorResult.changes_explanation.map((exp, i) => (
                  <li key={i} style={{ marginBottom: "6px" }}>
                    {exp}
                  </li>
                ))}
              </ul>
            </div>

            {/* Evidence Cited */}
            <div className="card">
              <h3 className="title-md" style={{ marginBottom: "12px", fontSize: "1rem" }}>
                Verified Evidence Cited
              </h3>
              {tailorResult.evidence_used.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {tailorResult.evidence_used.map((ev, i) => (
                    <div key={i} className="evidence-item" style={{ padding: "8px 12px" }}>
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "0.8rem" }}>
                          {ev.title || "Career Evidence"}
                        </div>
                        <div className="text-xs text-dim">
                          Source: {ev.source_type || "github"} • Status:{" "}
                          {ev.verification_state || "verified"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">No external evidence citations needed.</p>
              )}
            </div>

            {/* Gaps & Warnings */}
            {tailorResult.warnings.length > 0 && (
              <div className="card">
                <h3
                  className="title-md"
                  style={{ marginBottom: "12px", fontSize: "1rem", color: "#fbbf24" }}
                >
                  Identified Gaps (Not Fabricated)
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {tailorResult.warnings.map((warn, i) => (
                    <div key={i} className="alert-gap" style={{ padding: "8px 10px" }}>
                      <span style={{ fontSize: "0.8rem" }}>{warn}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Capsule Action */}
            <div className="card" style={{ background: "var(--bg-subtle)", textAlign: "center" }}>
              <h4 className="title-md" style={{ fontSize: "0.95rem", marginBottom: "6px" }}>
                Preserve in Application Memory
              </h4>
              <p className="text-xs text-muted" style={{ marginBottom: "14px" }}>
                Freeze this exact JD, tailored resume, and cover letter into an immutable
                Application Capsule.
              </p>
              <button
                onClick={handleCreateApplication}
                disabled={savingApp}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                {savingApp ? "Capturing..." : "Create Application Capsule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
