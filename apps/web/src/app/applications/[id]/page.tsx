"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import type { ApplicationCapsule, ApplicationStatus } from "@jobos/contracts";
import { api } from "../../../lib/api";

export default function ApplicationDetailPage() {
  const params = useParams();
  const applicationId = params?.id as string;

  const [capsule, setCapsule] = useState<ApplicationCapsule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "snapshot" | "documents" | "qa" | "prep" | "followups"
  >("snapshot");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingPrep, setGeneratingPrep] = useState(false);

  useEffect(() => {
    async function loadCapsule() {
      if (!applicationId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.getApplicationCapsule(applicationId);
        setCapsule(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load Application Capsule";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadCapsule();
  }, [applicationId]);

  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    if (!capsule) return;
    setUpdatingStatus(true);
    try {
      const updated = await api.updateApplicationStatus(capsule.application.id, newStatus);
      setCapsule({
        ...capsule,
        application: updated,
      });
    } catch (err: unknown) {
      alert(`Status update failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTriggerPrep = async () => {
    if (!capsule) return;
    setGeneratingPrep(true);
    try {
      await api.generateInterviewPrep(capsule.application.id);
      // Reload capsule
      const reloaded = await api.getApplicationCapsule(capsule.application.id);
      setCapsule(reloaded);
      setActiveTab("prep");
    } catch (err: unknown) {
      alert(`Interview prep generation failed: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setGeneratingPrep(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: "60px", textAlign: "center" }}>
        <h2 className="title-md">Accessing Application Memory...</h2>
        <p className="text-sm text-muted">Retrieving immutable Application Capsule snapshot.</p>
      </div>
    );
  }

  if (error || !capsule) {
    return (
      <div className="container" style={{ paddingTop: "60px" }}>
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <h2 className="title-md" style={{ color: "var(--danger)", marginBottom: "8px" }}>
            Application Capsule Not Found
          </h2>
          <p className="text-sm text-muted" style={{ marginBottom: "20px" }}>
            {error || "Could not retrieve the requested application."}
          </p>
          <Link href="/applications" className="btn btn-secondary">
            Back to Applications
          </Link>
        </div>
      </div>
    );
  }

  const { application, snapshot, documents, answers, interviews, follow_ups } = capsule;
  const resumeDoc = documents.find((d) => d.document_type === "resume");
  const coverLetterDoc = documents.find((d) => d.document_type === "cover_letter");

  return (
    <div className="container" style={{ paddingTop: "32px" }}>
      {/* Breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <Link href="/applications" className="text-sm text-muted">
          ← Back to All Applications
        </Link>
        <span className="text-xs text-dim">Capsule ID: {application.id}</span>
      </div>

      {/* Hero: The Application Capsule Visual Differentiator */}
      <div className="capsule-hero">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
          }}
        >
          <div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}
            >
              <div className="capsule-stamp">★ Application Capsule • Preserved Memory</div>
              <span className="badge badge-green">{application.status}</span>
            </div>

            <h1 className="title-xl" style={{ fontSize: "2rem", marginBottom: "6px" }}>
              {application.target_role}
            </h1>
            <div style={{ fontSize: "1.1rem", color: "var(--text-muted)", marginBottom: "12px" }}>
              <strong style={{ color: "var(--text-main)" }}>{application.target_company}</strong> •
              Applied:{" "}
              {application.applied_at
                ? new Date(application.applied_at).toLocaleDateString()
                : new Date(application.created_at).toLocaleDateString()}
            </div>

            <p className="text-sm text-dim" style={{ maxWidth: "700px" }}>
              This capsule holds the exact historical state of what you submitted. Even if the live
              job posting is taken down or modified, your exact JD snapshot, tailored resume
              version, and cover letter remain frozen and accessible here forever.
            </p>
          </div>

          {/* Quick Actions & Status Control */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "180px" }}>
            <div className="input-group">
              <label className="label" style={{ fontSize: "0.75rem" }}>
                Update Status
              </label>
              <select
                className="input"
                value={application.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
                style={{ padding: "8px 10px", fontSize: "0.85rem" }}
              >
                <option value="Saved">Saved</option>
                <option value="Applying">Applying</option>
                <option value="Applied">Applied</option>
                <option value="Recruiter Screen">Recruiter Screen</option>
                <option value="Interview">Interview</option>
                <option value="Technical">Technical</option>
                <option value="Final">Final</option>
                <option value="Offer">Offer</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <button
              onClick={handleTriggerPrep}
              disabled={generatingPrep}
              className="btn btn-secondary btn-sm"
              style={{ width: "100%", marginTop: "4px" }}
            >
              {generatingPrep ? "Preparing..." : "⚡ Generate Interview Prep"}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "24px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "12px",
        }}
      >
        <button
          onClick={() => setActiveTab("snapshot")}
          className={`btn ${activeTab === "snapshot" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          1. Exact Job Snapshot
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`btn ${activeTab === "documents" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          2. Submitted Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("qa")}
          className={`btn ${activeTab === "qa" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          3. Captured Answers ({answers.length})
        </button>
        <button
          onClick={() => setActiveTab("prep")}
          className={`btn ${activeTab === "prep" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          4. Interview Prep ({interviews.length})
        </button>
        <button
          onClick={() => setActiveTab("followups")}
          className={`btn ${activeTab === "followups" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          5. Follow-ups ({follow_ups.length})
        </button>
      </div>

      {/* Tab 1: Exact Job Description Snapshot */}
      {activeTab === "snapshot" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="title-md">Frozen Job Description Snapshot</h3>
              <p className="text-xs text-muted">
                Captured on{" "}
                {snapshot?.captured_at
                  ? new Date(snapshot.captured_at).toLocaleString()
                  : "Submission"}{" "}
                • Permanent offline archive
              </p>
            </div>
            {snapshot?.captured_url && (
              <a
                href={snapshot.captured_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
              >
                Original URL ↗
              </a>
            )}
          </div>

          <div
            className="text-sm"
            style={{
              lineHeight: "1.7",
              color: "#cbd5e1",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "500px",
              overflowY: "auto",
              background: "var(--bg-subtle)",
              padding: "20px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {(snapshot?.form_fields_json?.job_description as string) ||
              snapshot?.raw_page_text_snippet ||
              (application.job_snapshot_json?.job_description as string) ||
              "No textual snapshot preserved."}
          </div>
        </div>
      )}

      {/* Tab 2: Submitted Documents (Resume Version & Cover Letter) */}
      {activeTab === "documents" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="title-md">Submitted Resume Version</h3>
                <p className="text-xs text-muted">
                  {resumeDoc ? resumeDoc.version_label : "No resume version linked"}
                </p>
              </div>
              <span className="badge badge-blue">Submitted</span>
            </div>

            <div className="text-xs text-muted" style={{ marginBottom: "12px" }}>
              Linked Document ID: {resumeDoc?.document_id || "None"}
            </div>

            <div className="pre-box" style={{ maxHeight: "380px" }}>
              {resumeDoc
                ? `Resume Version: ${resumeDoc.version_label}\n\nPreserved immutable in JobOS Application Capsule.\nThis is the exact tailored resume submitted to ${application.target_company}.`
                : "No resume document registered."}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="title-md">Submitted Cover Letter</h3>
                <p className="text-xs text-muted">
                  {coverLetterDoc ? coverLetterDoc.version_label : "No cover letter linked"}
                </p>
              </div>
              <span className="badge badge-amber">Cover Letter</span>
            </div>

            <div className="text-xs text-muted" style={{ marginBottom: "12px" }}>
              Linked Document ID: {coverLetterDoc?.document_id || "None"}
            </div>

            <div className="pre-box" style={{ maxHeight: "380px" }}>
              {coverLetterDoc
                ? `Cover Letter: ${coverLetterDoc.version_label}\n\nCompany: ${application.target_company}\nPreserved immutable in JobOS Application Capsule.`
                : "No cover letter document registered."}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Captured Questions & Answers */}
      {activeTab === "qa" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="title-md">Captured Form Questions & Answers</h3>
              <p className="text-xs text-muted">
                Recorded from the Workday or generic web application form
              </p>
            </div>
          </div>

          {answers.length === 0 ? (
            <div className="text-sm text-muted" style={{ textAlign: "center", padding: "40px 0" }}>
              No custom application form fields were captured for this submission.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {answers.map((ans, i) => (
                <div
                  key={ans.id || i}
                  style={{
                    padding: "16px",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div className="label" style={{ marginBottom: "6px" }}>
                    Question {i + 1}
                  </div>
                  <div className="text-sm" style={{ fontWeight: "600", marginBottom: "8px" }}>
                    Answer Text: {ans.answer_text}
                  </div>
                  <div className="text-xs text-dim">
                    Source: {ans.source} • Approved by Candidate: {ans.user_approved ? "Yes" : "No"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Interview Preparation Grounded in Capsule */}
      {activeTab === "prep" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="title-md">Grounded Interview Preparation</h3>
              <p className="text-xs text-muted">
                Tailored interview questions based on the exact job requirements and your submitted
                materials
              </p>
            </div>
            <button
              onClick={handleTriggerPrep}
              disabled={generatingPrep}
              className="btn btn-primary btn-sm"
            >
              {generatingPrep ? "Regenerating..." : "Regenerate Prep"}
            </button>
          </div>

          {interviews.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p className="text-sm text-muted" style={{ marginBottom: "16px" }}>
                Interview preparation has not been generated for this application yet.
              </p>
              <button onClick={handleTriggerPrep} className="btn btn-primary btn-sm">
                Generate Grounded Questions & Strategy
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {interviews.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    padding: "20px",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                    }}
                  >
                    <strong style={{ fontSize: "1rem" }}>{item.stage} Stage Preparation</strong>
                    <span className="badge badge-blue">
                      {item.scheduled_at
                        ? new Date(item.scheduled_at).toLocaleDateString()
                        : "Upcoming"}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="text-sm text-muted" style={{ marginBottom: "14px" }}>
                      {item.notes}
                    </p>
                  )}

                  {item.preparation_json && Object.keys(item.preparation_json).length > 0 && (
                    <div className="pre-box" style={{ maxHeight: "300px" }}>
                      {JSON.stringify(item.preparation_json, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Follow-up Reminders */}
      {activeTab === "followups" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="title-md">Follow-up Timeline & Reminders</h3>
              <p className="text-xs text-muted">Track recruiter check-ins and thank-you notes</p>
            </div>
          </div>

          {follow_ups.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }} className="text-sm text-muted">
              No follow-up reminders scheduled.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {follow_ups.map((f, i) => (
                <div
                  key={f.id || i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{f.type}</div>
                    <div className="text-xs text-muted">
                      Due: {new Date(f.due_at).toLocaleDateString()} {f.notes ? `• ${f.notes}` : ""}
                    </div>
                  </div>
                  <span className={`badge ${f.completed_at ? "badge-green" : "badge-amber"}`}>
                    {f.completed_at ? "Completed" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
