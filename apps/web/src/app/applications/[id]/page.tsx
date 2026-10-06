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
      title: "Application Tracked in JobOS",
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
    // Scheduled event
    timelineEvents.push({
      id: `followup-due-${idx}`,
      date: new Date(f.due_at),
      title: `Follow-up Due: ${f.type.replace(/_/g, " ")}`,
      badge: "Scheduled",
      badgeType: "amber",
      description: f.notes ? `Note: ${f.notes}` : "Follow-up milestone scheduled.",
    });

    // Completed or Skipped event
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

            {/* Next Follow-up Alert Banner */}
            {nextPendingFollowUp && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  background: "rgba(245, 158, 11, 0.08)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  maxWidth: "700px",
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
                    <strong style={{ fontSize: "0.85rem" }}>
                      Due: {new Date(nextPendingFollowUp.due_at).toLocaleDateString()}
                    </strong>
                    <span className="text-xs text-muted">
                      ({nextPendingFollowUp.type.replace(/_/g, " ")})
                    </span>
                  </div>
                  <div className="text-xs text-dim">
                    {nextPendingFollowUp.notes || "Follow-up action item pending."}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("followups")}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: "0.75rem", padding: "6px 12px" }}
                >
                  Manage →
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions & Status Control */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "200px" }}>
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
              className="btn btn-primary btn-sm"
              style={{ width: "100%", marginTop: "4px" }}
            >
              {generatingPrep ? "Synthesizing Prep..." : "⚡ Prepare for Interview"}
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
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("timeline")}
          className={`btn ${activeTab === "timeline" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          1. Timeline ({timelineEvents.length})
        </button>
        <button
          onClick={() => setActiveTab("snapshot")}
          className={`btn ${activeTab === "snapshot" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          2. Exact Job Snapshot
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`btn ${activeTab === "documents" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          3. Submitted Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("qa")}
          className={`btn ${activeTab === "qa" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          4. Captured Answers ({answers.length})
        </button>
        <button
          onClick={() => setActiveTab("prep")}
          className={`btn ${activeTab === "prep" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          5. Interview Prep ({interviews.length})
        </button>
        <button
          onClick={() => setActiveTab("followups")}
          className={`btn ${activeTab === "followups" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          6. Follow-ups ({follow_ups.length})
        </button>
      </div>

      {/* Tab 1: Timeline View */}
      {activeTab === "timeline" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="title-md">Application Journey & Memory Timeline</h3>
              <p className="text-xs text-muted">
                Chronological audit trail of all actions, submissions, and preserved artifacts
              </p>
            </div>
            <span className="badge badge-blue">Audit Trail</span>
          </div>

          {timelineEvents.length === 0 ? (
            <div className="text-sm text-muted" style={{ textAlign: "center", padding: "40px 0" }}>
              No timeline milestones recorded yet.
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                paddingLeft: "28px",
                borderLeft: "2px solid var(--border-color)",
                marginLeft: "12px",
                marginTop: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "28px",
              }}
            >
              {timelineEvents.map((evt) => (
                <div key={evt.id} style={{ position: "relative" }}>
                  {/* Timeline indicator node */}
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
                          ? "#34d399"
                          : evt.badgeType === "amber"
                            ? "#fbbf24"
                            : evt.badgeType === "gray"
                              ? "#94a3b8"
                              : "#60a5fa",
                      border: "2px solid var(--bg-card)",
                      boxShadow: "0 0 0 2px var(--border-color)",
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
                    <span className="text-xs text-muted">{evt.date.toLocaleString()}</span>
                  </div>

                  <h4
                    className="title-sm"
                    style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "4px" }}
                  >
                    {evt.title}
                  </h4>
                  <p className="text-sm text-dim" style={{ lineHeight: "1.5" }}>
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

      {/* Tab 3: Submitted Documents (Exact Resume & Cover Letter Content) */}
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

            <div
              className="pre-box"
              style={{ maxHeight: "420px", overflowY: "auto", whiteSpace: "pre-wrap" }}
            >
              {resumeDoc?.content ||
                (resumeDoc
                  ? `Resume Version: ${resumeDoc.version_label}\n\nPreserved immutable in JobOS Application Capsule.\nThis is the exact tailored resume submitted to ${application.target_company}.`
                  : "No resume document registered.")}
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

            <div
              className="pre-box"
              style={{ maxHeight: "420px", overflowY: "auto", whiteSpace: "pre-wrap" }}
            >
              {coverLetterDoc?.content ||
                (coverLetterDoc
                  ? `Cover Letter: ${coverLetterDoc.version_label}\n\nCompany: ${application.target_company}\nPreserved immutable in JobOS Application Capsule.`
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
              <h3 className="title-md">Captured Form Questions & Answers</h3>
              <p className="text-xs text-muted">
                Recorded from the Workday or generic web application form
              </p>
            </div>
            <span className="badge badge-blue">{answers.length} Answers Recorded</span>
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <div className="label" style={{ marginBottom: 0, fontWeight: "600" }}>
                      {ans.question_text || `Question ${i + 1}`}
                    </div>
                    <span className={`badge ${ans.user_approved ? "badge-green" : "badge-amber"}`}>
                      {ans.user_approved ? "✓ Approved by Candidate" : "⚠ Draft Answer"}
                    </span>
                  </div>

                  <div
                    className="text-sm"
                    style={{
                      fontWeight: "500",
                      marginBottom: "8px",
                      background: "rgba(255,255,255,0.03)",
                      padding: "10px 12px",
                      borderRadius: "4px",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {ans.answer_text}
                  </div>

                  <div className="text-xs text-dim">
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
          {/* Header Action */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <div>
                <h3 className="title-md">Grounded Interview Preparation</h3>
                <p className="text-xs text-muted">
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
              <h3 className="title-md" style={{ marginBottom: "8px" }}>
                Ready to Prepare for {application.target_role} at {application.target_company}?
              </h3>
              <p
                className="text-sm text-muted"
                style={{ maxWidth: "600px", margin: "0 auto 24px" }}
              >
                JobOS will analyze your exact submitted materials, identify likely technical and
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
                    borderLeft: "4px solid var(--primary)",
                    background: "rgba(37, 99, 235, 0.05)",
                  }}
                >
                  <h4
                    className="title-sm"
                    style={{
                      color: "var(--primary)",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontSize: "0.75rem",
                    }}
                  >
                    Employer Priorities (From Frozen JD)
                  </h4>
                  <p className="text-sm" style={{ lineHeight: "1.6", color: "#e2e8f0" }}>
                    {prepJson.role_summary}
                  </p>
                </div>
              )}

              {/* Explainable Readiness Model */}
              {readiness && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h4 className="title-sm">Interview Readiness Assessment</h4>
                      <p className="text-xs text-muted">
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

                  <p
                    className="text-sm"
                    style={{ marginBottom: "16px", lineHeight: "1.6", color: "#cbd5e1" }}
                  >
                    {readiness.explanation}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      background: "var(--bg-subtle)",
                      padding: "14px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <div
                      className="label"
                      style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
                    >
                      Readiness Signals:
                    </div>
                    {readiness.signals?.map((sig: string, idx: number) => (
                      <div
                        key={idx}
                        className="text-xs text-dim"
                        style={{ display: "flex", alignItems: "center", gap: "8px" }}
                      >
                        <span style={{ color: "var(--primary)" }}>•</span> {sig}
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
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    background: "rgba(245, 158, 11, 0.04)",
                  }}
                >
                  <div className="card-header">
                    <div>
                      <h4 className="title-sm" style={{ color: "#fbbf24" }}>
                        ⚠️ Stated Job Requirements Lacking Verified Evidence
                      </h4>
                      <p className="text-xs text-muted">
                        JobOS strictly avoids inventing candidate background. Be prepared to address
                        how you ramp up or bridge these areas:
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
                        className="text-xs"
                        style={{
                          padding: "8px 12px",
                          background: "rgba(0,0,0,0.2)",
                          borderRadius: "4px",
                          color: "#fde68a",
                          borderLeft: "3px solid #fbbf24",
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
                    <h4 className="title-sm">Grounded Practice Questions</h4>
                    <p className="text-xs text-muted">
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
                    className="text-sm text-muted"
                    style={{ textAlign: "center", padding: "30px 0" }}
                  >
                    No questions under this category.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {filteredQuestions.map((q, idx) => {
                      const isEvidenceGap =
                        q.relevant_evidence.includes("Evidence not found") ||
                        q.relevant_evidence.includes("unverified");
                      return (
                        <div
                          key={q.id || idx}
                          style={{
                            padding: "18px",
                            background: "var(--bg-subtle)",
                            border: "1px solid var(--border-color)",
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
                            <span className="text-xs text-dim">Question #{idx + 1}</span>
                          </div>

                          <h5
                            style={{
                              fontSize: "1rem",
                              fontWeight: "600",
                              marginBottom: "10px",
                              lineHeight: "1.4",
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
                                background: "rgba(255,255,255,0.02)",
                                borderRadius: "4px",
                              }}
                            >
                              <div
                                className="label"
                                style={{ fontSize: "0.7rem", marginBottom: "4px" }}
                              >
                                Why it may be asked:
                              </div>
                              <p className="text-xs text-dim">{q.why_asked}</p>
                            </div>

                            <div
                              style={{
                                padding: "10px",
                                background: isEvidenceGap
                                  ? "rgba(245, 158, 11, 0.05)"
                                  : "rgba(255,255,255,0.02)",
                                borderRadius: "4px",
                                border: isEvidenceGap
                                  ? "1px solid rgba(245, 158, 11, 0.2)"
                                  : "none",
                              }}
                            >
                              <div
                                className="label"
                                style={{ fontSize: "0.7rem", marginBottom: "4px" }}
                              >
                                Relevant Evidence Backing:
                              </div>
                              <p
                                className="text-xs"
                                style={{ color: isEvidenceGap ? "#fbbf24" : "var(--text-muted)" }}
                              >
                                {q.relevant_evidence}
                              </p>
                            </div>
                          </div>

                          <div style={{ marginBottom: "12px" }}>
                            <div
                              className="label"
                              style={{ fontSize: "0.7rem", marginBottom: "4px" }}
                            >
                              Preparation Advice & Strategy:
                            </div>
                            <p className="text-xs text-muted" style={{ lineHeight: "1.5" }}>
                              {q.prep_notes}
                            </p>
                          </div>

                          {/* Candidate Practice Box */}
                          <div style={{ marginTop: "10px" }}>
                            <label
                              className="label"
                              style={{ fontSize: "0.7rem", marginBottom: "4px" }}
                            >
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
                              style={{ fontSize: "0.85rem", width: "100%", resize: "vertical" }}
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
                  <h4 className="title-sm" style={{ marginBottom: "8px" }}>
                    Strategic Questions to Ask Interviewers
                  </h4>
                  <p className="text-xs text-muted" style={{ marginBottom: "14px" }}>
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
                      <li key={i} className="text-sm text-dim">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preparation Checklist */}
              {prepJson.preparation_checklist && prepJson.preparation_checklist.length > 0 && (
                <div className="card">
                  <h4 className="title-sm" style={{ marginBottom: "8px" }}>
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
                          background: "var(--bg-subtle)",
                          borderRadius: "4px",
                        }}
                      >
                        <span style={{ color: "var(--primary)" }}>✓</span>
                        <span className="text-xs text-dim">{item}</span>
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
                <h3 className="title-md">Schedule Follow-up Action</h3>
                <p className="text-xs text-muted">
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
                <label className="label" style={{ fontSize: "0.75rem" }}>
                  Follow-up Type
                </label>
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
                <label className="label" style={{ fontSize: "0.75rem" }}>
                  Due Date
                </label>
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
                <label className="label" style={{ fontSize: "0.75rem" }}>
                  Notes / Context
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Send thank-you note referencing the Raft consensus discussion..."
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
                <h3 className="title-md">Scheduled Follow-ups</h3>
                <p className="text-xs text-muted">
                  Historical and upcoming touchpoints for {application.target_company}
                </p>
              </div>
              <span className="badge badge-blue">{follow_ups.length} Registered</span>
            </div>

            {follow_ups.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "40px 0" }}
                className="text-sm text-muted"
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
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border-color)",
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
                          <strong style={{ fontSize: "0.95rem" }}>
                            {f.type.replace(/_/g, " ")}
                          </strong>
                        </div>

                        <div className="text-xs text-muted">
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
                              style={{ color: "var(--success)", borderColor: "var(--success)" }}
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
