"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredUser, clearSession } from "@/lib/client";

const NAV_LINKS = [
  { href: "/find-donors", label: "Find Donors" },
  { href: "/camps", label: "Blood Camps" },
  { href: "/organizations", label: "Organizations" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [user, setUser] = useState<{ fullName?: string; role?: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser() as { fullName?: string; role?: string } | null);
    const onStorage = () => setUser(getStoredUser() as { fullName?: string; role?: string } | null);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isStaff = user?.role && user.role !== "DONOR";

  return (
    <header className="bm-navbar">
      <div className="bm-container bm-navbar-inner">
        <Link href="/" className="bm-brand">
          <span className="bm-brand-mark">🩸</span>
          Blood&nbsp;Mithra
        </Link>

        <nav className="bm-nav-links" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
          <Link href="/emergency" style={{ color: "var(--bm-red)", fontWeight: 700 }}>🚨 Emergency</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/emergency" className="bm-btn bm-btn-primary bm-btn-sm" style={{ display: "none" }} aria-hidden />
          {user ? (
            <>
              <Link href={isStaff ? "/admin" : "/dashboard"} className="bm-btn bm-btn-outline bm-btn-sm">
                {isStaff ? "Admin Panel" : "My Dashboard"}
              </Link>
              <button
                className="bm-btn bm-btn-ghost bm-btn-sm"
                onClick={() => { clearSession(); setUser(null); window.location.href = "/"; }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="bm-btn bm-btn-ghost bm-btn-sm">Login</Link>
              <Link href="/become-donor" className="bm-btn bm-btn-primary bm-btn-sm">Become a Donor</Link>
            </>
          )}
          <button
            className="bm-btn bm-btn-outline bm-btn-sm md:hidden"
            style={{ display: "inline-flex" }}
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </div>

      {open ? (
        <div className="bm-container" style={{ paddingBottom: 14 }}>
          <nav className="flex flex-col gap-1 md:hidden" aria-label="Mobile">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ padding: "10px 4px", fontWeight: 600, color: "var(--bm-slate)", textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
            <Link href="/emergency" onClick={() => setOpen(false)} style={{ padding: "10px 4px", fontWeight: 700, color: "var(--bm-red)", textDecoration: "none" }}>
              🚨 Emergency Request
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
