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
    <div className="container" style={{ paddingTop: "32px" }}>
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
          <div style={{ display: "inline-block", marginBottom: "6px" }}>
            <span className="badge badge-amber">Application Memory Directory</span>
          </div>
          <h1 className="title-lg" style={{ marginBottom: "6px" }}>
            Tracked Application Capsules
          </h1>
          <p className="text-sm text-muted">
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
        <div
          className="alert-gap"
          style={{ marginBottom: "24px", background: "var(--danger-bg)", color: "#f87171" }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <h3 className="title-md" style={{ marginBottom: "6px" }}>
            Loading Application Memory...
          </h3>
          <p className="text-sm text-muted">Reading persistent database records.</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && applications.length === 0 && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-subtle)" }}
        >
          <h3 className="title-md" style={{ marginBottom: "8px" }}>
            No Application Capsules Found
          </h3>
          <p className="text-sm text-muted" style={{ maxWidth: "450px", margin: "0 auto 20px" }}>
            {statusFilter === "all"
              ? "You haven't preserved any application materials yet. Discover a job, tailor your materials, and freeze your first Application Capsule."
              : `No applications currently in '${statusFilter}' status.`}
          </p>
          <Link href="/jobs" className="btn btn-primary">
            Explore Job Discovery
          </Link>
        </div>
      )}

      {/* Applications Grid */}
      {!loading && applications.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {applications.map((app) => (
            <div
              key={app.id}
              className="card"
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
                  <h2 className="title-md" style={{ fontSize: "1.1rem" }}>
                    {app.target_role}
                  </h2>
                  <span
                    className={`badge ${
                      app.status === "Offer"
                        ? "badge-green"
                        : app.status === "Applied"
                          ? "badge-blue"
                          : "badge-amber"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                <div className="text-sm text-muted">
                  <strong style={{ color: "var(--text-main)" }}>{app.target_company}</strong> •
                  Applied:{" "}
                  {app.applied_at
                    ? new Date(app.applied_at).toLocaleDateString()
                    : new Date(app.created_at).toLocaleDateString()}
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
