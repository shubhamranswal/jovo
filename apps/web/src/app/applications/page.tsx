"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import type { Application, ApplicationStatus } from "@jobos/contracts";
import { api } from "../../lib/api";

export default function ApplicationsListPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApps() {
      setLoading(true);
      setError(null);
      try {
        const filter = statusFilter === "all" ? undefined : (statusFilter as ApplicationStatus);
        const data = await api.listApplications({ status: filter });
        setApplications(data || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load applications";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchApps();
  }, [statusFilter]);

  const statuses = [
    "all",
    "Saved",
    "Applied",
    "Recruiter Screen",
    "Interview",
    "Offer",
    "Rejected",
  ];

  return (
    <div className="container" style={{ paddingTop: "36px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "28px",
        }}
      >
        <div>
          <div style={{ display: "inline-block", marginBottom: "8px" }}>
            <span className="telemetry-xs badge badge-gray">IMMUTABLE MEMORY DIRECTORY</span>
          </div>
          <h1 className="headline-lg" style={{ marginBottom: "6px" }}>
            Tracked Application Capsules
          </h1>
          <p className="body-md text-muted">
            Access the immutable snapshots, tailored resumes, and cover letters submitted for each
            job.
          </p>
        </div>

        <Link href="/jobs" className="btn btn-primary">
          + Discover New Job
        </Link>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          overflowX: "auto",
          paddingBottom: "6px",
        }}
      >
        {statuses.map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`btn ${statusFilter === st ? "btn-primary" : "btn-secondary"} btn-sm`}
            style={{ textTransform: "capitalize" }}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="alert-danger" style={{ marginBottom: "24px" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <h3 className="headline-sm" style={{ marginBottom: "6px" }}>
            Loading Application Memory...
          </h3>
          <p className="body-sm text-muted">Reading persistent database records.</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && applications.length === 0 && (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "var(--bg-surface)",
          }}
        >
          <h3 className="headline-sm" style={{ marginBottom: "8px" }}>
            No Application Capsules Found
          </h3>
          <p className="body-sm text-muted" style={{ maxWidth: "450px", margin: "0 auto 20px" }}>
            {statusFilter === "all"
              ? "You haven't preserved any application materials yet. Discover a job, tailor your materials, and freeze your first Application Capsule."
              : `No applications currently in '${statusFilter}' status.`}
          </p>
          <Link href="/jobs" className="btn btn-primary">
            Explore Job Discovery →
          </Link>
        </div>
      )}

      {/* Applications List */}
      {!loading && applications.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {applications.map((app) => (
            <div
              key={app.id}
              className="card card-interactive"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
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
                  <h2 className="headline-sm" style={{ fontSize: "1.1rem" }}>
                    {app.title || app.target_role || "Untitled Role"}
                  </h2>
                  <span
                    className={`badge ${
                      app.status === "Offer"
                        ? "badge-green"
                        : app.status === "Applied"
                          ? "badge-blue"
                          : app.status === "Interviewing"
                            ? "badge-blue"
                            : app.status === "Rejected"
                              ? "badge-gray"
                              : "badge-amber"
                    }`}
                  >
                    {app.status}
                  </span>
                  {Boolean(app.metadata_json?.is_demo) && (
                    <span className="badge badge-amber">DEMO CAPSULE</span>
                  )}
                </div>

                <div className="body-sm" style={{ color: "var(--ink-secondary)" }}>
                  <strong style={{ color: "var(--ink-primary)" }}>
                    {app.company_name || app.target_company || "Organization"}
                  </strong>{" "}
                  • Applied:{" "}
                  <span style={{ fontFamily: "var(--font-mono)" }}>
                    {app.applied_at
                      ? new Date(app.applied_at).toLocaleDateString()
                      : new Date(app.created_at).toLocaleDateString()}
                  </span>
                  {app.source && ` • Source: ${app.source}`}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Link href={`/applications/${app.id}`} className="btn btn-secondary">
                  Open Capsule →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
