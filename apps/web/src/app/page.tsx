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
    <div className="container" style={{ paddingTop: "40px" }}>
      {/* Hero Header */}
      <div style={{ marginBottom: "36px" }}>
        <div style={{ display: "inline-block", marginBottom: "12px" }}>
          <span className="badge badge-blue">JobOS Career Operating System</span>
        </div>
        <h1 className="title-xl" style={{ fontSize: "2.4rem", marginBottom: "10px" }}>
          Apply anywhere. Forget nothing.
        </h1>
        <p className="text-muted" style={{ maxWidth: "680px", fontSize: "1.05rem" }}>
          Discover real jobs with SerpApi, calculate explainable evidence-grounded matches, tailor
          truthful application materials, and preserve exact submission memory in your Application
          Capsule.
        </p>
      </div>

      {/* Primary Search Launcher Card */}
      <div className="card" style={{ marginBottom: "36px", padding: "28px" }}>
        <h2 className="title-md" style={{ marginBottom: "16px" }}>
          Start Job Discovery
        </h2>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr auto auto",
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
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <label htmlFor="remote-check" className="text-sm" style={{ cursor: "pointer" }}>
              Remote Only
            </label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: "10px 24px" }}>
            Search Opportunities
          </button>
        </form>
      </div>

      {/* Overview Stats */}
      <div className="grid-3" style={{ marginBottom: "36px" }}>
        <div className="card" style={{ padding: "20px" }}>
          <div className="text-xs text-muted" style={{ textTransform: "uppercase" }}>
            Discovered Catalog
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: "700", marginTop: "4px" }}>
            {recentJobs.length} Jobs
          </div>
          <div className="text-xs text-dim" style={{ marginTop: "4px" }}>
            Persisted from live discovery
          </div>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <div className="text-xs text-muted" style={{ textTransform: "uppercase" }}>
            Application Memory
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: "700", marginTop: "4px" }}>
            {applications.length} Capsules
          </div>
          <div className="text-xs text-dim" style={{ marginTop: "4px" }}>
            Exact materials preserved
          </div>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <div className="text-xs text-muted" style={{ textTransform: "uppercase" }}>
            Career Evidence
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: "700", marginTop: "4px" }}>Verified</div>
          <div className="text-xs text-dim" style={{ marginTop: "4px" }}>
            Grounding candidate claims
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Applications Section */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="title-md">Application Capsules</h3>
              <p className="text-xs text-muted">Permanent records of what you submitted</p>
            </div>
            <Link href="/applications" className="btn btn-outline btn-sm">
              View All
            </Link>
          </div>

          {loading ? (
            <div className="text-sm text-muted" style={{ padding: "20px 0" }}>
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div
              style={{
                padding: "30px 20px",
                textAlign: "center",
                background: "var(--bg-subtle)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p className="text-sm text-muted" style={{ marginBottom: "12px" }}>
                No applications captured yet.
              </p>
              <Link href="/jobs" className="btn btn-secondary btn-sm">
                Discover & Tailor a Job
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {applications.slice(0, 3).map((app) => (
                <div
                  key={app.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "var(--bg-subtle)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>{app.target_role}</div>
                    <div className="text-xs text-muted">
                      {app.target_company} • Applied:{" "}
                      {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "Saved"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="badge badge-amber">{app.status}</span>
                    <Link href={`/applications/${app.id}`} className="btn btn-secondary btn-sm">
                      Capsule
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Ingested Jobs */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="title-md">Recently Discovered Jobs</h3>
              <p className="text-xs text-muted">Ready for match analysis and tailoring</p>
            </div>
            <Link href="/jobs" className="btn btn-outline btn-sm">
              Explore All
            </Link>
          </div>

          {loading ? (
            <div className="text-sm text-muted" style={{ padding: "20px 0" }}>
              Loading catalog...
            </div>
          ) : recentJobs.length === 0 ? (
            <div
              style={{
                padding: "30px 20px",
                textAlign: "center",
                background: "var(--bg-subtle)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p className="text-sm text-muted" style={{ marginBottom: "12px" }}>
                Catalog is currently empty.
              </p>
              <Link href="/jobs" className="btn btn-primary btn-sm">
                Run First SerpApi Discovery
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {recentJobs.slice(0, 3).map((job) => (
                <div
                  key={job.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "var(--bg-subtle)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ maxWidth: "70%" }}>
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "0.95rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.title}
                    </div>
                    <div className="text-xs text-muted">
                      {job.company_name || "Company"} • {job.location || "Anywhere"}
                    </div>
                  </div>
                  <Link href={`/jobs/${job.id}`} className="btn btn-primary btn-sm">
                    Inspect
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
