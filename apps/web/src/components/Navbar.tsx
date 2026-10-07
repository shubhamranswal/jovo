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
              alt="Jovo Logo"
              width={28}
              height={28}
              style={{ borderRadius: "4px" }}
            />
            <span className="brand-text">Jovo</span>
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
            Application Capsules
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
              marginLeft: "12px",
              padding: "3px 9px",
              borderRadius: "var(--radius-full)",
              background: "var(--bg-canvas)",
              border: "1px solid var(--border-hairline)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.6875rem",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: apiOk === true ? "#059669" : apiOk === false ? "#ef4444" : "#d97706",
              }}
            />
            <span style={{ color: "var(--ink-muted)", fontWeight: 500 }}>
              {apiOk === true ? "API Active" : apiOk === false ? "API Disconnected" : "Checking..."}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
