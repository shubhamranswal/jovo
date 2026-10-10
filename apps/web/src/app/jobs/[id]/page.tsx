"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import type { CareerProfile, Job, JobMatch } from "@jobos/contracts";
import { api } from "../../../lib/api";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluatingMatch, setEvaluatingMatch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!jobId) return;
      setLoading(true);
      setError(null);
      try {
        const [jobData, profileData] = await Promise.all([
          api.getJob(jobId),
          api.getActiveProfile(),
        ]);
        setJob(jobData);
        setProfile(profileData);

        // Fetch or calculate match
        try {
          const matchData = await api.getJobMatch(jobId, profileData.id);
          setMatch(matchData);
        } catch {
          // If no match stored yet, calculate it
          const calculated = await api.calculateJobMatch(jobId, profileData.id);
          setMatch(calculated);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load job details";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [jobId]);

  const handleRecalculateMatch = async () => {
    if (!profile) return;
    setEvaluatingMatch(true);
    try {
      const calculated = await api.calculateJobMatch(jobId, profile.id);
      setMatch(calculated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to recalculate match";
      setError(msg);
    } finally {
      setEvaluatingMatch(false);
    }
  };

  const getMatchDialClass = (score: number) => {
    if (score >= 88) return "match-dial-high";
    if (score >= 75) return "match-dial-strong";
    if (score >= 60) return "match-dial-moderate";
    return "match-dial-gap";
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: "60px", textAlign: "center" }}>
        <h2 className="headline-md">Loading Job Context & Match Engine...</h2>
        <p className="body-sm text-muted">Retrieving grounded profile evidence...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container" style={{ paddingTop: "60px" }}>
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <h2 className="headline-md" style={{ color: "var(--fit-gap-text)", marginBottom: "8px" }}>
            Job Not Found or Error
          </h2>
          <p className="body-sm text-muted" style={{ marginBottom: "20px" }}>
            {error || "Could not retrieve the requested job."}
          </p>
          <Link href="/jobs" className="btn btn-secondary">
            Back to Job Discovery
          </Link>
        </div>
      </div>
    );
  }

  const reqs = job.normalized_requirements_json || [];

  return (
    <div className="container" style={{ paddingTop: "32px" }}>
      {/* Breadcrumb / Top Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <Link
          href="/jobs"
          className="body-sm text-muted"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          ← Back to Discovery
        </Link>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {job.canonical_url && (
            <a
              href={job.canonical_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span>Apply on {job.source_names_json?.[0] || "Employer Portal"}</span>
              <span>↗</span>
            </a>
          )}
          <button onClick={() => router.push(`/jobs/${job.id}/tailor`)} className="btn btn-primary">
            Tailor Application Materials →
          </button>
        </div>
      </div>

      {/* Main Job Header */}
      <div className="card" style={{ marginBottom: "28px", padding: "28px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "24px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
                flexWrap: "wrap",
              }}
            >
              <h1 className="headline-lg" style={{ fontSize: "1.75rem" }}>
                {job.title}
              </h1>
              {job.metadata_json?.is_demo || job.source_names_json?.includes("Demo Fixture") ? (
                <span className="badge badge-amber">DEMO FIXTURE</span>
              ) : (
                <span className="badge badge-blue">LIVE SERPAPI RESULT</span>
              )}
              {job.remote_type && <span className="badge badge-green">{job.remote_type}</span>}
              {job.employment_type && (
                <span className="badge badge-gray">{job.employment_type}</span>
              )}
            </div>

            <div
              className="body-md"
              style={{ color: "var(--ink-secondary)", marginBottom: "12px" }}
            >
              <strong style={{ color: "var(--ink-primary)" }}>
                {job.company_name || "Company"}
              </strong>{" "}
              • {job.location || "Anywhere"}
              {job.salary_min && (
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {" "}
                  • {job.currency || "$"}
                  {job.salary_min.toLocaleString()}
                  {job.salary_max ? ` - ${job.salary_max.toLocaleString()}` : "+"}
                </span>
              )}
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: "14px" }}
              className="telemetry-xs text-muted"
            >
              <span>Fingerprint: {job.fingerprint.slice(0, 12)}...</span>
              {job.canonical_url && (
                <a
                  href={job.canonical_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent-action)", textDecoration: "none" }}
                >
                  Original Source Posting ↗
                </a>
              )}
            </div>
          </div>

          {/* Match Score Display */}
          {match && (
            <div style={{ textAlign: "right" }}>
              <div
                className={`match-dial-pill ${getMatchDialClass(match.overall_score)}`}
                style={{ fontSize: "1.75rem", padding: "6px 18px" }}
              >
                {match.overall_score}%
              </div>
              <div className="telemetry-xs text-muted" style={{ marginTop: "4px" }}>
                Grounded Fit Alignment
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Job Info & Requirements (Left) & Explainable Match Inspector (Right) */}
      <div className="grid-sidebar">
        {/* Left Column: Job Description and Requirements */}
        <div>
          {/* Live Application Sources from SerpApi */}
          {job.source_urls_json && job.source_urls_json.length > 0 && (
            <div className="card" style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <h3 className="headline-sm">Live Application Sources</h3>
                <span className="telemetry-xs badge badge-blue">Real Job Links</span>
              </div>
              <p className="body-sm text-muted" style={{ marginBottom: "14px" }}>
                Apply directly to this employer. The Jovo Chrome Extension automatically detects
                these portals to assist with verified profile autofill, custom Q&A drafting, and
                freezing the permanent Application Capsule.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {job.source_urls_json.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <span>{job.source_names_json?.[idx] || `Application Source ${idx + 1}`}</span>
                    <span>↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Normalized Requirements */}
          {reqs.length > 0 && (
            <div className="card" style={{ marginBottom: "24px" }}>
              <h3 className="headline-sm" style={{ marginBottom: "14px" }}>
                Key Technical Requirements
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {reqs.map((req, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-canvas)",
                      border: "1px solid var(--border-hairline)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      color: "var(--ink-secondary)",
                    }}
                  >
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Full JD */}
          <div className="card">
            <h3 className="headline-sm" style={{ marginBottom: "16px" }}>
              Full Job Description
            </h3>
            <div
              className="body-md"
              style={{
                lineHeight: "1.7",
                color: "var(--ink-body)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {job.description}
            </div>
          </div>
        </div>

        {/* Right Column: Explainable Match Engine & Grounded Evidence */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Match Score Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="headline-sm">Match Intelligence</h3>
              <button
                onClick={handleRecalculateMatch}
                disabled={evaluatingMatch}
                className="btn btn-outline btn-sm"
              >
                {evaluatingMatch ? "Re-evaluating..." : "Re-evaluate"}
              </button>
            </div>

            {match ? (
              <div>
                <p className="body-sm text-muted" style={{ marginBottom: "16px" }}>
                  {match.explanation}
                </p>

                {/* Component Scores */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginBottom: "20px",
                    padding: "12px",
                    background: "var(--bg-canvas)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-hairline)",
                  }}
                >
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                    className="body-sm"
                  >
                    <span>Skills Alignment</span>
                    <strong style={{ fontFamily: "var(--font-mono)" }}>
                      {match.component_scores_json.skills ?? 0}%
                    </strong>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                    className="body-sm"
                  >
                    <span>Experience Depth</span>
                    <strong style={{ fontFamily: "var(--font-mono)" }}>
                      {match.component_scores_json.experience ?? 0}%
                    </strong>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                    className="body-sm"
                  >
                    <span>Location / Remote Fit</span>
                    <strong style={{ fontFamily: "var(--font-mono)" }}>
                      {match.component_scores_json.location ?? 0}%
                    </strong>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                    className="body-sm"
                  >
                    <span>Salary Fit</span>
                    <strong style={{ fontFamily: "var(--font-mono)" }}>
                      {match.component_scores_json.salary ?? 0}%
                    </strong>
                  </div>
                </div>

                {/* Strengths */}
                {match.strengths_json.length > 0 && (
                  <div style={{ marginBottom: "18px" }}>
                    <div
                      className="label"
                      style={{ color: "var(--fit-high-text)", marginBottom: "8px" }}
                    >
                      Documented Strengths
                    </div>
                    <ul
                      style={{
                        paddingLeft: "18px",
                        fontSize: "0.85rem",
                        color: "var(--ink-secondary)",
                      }}
                    >
                      {match.strengths_json.map((st, i) => (
                        <li key={i} style={{ marginBottom: "4px" }}>
                          {st}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Identified Gaps */}
                {match.gaps_json.length > 0 && (
                  <div style={{ marginBottom: "18px" }}>
                    <div
                      className="label"
                      style={{ color: "var(--fit-moderate-text)", marginBottom: "8px" }}
                    >
                      Identified Gaps (Missing Evidence)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {match.gaps_json.map((gap, i) => (
                        <div key={i} className="alert-gap" style={{ padding: "8px 12px" }}>
                          <span className="body-sm">{gap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="body-sm text-muted">No match evaluation available.</div>
            )}
          </div>

          {/* Supporting Evidence Grounding */}
          <div className="card">
            <h3 className="headline-sm" style={{ marginBottom: "14px" }}>
              Supporting Career Evidence
            </h3>
            {profile?.evidence && profile.evidence.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {profile.evidence.map((ev) => (
                  <div key={ev.id} className="evidence-item">
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <span className="verified-evidence-badge">✓ {ev.verification_state}</span>
                        <strong className="body-sm" style={{ color: "var(--ink-primary)" }}>
                          {ev.title}
                        </strong>
                      </div>
                      <p className="body-sm text-muted">{ev.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-sm text-muted">No career evidence uploaded yet.</p>
            )}
          </div>

          {/* Action Box */}
          <div
            className="card"
            style={{
              background: "var(--bg-canvas)",
              textAlign: "center",
              border: "1px solid var(--border-hairline)",
            }}
          >
            <h4 className="headline-sm" style={{ fontSize: "1rem", marginBottom: "8px" }}>
              Ready to Tailor?
            </h4>
            <p className="body-sm text-muted" style={{ marginBottom: "16px" }}>
              Generate truthful resume variants and tailored cover letters grounded strictly in your
              verified evidence.
            </p>
            <button
              onClick={() => router.push(`/jobs/${job.id}/tailor`)}
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              Tailor Application Materials →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
