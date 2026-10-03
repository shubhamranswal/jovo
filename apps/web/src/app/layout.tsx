import React from "react";
import "./globals.css";
import { Navbar } from "../components/Navbar";

export const metadata = {
  title: "JobOS - Apply anywhere. Forget nothing.",
  description: "The job-search operating system with persistent application memory.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main style={{ minHeight: "calc(100vh - 64px)", paddingBottom: "60px" }}>{children}</main>
      </body>
    </html>
  );
}
