"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import type { Job } from "@jobos/contracts";
import { api } from "../../lib/api";

function JobSearchContent() {
  const searchParams = useSearchParams();

  const [role, setRole] = useState(searchParams.get("role") || "Senior Backend Engineer");
  const [location, setLocation] = useState(searchParams.get("location") || "India");
  const [skills, setSkills] = useState("Python, FastAPI");
  const [remoteOnly, setRemoteOnly] = useState(searchParams.get("remote") === "true");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQueryInfo, setLastQueryInfo] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"catalog" | "serpapi">("catalog");

  // Load existing catalog jobs on mount without consuming SerpApi quota
  useEffect(() => {
    async function loadInitialCatalog() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listJobs({ page: 1, page_size: 20 });
        setJobs(res.items || []);
        setLastQueryInfo(
          `Viewing ${res.items.length} previously discovered jobs in local catalog.`
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load job catalog";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadInitialCatalog();
  }, []);

  // 1. Explicit action: Discover real jobs through SerpApi
  const handleLiveSerpApiDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDataSource("serpapi");

    const skillsArray = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await api.discoverJobs({
        role: role.trim(),
        location: location.trim() || undefined,
        remote: remoteOnly,
        skills: skillsArray.length ? skillsArray : undefined,
        persist: true,
      });

      setJobs(res.jobs || []);
      setLastQueryInfo(
        `Live SerpApi Query: "${res.query_executed}" • Discovered: ${res.total_discovered} • Newly Persisted: ${res.newly_persisted}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "SerpApi discovery failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 2. Filter local catalog only (zero SerpApi usage)
  const handleLocalFilter = async () => {
    setLoading(true);
    setError(null);
    setDataSource("catalog");
    try {
      const res = await api.listJobs({
        query: role.trim() || undefined,
        location: location.trim() || undefined,
        remote_type: remoteOnly ? "remote" : undefined,
        page: 1,
        page_size: 20,
      });
      setJobs(res.items || []);
      setLastQueryInfo(
        `Catalog filter for "${role}" in "${location}" returned ${res.items.length} jobs.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Local search failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: "32px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 className="title-lg" style={{ marginBottom: "6px" }}>
          Discover & Inspect Opportunities
        </h1>
        <p className="text-muted text-sm">
          Search the local Jovo catalog or explicitly query Google Jobs via SerpApi.
        </p>
      </div>

      {/* Explicit Search Controls */}
      <div className="card" style={{ marginBottom: "32px", padding: "24px" }}>
        <form onSubmit={handleLiveSerpApiDiscovery}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr auto",
              gap: "14px",
              alignItems: "flex-end",
              marginBottom: "16px",
            }}
          >
            <div className="input-group">
              <label className="label">Job Title / Role</label>
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
                placeholder="e.g. India or Remote"
              />
            </div>

            <div className="input-group">
              <label className="label">Key Skills (Comma separated)</label>
              <input
                className="input"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g. Python, FastAPI, SQL"
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
                id="remote-only-filter"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label htmlFor="remote-only-filter" className="text-sm" style={{ cursor: "pointer" }}>
                Remote Only
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid var(--border-color)",
              paddingTop: "16px",
            }}
          >
            <div className="text-xs text-dim">
              Note: Clicking &quot;Live SerpApi Discovery&quot; executes 1 live Google Jobs search.
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={handleLocalFilter}
                className="btn btn-secondary"
                disabled={loading}
              >
                Filter Catalog (Offline)
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading && dataSource === "serpapi"
                  ? "Querying SerpApi..."
                  : "Live SerpApi Discovery"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Query provenance bar */}
      {lastQueryInfo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-sm)",
            marginBottom: "24px",
            fontSize: "0.825rem",
          }}
        >
          <span className="text-muted">{lastQueryInfo}</span>
          <span className="badge badge-gray">{jobs.length} Results</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="alert-gap"
          style={{ marginBottom: "24px", background: "var(--danger-bg)", color: "#f87171" }}
        >
          <div>
            <strong>Discovery Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div className="title-md" style={{ marginBottom: "8px" }}>
            Searching Opportunities...
          </div>
          <p className="text-sm text-muted">
            {dataSource === "serpapi"
              ? "Connecting to SerpApi Google Jobs engine and normalizing results..."
              : "Querying local Jovo catalog..."}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && jobs.length === 0 && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-subtle)" }}
        >
          <h3 className="title-md" style={{ marginBottom: "8px" }}>
            No Jobs Found
          </h3>
          <p className="text-sm text-muted" style={{ maxWidth: "460px", margin: "0 auto 20px" }}>
            No jobs match the current criteria in the catalog. Trigger an explicit live SerpApi
            search above to discover new postings.
          </p>
        </div>
      )}

      {/* Jobs List */}
      {!loading && jobs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {jobs.map((job) => {
            const reqs = job.normalized_requirements_json || [];
            return (
              <div key={job.id} className="card" style={{ padding: "22px 24px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "20px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "6px",
                      }}
                    >
                      <h2 className="title-md" style={{ fontSize: "1.1rem" }}>
                        {job.title}
                      </h2>
                      {job.remote_type && (
                        <span className="badge badge-green">{job.remote_type}</span>
                      )}
                      {job.employment_type && (
                        <span className="badge badge-gray">{job.employment_type}</span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-muted)",
                        marginBottom: "12px",
                      }}
                    >
                      <strong style={{ color: "var(--text-main)" }}>
                        {job.company_name || "Company"}
                      </strong>{" "}
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

                    <p
                      className="text-sm text-muted"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        marginBottom: "14px",
                      }}
                    >
                      {job.description}
                    </p>

                    {/* Requirements Tags */}
                    {reqs.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {reqs.slice(0, 6).map((req, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "var(--bg-subtle)",
                              border: "1px solid var(--border-color)",
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {req}
                          </span>
                        ))}
                        {reqs.length > 6 && (
                          <span className="text-xs text-dim" style={{ alignSelf: "center" }}>
                            +{reqs.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      minWidth: "150px",
                    }}
                  >
                    <Link
                      href={`/jobs/${job.id}`}
                      className="btn btn-primary"
                      style={{ width: "100%", textAlign: "center" }}
                    >
                      Inspect & Match
                    </Link>

                    {job.canonical_url && (
                      <a
                        href={job.canonical_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline btn-sm"
                        style={{ textAlign: "center" }}
                      >
                        External Source ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function JobSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ paddingTop: "40px" }}>
          Loading search...
        </div>
      }
    >
      <JobSearchContent />
    </Suspense>
  );
}
