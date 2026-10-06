import React from "react";
import "./globals.css";
import { Navbar } from "../components/Navbar";

export const metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "Jovo - Apply smarter. Get hired faster.",
  description:
    "AI-assisted job applications with application memory. Apply smarter. Get hired faster.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Jovo - Apply smarter. Get hired faster.",
    description: "AI-assisted job applications with application memory.",
    siteName: "Jovo",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Jovo - Apply smarter. Get hired faster.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
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
