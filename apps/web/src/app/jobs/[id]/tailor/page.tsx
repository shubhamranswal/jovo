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
  const [showModal, setShowModal] = useState(false);
  const [q1, setQ1] = useState(
    "Engineered and customized secure payment workflows on Thales payShield 10K HSM with RSA-protected TR-31 key blocks. Built a multi-threaded Golang automation utility reducing HSM validation time by 50% while guaranteeing PKCS and ISO/ANSI cryptographic compliance."
  );
  const [q2, setQ2] = useState(
    "Designed production FastAPI backend tooling and developed LogChat, an offline-first AI log investigation platform using local LLMs and agentic workflows to preserve sensitive log boundaries. Built KeyVault Lite envelope encryption and DevLens Go CLI architectures."
  );
  const [confirmedReview, setConfirmedReview] = useState(false);

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

  const handleConfirmSubmission = async () => {
    if (!job || !profile || !tailorResult || !confirmedReview) return;
    setSavingApp(true);
    setError(null);
    try {
      const app = await api.createApplication({
        job_id: job.id,
        user_id: profile.user_id,
        title: job.title,
        company_name: job.company_name || "Company",
        source: job.metadata_json?.is_demo ? "Demo Portal" : "Workday",
        application_url: job.canonical_url || undefined,
        status: "Applied",
        notes:
          "Simulated ATS submission via controlled demo workflow. Candidate verified all answers.",
        initial_snapshot: {
          job_description: job.description,
          page_title: job.title,
          page_url: job.canonical_url || "",
          extraction_metadata_json: {
            fingerprint: job.fingerprint,
            source: "jobos_snapshot",
            ats: "Controlled ATS Fixture",
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
        initial_questions: [
          {
            question_text:
              "Describe a challenging distributed system or security issue you solved.",
            question_type: "textarea",
            order_index: 1,
            answer: {
              answer_text: q1,
              source: "llm_draft",
              user_approved: true,
            },
          },
          {
            question_text:
              "What experience do you have with backend APIs, microservices, and automated testing?",
            question_type: "textarea",
            order_index: 2,
            answer: {
              answer_text: q2,
              source: "llm_draft",
              user_approved: true,
            },
          },
        ],
      });

      // Automatically generate grounded interview preparation
      try {
        await api.generateInterviewPrep(app.id, "Technical");
      } catch {
        // Non-blocking
      }

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
              onClick={() => setShowModal(true)}
              disabled={generating || !tailorResult}
              className="btn btn-primary"
            >
              Review & Submit Application →
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
                onClick={() => setShowModal(true)}
                disabled={savingApp || !tailorResult}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                Review & Submit Application →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controlled ATS Application Simulation Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "760px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "32px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border-hairline)",
            }}
          >
            {/* Modal Header */}
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="telemetry-xs badge badge-amber">CONTROLLED ATS SUBMISSION</span>
                  <span className="telemetry-xs badge badge-gray">DEMO WORKSPACE</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                    color: "var(--ink-muted)",
                  }}
                >
                  ✕
                </button>
              </div>
              <h2 className="headline-md" style={{ marginBottom: "4px" }}>
                Review Application for {job?.title}
              </h2>
              <p className="body-sm text-muted">
                Target: <strong>{job?.company_name}</strong> • Source:{" "}
                {job?.metadata_json?.is_demo ? "Demo Catalog Opening" : "Live SerpApi Job Listing"}
              </p>
            </div>

            {/* Notice Banner */}
            <div
              style={{
                padding: "12px 16px",
                background: "#FEF3C7",
                border: "1px solid #FCD34D",
                borderRadius: "var(--radius-sm)",
                marginBottom: "24px",
                fontSize: "0.85rem",
                color: "#92400E",
              }}
            >
              <strong>Notice:</strong> This is a controlled demo submission simulation. Jovo will
              record the exact application context, tailored resume, and approved answers into your
              immutable Application Capsule. Applications to real external employers are never
              silently submitted.
            </div>

            {/* Section 1: Candidate Information */}
            <div style={{ marginBottom: "20px" }}>
              <h3 className="headline-sm" style={{ fontSize: "1rem", marginBottom: "10px" }}>
                1. Candidate Ground Truth
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  padding: "14px",
                  background: "var(--bg-canvas)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-hairline)",
                }}
              >
                <div>
                  <div className="telemetry-xs text-muted">Candidate Name</div>
                  <strong className="body-sm" style={{ color: "var(--ink-primary)" }}>
                    Shubham Singh Ranswal
                  </strong>
                </div>
                <div>
                  <div className="telemetry-xs text-muted">Location</div>
                  <span className="body-sm">Noida, Uttar Pradesh</span>
                </div>
                <div>
                  <div className="telemetry-xs text-muted">Email</div>
                  <span className="body-sm">shubhamranswal@gmail.com</span>
                </div>
                <div>
                  <div className="telemetry-xs text-muted">Phone</div>
                  <span className="body-sm">+91 9560793525</span>
                </div>
              </div>
            </div>

            {/* Section 2: Materials Attached */}
            <div style={{ marginBottom: "20px" }}>
              <h3 className="headline-sm" style={{ fontSize: "1rem", marginBottom: "10px" }}>
                2. Attached Application Materials
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "var(--bg-canvas)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-hairline)",
                  }}
                >
                  <span className="body-sm">📄 {tailorResult?.tailored_resume.version_label}</span>
                  <span className="telemetry-xs badge badge-green">Tailored & Frozen</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "var(--bg-canvas)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-hairline)",
                  }}
                >
                  <span className="body-sm">
                    ✉️ Cover Letter v{tailorResult?.cover_letter.version} ({job?.company_name})
                  </span>
                  <span className="telemetry-xs badge badge-green">Grounded in Evidence</span>
                </div>
              </div>
            </div>

            {/* Section 3: Application Questions */}
            <div style={{ marginBottom: "24px" }}>
              <h3 className="headline-sm" style={{ fontSize: "1rem", marginBottom: "10px" }}>
                3. Application Questions & Grounded Answers
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label className="label" style={{ marginBottom: "4px" }}>
                    Q1: Describe a challenging distributed system or security issue you solved.
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={q1}
                    onChange={(e) => setQ1(e.target.value)}
                    style={{ fontSize: "0.85rem", lineHeight: "1.5" }}
                  />
                  <div className="telemetry-xs text-muted" style={{ marginTop: "3px" }}>
                    Source: Verified Career Evidence • Thales payShield 10K HSM & Golang MultiLMK
                  </div>
                </div>

                <div>
                  <label className="label" style={{ marginBottom: "4px" }}>
                    Q2: What experience do you have with backend APIs, microservices, and automated
                    testing?
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={q2}
                    onChange={(e) => setQ2(e.target.value)}
                    style={{ fontSize: "0.85rem", lineHeight: "1.5" }}
                  />
                  <div className="telemetry-xs text-muted" style={{ marginTop: "3px" }}>
                    Source: Verified Career Evidence • FastAPI, LogChat, and DevLens
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Candidate Confirmation */}
            <div
              style={{
                padding: "16px",
                background: "var(--bg-canvas)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-hairline)",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="confirm-ats-submission"
                  checked={confirmedReview}
                  onChange={(e) => setConfirmedReview(e.target.checked)}
                  style={{ marginTop: "3px", width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label
                  htmlFor="confirm-ats-submission"
                  className="body-sm"
                  style={{ cursor: "pointer", color: "var(--ink-primary)" }}
                >
                  <strong>I have reviewed these materials and approved answers.</strong> Record this
                  submission into my Application Capsule and transition status to{" "}
                  <span className="badge badge-blue">Applied</span>.
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-secondary"
                disabled={savingApp}
              >
                Back to Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmission}
                disabled={!confirmedReview || savingApp}
                className="btn btn-primary"
              >
                {savingApp ? "Submitting & Freezing Capsule..." : "Confirm & Submit Application →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
