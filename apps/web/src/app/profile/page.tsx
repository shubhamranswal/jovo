"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import type { CareerProfile, Resume } from "@jobos/contracts";
import { api } from "../../lib/api";

export default function CareerProfilePage() {
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [masterResume, setMasterResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const p = await api.getActiveProfile();
        setProfile(p);
        const resume = await api.getMasterResume(p.id);
        setMasterResume(resume);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load career profile";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: "60px", textAlign: "center" }}>
        <h2 className="title-md">Loading Candidate Profile & Evidence...</h2>
        <p className="text-sm text-muted">Reading verified career ground truth.</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container" style={{ paddingTop: "60px" }}>
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <h2 className="title-md" style={{ color: "var(--danger)", marginBottom: "8px" }}>
            Profile Not Found
          </h2>
          <p className="text-sm text-muted">{error || "Could not load active career profile."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: "32px" }}>
      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "28px",
        }}
      >
        <div>
          <div style={{ display: "inline-block", marginBottom: "6px" }}>
            <span className="badge badge-green">Candidate Truth & Evidence Grounding</span>
          </div>
          <h1 className="title-lg" style={{ marginBottom: "6px" }}>
            Career Profile & Verification Layer
          </h1>
          <p className="text-sm text-muted" style={{ maxWidth: "600px" }}>
            All Jovo match scores, tailored resumes, and cover letters are strictly grounded in this
            profile. The system never fabricates unbacked experience.
          </p>
        </div>

        <Link href="/jobs" className="btn btn-primary">
          Discover Matching Jobs →
        </Link>
      </div>

      <div className="grid-sidebar">
        {/* Main Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Identity & Summary Card */}
          <div className="card">
            <h2 className="title-md" style={{ fontSize: "1.25rem", marginBottom: "4px" }}>
              {profile.headline || "Senior Software Engineer"}
            </h2>
            <div className="text-xs text-muted" style={{ marginBottom: "14px" }}>
              Location: {profile.location || "Remote"} • Profile ID: {profile.id.slice(0, 8)}...
            </div>
            <p className="text-sm" style={{ lineHeight: "1.6", color: "#cbd5e1" }}>
              {profile.summary || "No executive summary provided."}
            </p>
          </div>

          {/* Master Resume */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="title-md">Master Resume (Canonical Truth)</h3>
                <p className="text-xs text-muted">
                  {masterResume
                    ? `${masterResume.name} (v${masterResume.version})`
                    : "Default profile resume"}
                </p>
              </div>
              <span className="badge badge-blue">Protected Master</span>
            </div>

            <p className="text-xs text-dim" style={{ marginBottom: "12px" }}>
              Note: Tailoring never modifies or overwrites this master resume. New variants are
              generated as versioned variants.
            </p>

            <div className="pre-box" style={{ maxHeight: "360px" }}>
              {masterResume?.extracted_text || "No master resume text available."}
            </div>
          </div>

          {/* Work Experiences */}
          <div className="card">
            <h3 className="title-md" style={{ marginBottom: "16px" }}>
              Documented Experiences
            </h3>
            {profile.experiences && profile.experiences.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {profile.experiences.map((exp) => (
                  <div
                    key={exp.id}
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
                        marginBottom: "4px",
                      }}
                    >
                      <strong style={{ fontSize: "0.95rem" }}>{exp.title}</strong>
                      <span className="badge badge-gray">{exp.evidence_status}</span>
                    </div>
                    <div className="text-xs text-muted" style={{ marginBottom: "8px" }}>
                      {exp.organization} • {exp.start_date || "Past"} to {exp.end_date || "Present"}
                    </div>
                    {exp.description && (
                      <p className="text-xs" style={{ color: "#94a3b8", lineHeight: "1.5" }}>
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No documented work experiences recorded.</p>
            )}
          </div>
        </div>

        {/* Sidebar: Skills & Verified Evidence */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Verified Evidence */}
          <div className="card">
            <h3 className="title-md" style={{ marginBottom: "14px" }}>
              Verified Career Evidence
            </h3>
            <p className="text-xs text-dim" style={{ marginBottom: "14px" }}>
              Concrete technical artifacts backing candidate claims during match scoring.
            </p>

            {profile.evidence && profile.evidence.length > 0 ? (
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
                        <span className="evidence-badge">{ev.verification_state}</span>
                        <strong style={{ fontSize: "0.85rem" }}>{ev.title}</strong>
                      </div>
                      <p className="text-xs text-muted" style={{ marginBottom: "6px" }}>
                        {ev.content}
                      </p>
                      {ev.source_url && (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs"
                          style={{ color: "var(--primary)", textDecoration: "underline" }}
                        >
                          View Repository ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No evidence items registered.</p>
            )}
          </div>

          {/* Documented Skills */}
          <div className="card">
            <h3 className="title-md" style={{ marginBottom: "14px" }}>
              Documented Skills
            </h3>
            {profile.skills && profile.skills.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {profile.skills.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border-color)",
                      fontSize: "0.8rem",
                    }}
                  >
                    {s.normalized_name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">No skills mapped.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
