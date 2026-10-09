"use client";

import Link from "next/link";
import { SiteBrand, ContactLines, useSiteSettings } from "@/components/Site";

export function Footer() {
  const site = useSiteSettings();
  return (
    <footer className="bm-footer">
      <div className="bm-container">
        <div className="bm-grid-3" style={{ gap: 32 }}>
          <div>
            <SiteBrand color="#fff" />
            <p style={{ color: "#98a2b3", fontSize: 14, lineHeight: 1.7, marginTop: 14, maxWidth: 320 }}>
              A community-powered blood donor network. {site.tagline}
            </p>
          </div>
          <div>
            <h4 style={{ color: "#fff", margin: "0 0 14px", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>Platform</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 9, fontSize: 14.5 }}>
              <li><Link href="/find-donors">Find Donors</Link></li>
              <li><Link href="/become-donor">Become a Donor</Link></li>
              <li><Link href="/emergency">Emergency Request</Link></li>
              <li><Link href="/camps">Blood Camps</Link></li>
              <li><Link href="/organizations">Organizations</Link></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: "#fff", margin: "0 0 14px", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>Contact</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 9, fontSize: 14.5 }}>
              <ContactLines light />
              <li><Link href="/about">About &amp; Contact</Link></li>
            </ul>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #1f2937", marginTop: 40, paddingTop: 22, fontSize: 13, color: "#98a2b3", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>© {new Date().getFullYear()} {site.name}. All rights reserved.</span>
          <span>Made with ❤️ for humanity</span>
        </div>
      </div>
    </footer>
  );
}
