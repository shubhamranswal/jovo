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

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: "60px", textAlign: "center" }}>
        <h2 className="title-md">Loading Job Context & Match Engine...</h2>
        <p className="text-sm text-muted">Retrieving grounded profile evidence...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container" style={{ paddingTop: "60px" }}>
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <h2 className="title-md" style={{ color: "var(--danger)", marginBottom: "8px" }}>
            Job Not Found or Error
          </h2>
          <p className="text-sm text-muted" style={{ marginBottom: "20px" }}>
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
          className="text-sm text-muted"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          ← Back to Discovery
        </Link>
        <div style={{ display: "flex", gap: "10px" }}>
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
              style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}
            >
              <h1 className="title-xl" style={{ fontSize: "1.8rem" }}>
                {job.title}
              </h1>
              {job.remote_type && <span className="badge badge-green">{job.remote_type}</span>}
              {job.employment_type && (
                <span className="badge badge-gray">{job.employment_type}</span>
              )}
            </div>

            <div style={{ fontSize: "1.05rem", color: "var(--text-muted)", marginBottom: "12px" }}>
              <strong style={{ color: "var(--text-main)" }}>{job.company_name || "Company"}</strong>{" "}
              • {job.location || "Anywhere"}
              {job.salary_min && (
                <span>
                  {" "}
                  • {job.currency || "$"}
                  {job.salary_min.toLocaleString()}
                  {job.salary_max ? ` - ${job.salary_max.toLocaleString()}` : "+"}
                </span>
              )}
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: "14px" }}
              className="text-xs text-dim"
            >
              <span>Fingerprint: {job.fingerprint.slice(0, 12)}...</span>
              {job.canonical_url && (
                <a
                  href={job.canonical_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--primary)", textDecoration: "underline" }}
                >
                  Original Source Posting ↗
                </a>
              )}
            </div>
          </div>

          {/* Quick Match Pill */}
          {match && (
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: "800",
                  color: match.overall_score >= 75 ? "#34d399" : "#fbbf24",
                }}
              >
                {match.overall_score}%
              </div>
              <div className="text-xs text-muted">Overall Alignment</div>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Match Intelligence (Left) & Full Description (Right) */}
      <div className="grid-sidebar">
        {/* Left Column: Job Description and Requirements */}
        <div>
          {/* Normalized Requirements */}
          {reqs.length > 0 && (
            <div className="card" style={{ marginBottom: "24px" }}>
              <h3 className="title-md" style={{ marginBottom: "14px" }}>
                Key Technical Requirements
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {reqs.map((req, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border-color)",
                      fontSize: "0.85rem",
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
            <h3 className="title-md" style={{ marginBottom: "16px" }}>
              Full Job Description
            </h3>
            <div
              className="text-sm"
              style={{
                lineHeight: "1.7",
                color: "#cbd5e1",
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
          <div className="card" style={{ border: "1px solid #334e7a" }}>
            <div className="card-header">
              <h3 className="title-md">Match Intelligence</h3>
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
                <p className="text-sm text-muted" style={{ marginBottom: "16px" }}>
                  {match.explanation}
                </p>

                {/* Component Scores */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                    className="text-sm"
                  >
                    <span>Skills Alignment</span>
                    <strong>{match.component_scores_json.skills ?? 0}%</strong>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                    className="text-sm"
                  >
                    <span>Experience Depth</span>
                    <strong>{match.component_scores_json.experience ?? 0}%</strong>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                    className="text-sm"
                  >
                    <span>Location / Remote Fit</span>
                    <strong>{match.component_scores_json.location ?? 0}%</strong>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                    className="text-sm"
                  >
                    <span>Salary Fit</span>
                    <strong>{match.component_scores_json.salary ?? 0}%</strong>
                  </div>
                </div>

                {/* Strengths */}
                {match.strengths_json.length > 0 && (
                  <div style={{ marginBottom: "18px" }}>
                    <div className="label" style={{ color: "#34d399", marginBottom: "8px" }}>
                      Documented Strengths
                    </div>
                    <ul
                      style={{
                        paddingLeft: "18px",
                        fontSize: "0.85rem",
                        color: "var(--text-muted)",
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
                    <div className="label" style={{ color: "#fbbf24", marginBottom: "8px" }}>
                      Identified Gaps (Missing Evidence)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {match.gaps_json.map((gap, i) => (
                        <div key={i} className="alert-gap" style={{ padding: "8px 12px" }}>
                          <span style={{ fontSize: "0.8rem" }}>{gap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted">No match evaluation available.</div>
            )}
          </div>

          {/* Supporting Evidence Grounding */}
          <div className="card">
            <h3 className="title-md" style={{ marginBottom: "14px" }}>
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
                          marginBottom: "2px",
                        }}
                      >
                        <span className="evidence-badge">{ev.verification_state}</span>
                        <strong style={{ fontSize: "0.85rem" }}>{ev.title}</strong>
                      </div>
                      <p className="text-xs text-muted">{ev.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No career evidence uploaded yet.</p>
            )}
          </div>

          {/* Action Box */}
          <div className="card" style={{ background: "var(--bg-subtle)", textAlign: "center" }}>
            <h4 className="title-md" style={{ fontSize: "1rem", marginBottom: "8px" }}>
              Ready to Apply?
            </h4>
            <p className="text-xs text-muted" style={{ marginBottom: "16px" }}>
              Generate truthful resume variant and tailored cover letter grounded in your verified
              evidence.
            </p>
            <button
              onClick={() => router.push(`/jobs/${job.id}/tailor`)}
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              Tailor Application Materials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
