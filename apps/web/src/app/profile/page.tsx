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
        <h2 className="headline-md">Loading Candidate Profile & Evidence...</h2>
        <p className="body-sm text-muted">Reading verified career ground truth.</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container" style={{ paddingTop: "60px" }}>
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <h2 className="headline-md" style={{ color: "var(--fit-gap-text)", marginBottom: "8px" }}>
            Profile Not Found
          </h2>
          <p className="body-sm text-muted">{error || "Could not load active career profile."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: "36px" }}>
      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "28px",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "inline-block", marginBottom: "8px" }}>
            <span className="telemetry-xs badge badge-green">VERIFIED GROUND TRUTH DOSSIER</span>
          </div>
          <h1 className="headline-lg" style={{ marginBottom: "6px" }}>
            Career Profile & Verification Layer
          </h1>
          <p className="body-md text-muted" style={{ maxWidth: "640px" }}>
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px",
                marginBottom: "6px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 className="headline-sm" style={{ fontSize: "1.4rem", marginBottom: "2px" }}>
                  {(profile.preferences_json?.full_name as string) || "Shubham Singh Ranswal"}
                </h2>
                <div className="body-md" style={{ color: "var(--accent-action)", fontWeight: 600 }}>
                  {profile.headline ||
                    "Software Engineer II - Secure Systems, Cryptography, HSM, Backend & AI Tooling"}
                </div>
              </div>
              <span className="badge badge-blue">Seeded Demo Candidate</span>
            </div>
            <div className="telemetry-xs text-muted" style={{ marginBottom: "14px" }}>
              Location: {profile.location || "Noida, Uttar Pradesh"} • Email:{" "}
              {(profile.preferences_json?.email as string) || "shubhamranswal@gmail.com"} • Phone:{" "}
              {(profile.preferences_json?.phone as string) || "+91 9560793525"}
            </div>
            <p className="body-md" style={{ lineHeight: "1.6", color: "var(--ink-body)" }}>
              {profile.summary || "No executive summary provided."}
            </p>
          </div>

          {/* Master Resume */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="headline-sm">Master Resume (Canonical Truth)</h3>
                <p className="body-sm text-muted">
                  {masterResume
                    ? `${masterResume.name} (v${masterResume.version})`
                    : "Default profile resume"}
                </p>
              </div>
              <span className="badge badge-blue">Protected Master</span>
            </div>

            <p className="telemetry-xs text-muted" style={{ marginBottom: "12px" }}>
              Note: Tailoring never modifies or overwrites this master resume. New variants are
              generated as versioned variants.
            </p>

            <div className="pre-box" style={{ maxHeight: "360px" }}>
              {masterResume?.extracted_text || "No master resume text available."}
            </div>
          </div>

          {/* Work Experiences */}
          <div className="card">
            <h3 className="headline-sm" style={{ marginBottom: "16px" }}>
              Documented Experiences
            </h3>
            {profile.experiences && profile.experiences.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {profile.experiences.map((exp) => (
                  <div
                    key={exp.id}
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
                        marginBottom: "4px",
                      }}
                    >
                      <strong className="body-md" style={{ color: "var(--ink-primary)" }}>
                        {exp.title}
                      </strong>
                      <span className="badge badge-gray">{exp.evidence_status}</span>
                    </div>
                    <div className="telemetry-xs text-muted" style={{ marginBottom: "8px" }}>
                      {exp.organization} • {exp.start_date || "Past"} to {exp.end_date || "Present"}
                    </div>
                    {exp.description && (
                      <p
                        className="body-sm"
                        style={{ color: "var(--ink-secondary)", lineHeight: "1.5" }}
                      >
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-sm text-muted">No documented work experiences recorded.</p>
            )}
          </div>
        </div>

        {/* Sidebar: Skills & Verified Evidence */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Verified Evidence */}
          <div className="card">
            <h3 className="headline-sm" style={{ marginBottom: "8px" }}>
              Verified Career Evidence
            </h3>
            <p className="body-sm text-muted" style={{ marginBottom: "14px" }}>
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
                        <span className="verified-evidence-badge">✓ {ev.verification_state}</span>
                        <strong className="body-sm" style={{ color: "var(--ink-primary)" }}>
                          {ev.title}
                        </strong>
                      </div>
                      <p className="body-sm text-muted" style={{ marginBottom: "6px" }}>
                        {ev.content}
                      </p>
                      {ev.source_url && (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="telemetry-xs"
                          style={{ color: "var(--accent-action)", textDecoration: "none" }}
                        >
                          View Repository ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-sm text-muted">No evidence items registered.</p>
            )}
          </div>

          {/* Documented Skills */}
          <div className="card">
            <h3 className="headline-sm" style={{ marginBottom: "14px" }}>
              Documented Skills
            </h3>
            {profile.skills && profile.skills.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {profile.skills.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      padding: "3px 8px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-canvas)",
                      border: "1px solid var(--border-hairline)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      color: "var(--ink-secondary)",
                    }}
                  >
                    {s.normalized_name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="body-sm text-muted">No skills mapped.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
