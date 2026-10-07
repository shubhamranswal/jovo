"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import type { Application, Job } from "@jobos/contracts";
import { api } from "../lib/api";

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState("Senior Backend Engineer");
  const [location, setLocation] = useState("Remote");
  const [remoteOnly, setRemoteOnly] = useState(true);

  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [jobsRes, appsRes] = await Promise.all([
          api.listJobs({ page: 1, page_size: 4 }),
          api.listApplications(),
        ]);
        setRecentJobs(jobsRes.items || []);
        setApplications(appsRes || []);
      } catch {
        // Handled gracefully in empty state
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (role.trim()) params.set("role", role.trim());
    if (location.trim()) params.set("location", location.trim());
    if (remoteOnly) params.set("remote", "true");
    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <div className="container" style={{ paddingTop: "44px" }}>
      {/* Hero Header */}
      <div style={{ marginBottom: "36px", maxWidth: "880px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <span className="badge badge-gray" style={{ fontFamily: "var(--font-mono)" }}>
            APPLICATION MEMORY OPERATING SYSTEM
          </span>
        </div>
        <h1 className="display-lg" style={{ marginBottom: "14px" }}>
          Find the right job. Understand your fit. Apply with confidence. Remember everything.
        </h1>
        <p className="body-lg" style={{ color: "var(--ink-secondary)", maxWidth: "760px" }}>
          Jovo transforms the job search into an editorial engineering console. Discover real jobs,
          inspect explainable evidence-grounded matches, tailor truthful materials, and freeze your
          exact submissions in permanent Application Capsules.
        </p>
      </div>

      {/* Primary Action: Job Discovery Search Console */}
      <div className="card" style={{ marginBottom: "40px", padding: "28px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "18px",
          }}
        >
          <div>
            <h2 className="headline-sm">Discover Opportunities</h2>
            <p className="body-sm">
              Query Google Jobs via SerpApi or filter your verified local catalog.
            </p>
          </div>
          <span className="telemetry-xs text-muted">EXPLICIT SEARCH ONLY</span>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr auto auto",
            gap: "14px",
            alignItems: "flex-end",
          }}
        >
          <div className="input-group">
            <label className="label">Target Role</label>
            <input
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              required
            />
          </div>

          <div className="input-group">
            <label className="label">Location</label>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Remote or India"
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingBottom: "10px",
            }}
          >
            <input
              type="checkbox"
              id="remote-check"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              style={{
                width: "16px",
                height: "16px",
                cursor: "pointer",
                accentColor: "var(--ink-primary)",
              }}
            />
            <label
              htmlFor="remote-check"
              className="label-md"
              style={{ cursor: "pointer", userSelect: "none" }}
            >
              Remote Only
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-lg">
            Search Opportunities →
          </button>
        </form>
      </div>

      {/* Core Product Journey (Editorial 6-Step Architecture replacing generic feature grid) */}
      <div style={{ marginBottom: "44px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 className="headline-sm">The Jovo Operating Architecture</h2>
          <span className="telemetry-xs text-muted">END-TO-END PIPELINE</span>
        </div>

        <div className="grid-3" style={{ gap: "16px" }}>
          <div className="card" style={{ padding: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span className="telemetry-xs text-muted">01 / DISCOVERY</span>
              <span className="badge badge-gray">SerpApi</span>
            </div>
            <div className="headline-sm" style={{ fontSize: "1rem", marginBottom: "6px" }}>
              Job Discovery
            </div>
            <p className="body-sm">
              Explicit, live search against Google Jobs normalized into deduplicated catalog records
              with full provenance.
            </p>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span className="telemetry-xs text-muted">02 / INTELLIGENCE</span>
              <span className="badge badge-teal">Evidence</span>
            </div>
            <div className="headline-sm" style={{ fontSize: "1rem", marginBottom: "6px" }}>
              Explainable Match
            </div>
            <p className="body-sm">
              Algorithmic fit decomposition showing exact supporting candidate evidence, skill
              overlaps, and verified gaps.
            </p>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span className="telemetry-xs text-muted">03 / TAILORING</span>
              <span className="badge badge-blue">Truthful</span>
            </div>
            <div className="headline-sm" style={{ fontSize: "1rem", marginBottom: "6px" }}>
              Versioned Materials
            </div>
            <p className="body-sm">
              Master-protected resume and cover letter tailoring strictly grounded in verified
              profile facts—no hallucination.
            </p>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span className="telemetry-xs text-muted">04 / ASSISTANCE</span>
              <span className="badge badge-gray">Chrome MV3</span>
            </div>
            <div className="headline-sm" style={{ fontSize: "1rem", marginBottom: "6px" }}>
              Assisted Apply
            </div>
            <p className="body-sm">
              Conservative extension detecting Workday and generic ATS forms with safe autofill and
              explicit candidate review.
            </p>
          </div>

          <div
            className="card"
            style={{
              padding: "20px",
              border: "1px solid var(--ink-primary)",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                className="telemetry-xs"
                style={{ color: "var(--ink-primary)", fontWeight: 700 }}
              >
                05 / MEMORY
              </span>
              <span className="badge badge-green">Core Moat</span>
            </div>
            <div className="headline-sm" style={{ fontSize: "1rem", marginBottom: "6px" }}>
              Application Capsule
            </div>
            <p className="body-sm">
              Freezes the exact job description snapshot, submitted resume, cover letter, and
              approved Q&A forever.
            </p>
          </div>

          <div className="card" style={{ padding: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span className="telemetry-xs text-muted">06 / INTERVIEW</span>
              <span className="badge badge-amber">Prep</span>
            </div>
            <div className="headline-sm" style={{ fontSize: "1rem", marginBottom: "6px" }}>
              Targeted Preparation
            </div>
            <p className="body-sm">
              Technical and behavioral interview drills generated directly from the frozen materials
              you actually submitted.
            </p>
          </div>
        </div>
      </div>

      {/* Two-Column Operational Summary (Real Data) */}
      <div className="grid-2" style={{ marginBottom: "40px" }}>
        {/* Recent Application Capsules */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="headline-sm">Application Capsules</h3>
              <p className="body-sm">Permanent memory of your submitted applications</p>
            </div>
            <Link href="/applications" className="btn btn-outline btn-sm">
              View All ({applications.length}) →
            </Link>
          </div>

          {loading ? (
            <p className="body-sm text-muted">Loading Application Capsules...</p>
          ) : applications.length === 0 ? (
            <div
              style={{
                padding: "24px",
                background: "var(--bg-canvas)",
                borderRadius: "var(--radius-sm)",
                textAlign: "center",
                border: "1px dashed var(--border-hairline)",
              }}
            >
              <p className="body-sm text-muted" style={{ marginBottom: "12px" }}>
                No applications preserved yet.
              </p>
              <Link href="/jobs" className="btn btn-primary btn-sm">
                Discover & Tailor Your First Job
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {applications.slice(0, 4).map((app) => (
                <Link
                  key={app.id}
                  href={`/applications/${app.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    background: "var(--bg-canvas)",
                    border: "1px solid var(--border-hairline)",
                    borderRadius: "var(--radius-sm)",
                    transition: "border-color 0.15s ease",
                  }}
                  className="card-interactive"
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--ink-primary)" }}>
                      {app.target_role}
                    </div>
                    <div className="body-sm text-muted">
                      {app.target_company} • Applied:{" "}
                      {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "Draft"}
                    </div>
                  </div>
                  <span className="badge badge-gray">{app.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recently Discovered Jobs Catalog */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="headline-sm">Discovered Catalog</h3>
              <p className="body-sm">Verified opportunities in your catalog</p>
            </div>
            <Link href="/jobs" className="btn btn-outline btn-sm">
              Catalog ({recentJobs.length}) →
            </Link>
          </div>

          {loading ? (
            <p className="body-sm text-muted">Loading jobs catalog...</p>
          ) : recentJobs.length === 0 ? (
            <div
              style={{
                padding: "24px",
                background: "var(--bg-canvas)",
                borderRadius: "var(--radius-sm)",
                textAlign: "center",
                border: "1px dashed var(--border-hairline)",
              }}
            >
              <p className="body-sm text-muted" style={{ marginBottom: "12px" }}>
                Catalog is currently empty.
              </p>
              <Link href="/jobs" className="btn btn-primary btn-sm">
                Discover Jobs
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentJobs.slice(0, 4).map((j) => (
                <Link
                  key={j.id}
                  href={`/jobs/${j.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    background: "var(--bg-canvas)",
                    border: "1px solid var(--border-hairline)",
                    borderRadius: "var(--radius-sm)",
                    transition: "border-color 0.15s ease",
                  }}
                  className="card-interactive"
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--ink-primary)" }}>{j.title}</div>
                    <div className="body-sm text-muted">
                      {j.company_name} • {j.location || "Anywhere"}
                    </div>
                  </div>
                  {j.remote_type && <span className="badge badge-green">{j.remote_type}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
