"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export function Navbar() {
  const pathname = usePathname();
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .checkHealth()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
  }, []);

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <div className="brand">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img
              src="/jovo-logo-32.png"
              alt="Jovo"
              width={28}
              height={28}
              style={{ borderRadius: "6px" }}
            />
            <div>
              <span className="brand-text">Jovo</span>
            </div>
          </Link>
          <span className="brand-tag">Apply smarter. Get hired faster.</span>
        </div>

        <div className="nav-links">
          <Link href="/jobs" className={`nav-link ${pathname.startsWith("/jobs") ? "active" : ""}`}>
            Discover Jobs
          </Link>
          <Link
            href="/applications"
            className={`nav-link ${pathname.startsWith("/applications") ? "active" : ""}`}
          >
            Applications Capsule
          </Link>
          <Link
            href="/profile"
            className={`nav-link ${pathname.startsWith("/profile") ? "active" : ""}`}
          >
            Career Profile
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginLeft: "16px",
              padding: "4px 10px",
              borderRadius: "9999px",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-color)",
              fontSize: "0.75rem",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: apiOk === true ? "#10b981" : apiOk === false ? "#ef4444" : "#f59e0b",
              }}
            />
            <span style={{ color: "var(--text-muted)" }}>
              {apiOk === true ? "API Online" : apiOk === false ? "API Offline" : "Checking..."}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
