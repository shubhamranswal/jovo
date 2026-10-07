"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import type { ApplicationCapsule, ApplicationStatus, FollowUp } from "@jobos/contracts";
import { api } from "../../../lib/api";

interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  badge: string;
  badgeType: "blue" | "green" | "amber" | "gray";
  description: string;
}

interface QuestionItem {
  id: string;
  question: string;
  category: "Technical" | "Behavioral" | "Application-Specific" | "Application-Followup";
  why_asked: string;
  relevant_evidence: string;
  prep_notes: string;
  user_answer?: string | null;
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const applicationId = params?.id as string;

  const [capsule, setCapsule] = useState<ApplicationCapsule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "timeline" | "snapshot" | "documents" | "qa" | "prep" | "followups"
  >("timeline");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingPrep, setGeneratingPrep] = useState(false);

  // Follow-up state
  const [followUpType, setFollowUpType] = useState("interview_follow_up");
  const [followUpDate, setFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState<string | null>(null);

  // Question practice interactive notes (stored in local component state)
  const [practiceNotes, setPracticeNotes] = useState<Record<string, string>>({});
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState<string>("All");

  const reloadCapsule = async () => {
    if (!applicationId) return;
    try {
      const data = await api.getApplicationCapsule(applicationId);
      setCapsule(data);
    } catch (err: unknown) {
      console.error("Failed to reload capsule", err);
    }
  };

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
      await api.generateInterviewPrep(capsule.application.id, "Technical");
      await reloadCapsule();
      setActiveTab("prep");
    } catch (err: unknown) {
      alert(`Interview prep generation failed: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setGeneratingPrep(false);
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capsule || !followUpDate) return;
    setSubmittingFollowUp(true);
    try {
      const dueIso = new Date(followUpDate).toISOString();
      await api.createFollowUp(capsule.application.id, {
        type: followUpType,
        due_at: dueIso,
        notes: followUpNotes,
      });
      setFollowUpNotes("");
      await reloadCapsule();
    } catch (err: unknown) {
      alert(`Failed to schedule follow-up: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const handleUpdateFollowUp = async (
    followUpId: string,
    targetStatus: "Completed" | "Skipped" | "Pending"
  ) => {
    setUpdatingFollowUpId(followUpId);
    try {
      await api.updateFollowUp(followUpId, {
        status: targetStatus,
      });
      await reloadCapsule();
    } catch (err: unknown) {
      alert(`Failed to update follow-up: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setUpdatingFollowUpId(null);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: "60px", textAlign: "center" }}>
        <h2 className="headline-md">Accessing Application Memory...</h2>
        <p className="body-sm text-muted">Retrieving immutable Application Capsule snapshot.</p>
      </div>
    );
  }

  if (error || !capsule) {
    return (
      <div className="container" style={{ paddingTop: "60px" }}>
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <h2 className="headline-md" style={{ color: "var(--fit-gap-text)", marginBottom: "8px" }}>
            Application Capsule Not Found
          </h2>
          <p className="body-sm text-muted" style={{ marginBottom: "20px" }}>
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

  // Next pending follow-up banner
  const nextPendingFollowUp = follow_ups.find(
    (f: FollowUp) => f.status === "Pending" || !f.completed_at
  );

  // Latest interview prep data
  const latestInterview = interviews.length > 0 ? interviews[interviews.length - 1] : null;
  const prepJson = (latestInterview?.preparation_json as Record<string, any>) || {};
  const readiness = prepJson.readiness as
    { category: string; explanation: string; signals: string[] } | undefined;
  const structuredQuestions = (prepJson.structured_questions as QuestionItem[]) || [];
  const filteredQuestions =
    questionCategoryFilter === "All"
      ? structuredQuestions
      : structuredQuestions.filter((q) => q.category === questionCategoryFilter);

  // Build chronological timeline events
  const timelineEvents: TimelineEvent[] = [];

  if (application.created_at) {
    timelineEvents.push({
      id: "created",
      date: new Date(application.created_at),
      title: "Application Tracked in Jovo",
      badge: "Initialized",
      badgeType: "blue",
      description: `Application context established targeting ${application.target_role} at ${application.target_company}.`,
    });
  }

  if (snapshot?.captured_at) {
    timelineEvents.push({
      id: "snapshot",
      date: new Date(snapshot.captured_at),
      title: "Job Description Snapshot Frozen",
      badge: "Memory Captured",
      badgeType: "blue",
      description: `Captured from ${snapshot.captured_url || "application portal"}. Preserves original job requirements against later postings takedown or mutations.`,
    });
  }

  if (resumeDoc?.created_at) {
    timelineEvents.push({
      id: "resume",
      date: new Date(resumeDoc.created_at),
      title: `Tailored Resume Attached (${resumeDoc.version_label})`,
      badge: "Resume Frozen",
      badgeType: "blue",
      description:
        "Exact tailored resume submitted to employer preserved permanently in the Application Capsule.",
    });
  }

  if (coverLetterDoc?.created_at) {
    timelineEvents.push({
      id: "cover_letter",
      date: new Date(coverLetterDoc.created_at),
      title: `Tailored Cover Letter Attached (${coverLetterDoc.version_label})`,
      badge: "Letter Frozen",
      badgeType: "amber",
      description: `Company-specific cover letter tailored for ${application.target_company} locked into capsule.`,
    });
  }

  if (application.applied_at) {
    timelineEvents.push({
      id: "applied",
      date: new Date(application.applied_at),
      title: `Application Form Submitted (${application.status})`,
      badge: "Submitted",
      badgeType: "green",
      description: `Recorded submission on ${application.target_company} career portal. Status updated to ${application.status}.`,
    });
  }

  answers.forEach((ans, idx) => {
    timelineEvents.push({
      id: `ans-${idx}`,
      date: new Date(application.applied_at || application.created_at),
      title: `Form Answer Preserved: "${ans.question_text || `Field #${idx + 1}`}"`,
      badge: ans.user_approved ? "Candidate Approved" : "Draft Answer",
      badgeType: ans.user_approved ? "green" : "amber",
      description: `Submitted value: "${ans.answer_text}" (Source: ${ans.source || "Form Autofill"}).`,
    });
  });

  interviews.forEach((item, idx) => {
    timelineEvents.push({
      id: `prep-${idx}`,
      date: new Date(item.created_at || application.created_at),
      title: `${item.stage} Stage Interview Prep Generated`,
      badge: "Interview Prep",
      badgeType: "blue",
      description:
        item.notes || `Grounded preparation materials synthesized from frozen capsule state.`,
    });
  });

  follow_ups.forEach((f: FollowUp, idx: number) => {
    timelineEvents.push({
      id: `followup-due-${idx}`,
      date: new Date(f.due_at),
      title: `Follow-up Due: ${f.type.replace(/_/g, " ")}`,
      badge: "Scheduled",
      badgeType: "amber",
      description: f.notes ? `Note: ${f.notes}` : "Follow-up milestone scheduled.",
    });

    if (f.completed_at) {
      const isSkipped = f.status === "Skipped" || (f.notes && f.notes.includes("[SKIPPED]"));
      timelineEvents.push({
        id: `followup-done-${idx}`,
        date: new Date(f.completed_at),
        title: `Follow-up ${isSkipped ? "Skipped" : "Completed"}: ${f.type.replace(/_/g, " ")}`,
        badge: isSkipped ? "Skipped" : "Completed",
        badgeType: isSkipped ? "gray" : "green",
        description: isSkipped
          ? "Candidate explicitly marked this follow-up as skipped."
          : `Candidate completed this follow-up touchpoint for ${application.target_company}.`,
      });
    }
  });

  timelineEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="container" style={{ paddingTop: "32px" }}>
      {/* Breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <Link href="/applications" className="body-sm text-muted">
          ← Back to All Applications
        </Link>
        <span className="telemetry-xs text-muted">Capsule ID: {application.id}</span>
      </div>

      {/* Hero: The Application Capsule Visual Differentiator */}
      <div className="capsule-hero">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: "300px" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}
            >
              <div className="capsule-stamp">★ Application Capsule • Frozen Context</div>
              <span
                className={`badge ${
                  application.status === "Offer"
                    ? "badge-green"
                    : application.status === "Applied"
                      ? "badge-blue"
                      : "badge-amber"
                }`}
              >
                {application.status}
              </span>
            </div>

            <h1 className="headline-lg" style={{ fontSize: "1.9rem", marginBottom: "4px" }}>
              {application.target_role}
            </h1>
            <div
              className="body-md"
              style={{ color: "var(--ink-secondary)", marginBottom: "14px" }}
            >
              <strong style={{ color: "var(--ink-primary)" }}>{application.target_company}</strong>{" "}
              • Applied:{" "}
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {application.applied_at
                  ? new Date(application.applied_at).toLocaleDateString()
                  : new Date(application.created_at).toLocaleDateString()}
              </span>
              {application.source && ` • Source: ${application.source}`}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "10px",
                padding: "14px",
                background: "var(--bg-canvas)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-hairline)",
              }}
            >
              <div>
                <span className="telemetry-xs text-muted">1. TARGET JD</span>
                <div className="body-sm" style={{ fontWeight: 600 }}>
                  {snapshot ? "Frozen Snapshot" : "Catalog Spec"}
                </div>
              </div>
              <div>
                <span className="telemetry-xs text-muted">2. SUBMITTED RESUME</span>
                <div className="body-sm" style={{ fontWeight: 600 }}>
                  {resumeDoc ? resumeDoc.version_label : "Standard Profile"}
                </div>
              </div>
              <div>
                <span className="telemetry-xs text-muted">3. COVER LETTER</span>
                <div className="body-sm" style={{ fontWeight: 600 }}>
                  {coverLetterDoc ? coverLetterDoc.version_label : "Not Required"}
                </div>
              </div>
              <div>
                <span className="telemetry-xs text-muted">4. FORM Q&A</span>
                <div className="body-sm" style={{ fontWeight: 600 }}>
                  {answers.length} Preserved Answers
                </div>
              </div>
            </div>

            {/* Next Follow-up Alert Banner */}
            {nextPendingFollowUp && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  background: "var(--fit-moderate-bg)",
                  border: "1px solid var(--fit-moderate-border)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <span className="badge badge-amber">Next Follow-up</span>
                    <strong className="body-sm">
                      Due: {new Date(nextPendingFollowUp.due_at).toLocaleDateString()}
                    </strong>
                    <span className="telemetry-xs text-muted">
                      ({nextPendingFollowUp.type.replace(/_/g, " ")})
                    </span>
                  </div>
                  <div className="body-sm text-muted">
                    {nextPendingFollowUp.notes || "Follow-up action item pending."}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("followups")}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  Manage →
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions & Status Control */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              minWidth: "200px",
            }}
          >
            <div className="input-group">
              <label className="label">Update Status</label>
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
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "4px" }}
            >
              {generatingPrep ? "Synthesizing Prep..." : "⚡ Prepare for Interview"}
            </button>
          </div>
        </div>
      </div>

      {/* Editorial Navigation Tabs */}
      <div className="tabs-header">
        <button
          onClick={() => setActiveTab("timeline")}
          className={`tab-btn ${activeTab === "timeline" ? "active" : ""}`}
        >
          1. Journey & Memory Timeline ({timelineEvents.length})
        </button>
        <button
          onClick={() => setActiveTab("snapshot")}
          className={`tab-btn ${activeTab === "snapshot" ? "active" : ""}`}
        >
          2. Frozen Job Snapshot
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`tab-btn ${activeTab === "documents" ? "active" : ""}`}
        >
          3. Submitted Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("qa")}
          className={`tab-btn ${activeTab === "qa" ? "active" : ""}`}
        >
          4. Captured Answers ({answers.length})
        </button>
        <button
          onClick={() => setActiveTab("prep")}
          className={`tab-btn ${activeTab === "prep" ? "active" : ""}`}
        >
          5. Grounded Interview Prep ({interviews.length})
        </button>
        <button
          onClick={() => setActiveTab("followups")}
          className={`tab-btn ${activeTab === "followups" ? "active" : ""}`}
        >
          6. Follow-ups ({follow_ups.length})
        </button>
      </div>

      {/* Tab 1: Timeline View */}
      {activeTab === "timeline" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="headline-sm">Application Journey & Memory Timeline</h3>
              <p className="body-sm text-muted">
                Chronological audit trail of all actions, submissions, and preserved artifacts
              </p>
            </div>
            <span className="badge badge-blue">Audit Trail</span>
          </div>

          {timelineEvents.length === 0 ? (
            <div className="body-sm text-muted" style={{ textAlign: "center", padding: "40px 0" }}>
              No timeline milestones recorded yet.
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                paddingLeft: "28px",
                borderLeft: "2px solid var(--border-hairline)",
                marginLeft: "12px",
                marginTop: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "28px",
              }}
            >
              {timelineEvents.map((evt) => (
                <div key={evt.id} style={{ position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: "-35px",
                      top: "2px",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background:
                        evt.badgeType === "green"
                          ? "#059669"
                          : evt.badgeType === "amber"
                            ? "#d97706"
                            : evt.badgeType === "gray"
                              ? "#94a3b8"
                              : "#0284c7",
                      border: "2px solid #ffffff",
                      boxShadow: "0 0 0 1px var(--border-hairline)",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "4px",
                    }}
                  >
                    <span className={`badge badge-${evt.badgeType}`}>{evt.badge}</span>
                    <span className="telemetry-xs text-muted">{evt.date.toLocaleString()}</span>
                  </div>

                  <h4 className="headline-sm" style={{ fontSize: "0.95rem", marginBottom: "4px" }}>
                    {evt.title}
                  </h4>
                  <p
                    className="body-sm"
                    style={{ color: "var(--ink-secondary)", lineHeight: "1.5" }}
                  >
                    {evt.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Exact Job Description Snapshot */}
      {activeTab === "snapshot" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="headline-sm">Frozen Job Description Snapshot</h3>
              <p className="body-sm text-muted">
                Captured on{" "}
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {snapshot?.captured_at
                    ? new Date(snapshot.captured_at).toLocaleString()
                    : "Submission"}
                </span>{" "}
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
            className="body-sm"
            style={{
              lineHeight: "1.7",
              color: "var(--ink-body)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "500px",
              overflowY: "auto",
              background: "var(--bg-canvas)",
              padding: "20px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-hairline)",
            }}
          >
            {(snapshot?.form_fields_json?.job_description as string) ||
              snapshot?.raw_page_text_snippet ||
              (application.job_snapshot_json?.job_description as string) ||
              "No textual snapshot preserved."}
          </div>
        </div>
      )}

      {/* Tab 3: Submitted Documents (Exact Resume & Cover Letter Content) */}
      {activeTab === "documents" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="headline-sm">Submitted Resume Version</h3>
                <p className="body-sm text-muted">
                  {resumeDoc ? resumeDoc.version_label : "No resume version linked"}
                </p>
              </div>
              <span className="badge badge-blue">Submitted Version</span>
            </div>

            <div className="telemetry-xs text-muted" style={{ marginBottom: "12px" }}>
              Linked Document ID: {resumeDoc?.document_id || "None"}
            </div>

            <div
              className="pre-box"
              style={{ maxHeight: "420px", overflowY: "auto", whiteSpace: "pre-wrap" }}
            >
              {resumeDoc?.content ||
                (resumeDoc
                  ? `Resume Version: ${resumeDoc.version_label}\n\nPreserved immutable in Jovo Application Capsule.\nThis is the exact tailored resume submitted to ${application.target_company}.`
                  : "No resume document registered.")}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="headline-sm">Submitted Cover Letter</h3>
                <p className="body-sm text-muted">
                  {coverLetterDoc ? coverLetterDoc.version_label : "No cover letter linked"}
                </p>
              </div>
              <span className="badge badge-amber">Cover Letter</span>
            </div>

            <div className="telemetry-xs text-muted" style={{ marginBottom: "12px" }}>
              Linked Document ID: {coverLetterDoc?.document_id || "None"}
            </div>

            <div
              className="pre-box"
              style={{ maxHeight: "420px", overflowY: "auto", whiteSpace: "pre-wrap" }}
            >
              {coverLetterDoc?.content ||
                (coverLetterDoc
                  ? `Cover Letter: ${coverLetterDoc.version_label}\n\nCompany: ${application.target_company}\nPreserved immutable in Jovo Application Capsule.`
                  : "No cover letter document registered.")}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Captured Questions & Answers */}
      {activeTab === "qa" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="headline-sm">Captured Form Questions & Answers</h3>
              <p className="body-sm text-muted">
                Recorded from the Workday or generic web application form
              </p>
            </div>
            <span className="badge badge-blue">{answers.length} Answers Recorded</span>
          </div>

          {answers.length === 0 ? (
            <div className="body-sm text-muted" style={{ textAlign: "center", padding: "40px 0" }}>
              No custom application form fields were captured for this submission.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {answers.map((ans, i) => (
                <div
                  key={ans.id || i}
                  style={{
                    padding: "16px",
                    background: "var(--bg-canvas)",
                    border: "1px solid var(--border-hairline)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <div className="label" style={{ marginBottom: 0 }}>
                      {ans.question_text || `Question ${i + 1}`}
                    </div>
                    <span className={`badge ${ans.user_approved ? "badge-green" : "badge-amber"}`}>
                      {ans.user_approved ? "✓ Approved by Candidate" : "⚠ Draft Answer"}
                    </span>
                  </div>

                  <div
                    className="body-sm"
                    style={{
                      fontWeight: 500,
                      marginBottom: "8px",
                      background: "#ffffff",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-hairline)",
                    }}
                  >
                    {ans.answer_text}
                  </div>

                  <div className="telemetry-xs text-muted">
                    Source: {ans.source || "Extension Autofill"} • Preserved in Capsule
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Grounded Interview Preparation */}
      {activeTab === "prep" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="card">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <div>
                <h3 className="headline-sm">Grounded Interview Preparation</h3>
                <p className="body-sm text-muted">
                  Synthesized strictly from the frozen JD, exact submitted resume, approved form
                  answers, and verified career evidence
                </p>
              </div>
              <button
                onClick={handleTriggerPrep}
                disabled={generatingPrep}
                className="btn btn-primary btn-sm"
              >
                {generatingPrep ? "Regenerating..." : "⚡ Regenerate Prep"}
              </button>
            </div>
          </div>

          {interviews.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🎯</div>
              <h3 className="headline-sm" style={{ marginBottom: "8px" }}>
                Ready to Prepare for {application.target_role} at {application.target_company}?
              </h3>
              <p
                className="body-sm text-muted"
                style={{ maxWidth: "600px", margin: "0 auto 24px" }}
              >
                Jovo will analyze your exact submitted materials, identify likely technical and
                behavioral questions, detect any profile evidence gaps, and prepare you for
                interviewer probing on your submitted answers.
              </p>
              <button
                onClick={handleTriggerPrep}
                disabled={generatingPrep}
                className="btn btn-primary"
              >
                {generatingPrep ? "Analyzing Capsule..." : "Prepare for Interview"}
              </button>
            </div>
          ) : (
            <>
              {/* Role Summary Banner */}
              {prepJson.role_summary && (
                <div
                  className="card"
                  style={{
                    borderLeft: "4px solid var(--brand-primary)",
                    background: "var(--bg-canvas)",
                  }}
                >
                  <h4
                    className="label"
                    style={{
                      color: "var(--ink-primary)",
                      marginBottom: "6px",
                    }}
                  >
                    Employer Priorities (From Frozen JD)
                  </h4>
                  <p className="body-sm" style={{ lineHeight: "1.6" }}>
                    {prepJson.role_summary}
                  </p>
                </div>
              )}

              {/* Explainable Readiness Model */}
              {readiness && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h4 className="headline-sm">Interview Readiness Assessment</h4>
                      <p className="body-sm text-muted">
                        Explainable fit analysis based on verified evidence vs. job requirements (no
                        fake percentages)
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        readiness.category === "Strong"
                          ? "badge-green"
                          : readiness.category === "Evidence Gap"
                            ? "badge-amber"
                            : "badge-blue"
                      }`}
                      style={{ fontSize: "0.85rem", padding: "4px 12px" }}
                    >
                      Readiness: {readiness.category}
                    </span>
                  </div>

                  <p className="body-sm" style={{ marginBottom: "16px", lineHeight: "1.6" }}>
                    {readiness.explanation}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      background: "var(--bg-canvas)",
                      padding: "14px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-hairline)",
                    }}
                  >
                    <div className="label">Readiness Signals:</div>
                    {readiness.signals?.map((sig: string, idx: number) => (
                      <div
                        key={idx}
                        className="body-sm"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "var(--ink-secondary)",
                        }}
                      >
                        <span style={{ color: "var(--accent-action)" }}>•</span> {sig}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flagged Evidence Gaps (Anti-Hallucination) */}
              {prepJson.evidence_gaps && prepJson.evidence_gaps.length > 0 && (
                <div
                  className="card"
                  style={{
                    border: "1px solid var(--fit-moderate-border)",
                    background: "var(--fit-moderate-bg)",
                  }}
                >
                  <div className="card-header">
                    <div>
                      <h4 className="headline-sm" style={{ color: "var(--fit-moderate-text)" }}>
                        ⚠️ Stated Job Requirements Lacking Verified Evidence
                      </h4>
                      <p className="body-sm text-muted">
                        Jovo strictly avoids inventing candidate background. Be prepared to address
                        how you bridge these areas:
                      </p>
                    </div>
                    <span className="badge badge-amber">
                      {prepJson.evidence_gaps.length} Gaps Flagged
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {prepJson.evidence_gaps.map((gap: string, i: number) => (
                      <div
                        key={i}
                        className="body-sm"
                        style={{
                          padding: "8px 12px",
                          background: "#ffffff",
                          borderRadius: "var(--radius-sm)",
                          color: "#78350f",
                          borderLeft: "3px solid #d97706",
                        }}
                      >
                        {gap}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Practice Likely Questions */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h4 className="headline-sm">Grounded Practice Questions</h4>
                    <p className="body-sm text-muted">
                      Derived from required technologies, submitted resume accomplishments, and
                      approved form answers
                    </p>
                  </div>
                  {/* Category Filter */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[
                      "All",
                      "Technical",
                      "Behavioral",
                      "Application-Specific",
                      "Application-Followup",
                    ].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setQuestionCategoryFilter(cat)}
                        className={`btn btn-sm ${questionCategoryFilter === cat ? "btn-primary" : "btn-secondary"}`}
                        style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredQuestions.length === 0 ? (
                  <div
                    className="body-sm text-muted"
                    style={{ textAlign: "center", padding: "30px 0" }}
                  >
                    No questions under this category.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {filteredQuestions.map((q, idx) => {
                      const isEvidenceGap =
                        q.relevant_evidence.includes("Evidence not found") ||
                        q.relevant_evidence.includes("unverified");
                      return (
                        <div
                          key={q.id || idx}
                          style={{
                            padding: "18px",
                            background: "var(--bg-canvas)",
                            border: "1px solid var(--border-hairline)",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginBottom: "10px",
                              gap: "10px",
                            }}
                          >
                            <span
                              className={`badge ${
                                q.category === "Technical"
                                  ? "badge-blue"
                                  : q.category === "Behavioral"
                                    ? "badge-green"
                                    : "badge-amber"
                              }`}
                            >
                              {q.category}
                            </span>
                            <span className="telemetry-xs text-muted">Question #{idx + 1}</span>
                          </div>

                          <h5
                            style={{
                              fontFamily: "var(--font-display)",
                              fontSize: "1rem",
                              fontWeight: 600,
                              marginBottom: "10px",
                              lineHeight: "1.4",
                              color: "var(--ink-primary)",
                            }}
                          >
                            {q.question}
                          </h5>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "12px",
                              marginBottom: "14px",
                            }}
                          >
                            <div
                              style={{
                                padding: "10px",
                                background: "#ffffff",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border-hairline)",
                              }}
                            >
                              <div className="label" style={{ marginBottom: "4px" }}>
                                Why it may be asked:
                              </div>
                              <p className="body-sm text-muted">{q.why_asked}</p>
                            </div>

                            <div
                              style={{
                                padding: "10px",
                                background: isEvidenceGap ? "var(--fit-moderate-bg)" : "#ffffff",
                                borderRadius: "var(--radius-sm)",
                                border: isEvidenceGap
                                  ? "1px solid var(--fit-moderate-border)"
                                  : "1px solid var(--border-hairline)",
                              }}
                            >
                              <div className="label" style={{ marginBottom: "4px" }}>
                                Relevant Evidence Backing:
                              </div>
                              <p
                                className="body-sm"
                                style={{
                                  color: isEvidenceGap
                                    ? "var(--fit-moderate-text)"
                                    : "var(--ink-secondary)",
                                }}
                              >
                                {q.relevant_evidence}
                              </p>
                            </div>
                          </div>

                          <div style={{ marginBottom: "12px" }}>
                            <div className="label" style={{ marginBottom: "4px" }}>
                              Preparation Advice & Strategy:
                            </div>
                            <p className="body-sm text-muted" style={{ lineHeight: "1.5" }}>
                              {q.prep_notes}
                            </p>
                          </div>

                          {/* Candidate Practice Box */}
                          <div style={{ marginTop: "10px" }}>
                            <label className="label" style={{ marginBottom: "4px" }}>
                              Your Practice Talking Points / Answer:
                            </label>
                            <textarea
                              className="input"
                              rows={2}
                              placeholder="Jot down your key STAR bullet points or talking points for this question..."
                              value={practiceNotes[q.id] || ""}
                              onChange={(e) =>
                                setPracticeNotes({ ...practiceNotes, [q.id]: e.target.value })
                              }
                              style={{ width: "100%", resize: "vertical" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Questions to Ask Interviewers */}
              {prepJson.questions_to_ask && prepJson.questions_to_ask.length > 0 && (
                <div className="card">
                  <h4 className="headline-sm" style={{ marginBottom: "8px" }}>
                    Strategic Questions to Ask Interviewers
                  </h4>
                  <p className="body-sm text-muted" style={{ marginBottom: "14px" }}>
                    High-signal questions demonstrating depth in system design, operational
                    ownership, and roadmap execution:
                  </p>
                  <ul
                    style={{
                      paddingLeft: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {prepJson.questions_to_ask.map((item: string, i: number) => (
                      <li key={i} className="body-sm" style={{ color: "var(--ink-secondary)" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preparation Checklist */}
              {prepJson.preparation_checklist && prepJson.preparation_checklist.length > 0 && (
                <div className="card">
                  <h4 className="headline-sm" style={{ marginBottom: "8px" }}>
                    Pre-Interview Checklist Grounded in Capsule
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {prepJson.preparation_checklist.map((item: string, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 12px",
                          background: "var(--bg-canvas)",
                          border: "1px solid var(--border-hairline)",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        <span style={{ color: "var(--brand-primary)", fontWeight: 700 }}>✓</span>
                        <span className="body-sm text-muted">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 6: Follow-up Reminders & Timeline Tracker */}
      {activeTab === "followups" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Schedule New Follow-up Form */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="headline-sm">Schedule Follow-up Action</h3>
                <p className="body-sm text-muted">
                  Keep track of thank-you emails, recruiter check-ins, and timeline commitments
                  (reminders only; no automated emails sent)
                </p>
              </div>
              <span className="badge badge-amber">Action Item</span>
            </div>

            <form
              onSubmit={handleCreateFollowUp}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 2fr auto",
                gap: "12px",
                alignItems: "flex-end",
              }}
            >
              <div className="input-group">
                <label className="label">Follow-up Type</label>
                <select
                  className="input"
                  value={followUpType}
                  onChange={(e) => setFollowUpType(e.target.value)}
                  style={{ padding: "8px 10px", fontSize: "0.85rem" }}
                >
                  <option value="interview_follow_up">Interview Follow-up</option>
                  <option value="recruiter_follow_up">Recruiter Check-in</option>
                  <option value="application_follow_up">Application Status Inquiry</option>
                  <option value="custom">Custom Follow-up</option>
                </select>
              </div>

              <div className="input-group">
                <label className="label">Due Date</label>
                <input
                  type="date"
                  className="input"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  style={{ padding: "8px 10px", fontSize: "0.85rem" }}
                  required
                />
              </div>

              <div className="input-group">
                <label className="label">Notes / Context</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Send thank-you note referencing the consensus protocol discussion..."
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  style={{ padding: "8px 10px", fontSize: "0.85rem" }}
                />
              </div>

              <button
                type="submit"
                disabled={submittingFollowUp}
                className="btn btn-primary"
                style={{ height: "38px" }}
              >
                {submittingFollowUp ? "Scheduling..." : "+ Schedule"}
              </button>
            </form>
          </div>

          {/* Follow-up List */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="headline-sm">Scheduled Follow-ups</h3>
                <p className="body-sm text-muted">
                  Historical and upcoming touchpoints for {application.target_company}
                </p>
              </div>
              <span className="badge badge-blue">{follow_ups.length} Registered</span>
            </div>

            {follow_ups.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "40px 0" }}
                className="body-sm text-muted"
              >
                No follow-up reminders scheduled yet. Schedule one above!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {follow_ups.map((f: FollowUp, i: number) => {
                  const isDone = f.completed_at && f.status !== "Skipped";
                  const isSkipped =
                    f.status === "Skipped" || (f.notes && f.notes.includes("[SKIPPED]"));
                  return (
                    <div
                      key={f.id || i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px",
                        background: "var(--bg-canvas)",
                        border: "1px solid var(--border-hairline)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            className={`badge ${
                              isDone ? "badge-green" : isSkipped ? "badge-gray" : "badge-amber"
                            }`}
                          >
                            {isDone ? "Completed" : isSkipped ? "Skipped" : "Pending"}
                          </span>
                          <strong className="body-sm">{f.type.replace(/_/g, " ")}</strong>
                        </div>

                        <div className="telemetry-xs text-muted">
                          Due: {new Date(f.due_at).toLocaleDateString()}{" "}
                          {f.completed_at
                            ? `• ${isSkipped ? "Skipped" : "Completed"}: ${new Date(f.completed_at).toLocaleDateString()}`
                            : ""}{" "}
                          {f.notes ? `• ${f.notes.replace("[SKIPPED]", "").trim()}` : ""}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        {!f.completed_at ? (
                          <>
                            <button
                              onClick={() => handleUpdateFollowUp(f.id, "Completed")}
                              disabled={updatingFollowUpId === f.id}
                              className="btn btn-outline btn-sm"
                              style={{
                                color: "var(--fit-high-text)",
                                borderColor: "var(--fit-high-border)",
                              }}
                            >
                              ✓ Mark Complete
                            </button>
                            <button
                              onClick={() => handleUpdateFollowUp(f.id, "Skipped")}
                              disabled={updatingFollowUpId === f.id}
                              className="btn btn-secondary btn-sm"
                            >
                              ⏭ Skip
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleUpdateFollowUp(f.id, "Pending")}
                            disabled={updatingFollowUpId === f.id}
                            className="btn btn-secondary btn-sm"
                          >
                            ↩ Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
