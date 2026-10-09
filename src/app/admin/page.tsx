"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, getStoredUser, getToken } from "@/lib/client";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";
import { BLOOD_GROUPS } from "@/lib/client";

type Tab =
  | "overview"
  | "donors"
  | "requests"
  | "certificates"
  | "volunteers"
  | "hospitals"
  | "reports"
  | "site"
  | "brand"
  | SiteTab
  | "manage-orgs"
  | "manage-camps";

type SiteTab = "home" | "about";

const STAFF_ROLES = new Set([
  "SUPER_ADMIN", "REGIONAL_ADMIN", "HOSPITAL_COORDINATOR",
  "BLOOD_BANK_OPERATOR", "NGO_ORGANIZER", "SUPPORT_AGENT", "AUDITOR",
]);

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    const role = String(u?.role ?? "");
    if (!u || !STAFF_ROLES.has(role)) setDenied(true);
  }, []);

  if (denied) {
    return (
      <main className="bm-section"><div className="bm-container" style={{ maxWidth: 560 }}>
        <div className="bm-card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <h2 style={{ margin: "10px 0 6px" }}>Staff access required</h2>
          <p style={{ color: "var(--bm-slate)" }}>
            The Project Control Dashboard is restricted to authorized staff roles.
            Demo admin: <strong>admin@bloodmithra.org / admin123</strong>
          </p>
          <Link href="/login" className="bm-btn bm-btn-primary">Login</Link>
        </div>
      </div></main>
    );
  }

  const opsTabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Project Control", icon: "📊" },
    { id: "donors", label: "Donors", icon: "🩸" },
    { id: "requests", label: "Blood Requests", icon: "🚨" },
    { id: "certificates", label: "Certificates", icon: "📜" },
    { id: "volunteers", label: "Volunteers", icon: "🙋" },
    { id: "hospitals", label: "Hospitals", icon: "🏥" },
    { id: "reports", label: "Reports & Analytics", icon: "📈" },
  ];
  const directoryTabs: { id: Tab; label: string; icon: string }[] = [
    { id: "manage-orgs", label: "Organizations", icon: "🏛️" },
    { id: "manage-camps", label: "Blood Camps", icon: "⛺" },
  ];
  const siteTabs: { id: Tab; label: string; icon: string }[] = [
    { id: "site", label: "Content Guide", icon: "🎨" },
    { id: "brand", label: "Branding & contact", icon: "🏷️" },
    { id: "home", label: "Home page", icon: "🏠" },
    { id: "about", label: "About page", icon: "ℹ️" },
  ];
  const renderTabLink = (t: { id: Tab; label: string; icon: string }) => (
    <a
      key={t.id}
      href="#"
      className={tab === t.id ? "active" : ""}
      onClick={(e) => { e.preventDefault(); setTab(t.id); }}
    >
      <span>{t.icon}</span> {t.label}
    </a>
  );

  return (
    <main style={{ minHeight: "70vh" }}>
      <div className="bm-dashboard-shell">
        <aside className="bm-sidebar">
          <div style={{ padding: "4px 12px 16px" }}>
            <div className="bm-eyebrow">Blood Mithra</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>Project Control</div>
            <div style={{ fontSize: 12, color: "var(--bm-muted)", marginTop: 2 }}>
              {user?.fullName ? String(user.fullName) : ""}
              <br />{user?.role ? String(user.role).replace(/_/g, " ") : ""}
            </div>
          </div>
          <div className="bm-eyebrow" style={{ padding: "0 12px 6px", fontSize: 11 }}>Operations</div>
          {opsTabs.map(renderTabLink)}
          <div className="bm-eyebrow" style={{ padding: "14px 12px 6px", fontSize: 11 }}>Directory · editable content</div>
          {directoryTabs.map(renderTabLink)}
          <div className="bm-eyebrow" style={{ padding: "14px 12px 6px", fontSize: 11 }}>Website · page content</div>
          {siteTabs.map(renderTabLink)}
          <div style={{ marginTop: 18, padding: "0 12px" }}>
            <Link href="/" className="bm-btn bm-btn-ghost bm-btn-sm" style={{ width: "100%" }}>← Back to site</Link>
          </div>
        </aside>

        <div style={{ padding: "28px 24px", minWidth: 0 }}>
          {tab === "overview" ? <OverviewTab /> : null}
          {tab === "donors" ? <DonorsTab /> : null}
          {tab === "requests" ? <RequestsTab /> : null}
          {tab === "certificates" ? <CertificatesTab /> : null}
          {tab === "volunteers" ? <VolunteersTab /> : null}
          {tab === "reports" ? <ReportsTab /> : null}
          {tab === "site" ? (
            <div className="bm-card" style={{ padding: 24, maxWidth: 720 }}>
              <div className="bm-page-header">
                <div>
                  <span className="bm-eyebrow">Website customization</span>
                  <h2 className="bm-h2" style={{ fontSize: 24 }}>Site content</h2>
                  <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 6 }}>
                    Only content pages are editable here: <strong>Branding & contact</strong>, <strong>Home</strong> and <strong>About</strong>.
                    Functional pages (Find donors, Become a donor, Emergency, Camps, Organizations) render live data and forms — they have no editable copy.
                  </p>
                </div>
              </div>
              <ul className="bm-card" style={{ padding: 16, listStyle: "disc", marginLeft: 20 }}>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setTab("brand"); }}>🏷️ Branding & contact</a> — site logo, name, tagline, email, phone, address.</li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setTab("home"); }}>🏠 Home page</a> — hero banner, headline, subcopy, CTA and FAQ shown on /</li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setTab("about"); }}>ℹ️ About page</a> — hero, mission cards, contact section, CTA and FAQ shown on /about</li>
              </ul>
              <div className="bm-card" style={{ padding: 16, marginTop: 12 }}>
                <h4 style={{ margin: "0 0 8px" }}>Directory content (fully editable)</h4>
                <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--bm-slate)" }}>
                  Camp and organization <em>listings</em> are separate from page headings. Use these tabs to add / edit / remove entries:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setTab("manage-camps")}>⛺ Manage blood camps</button>
                  <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setTab("manage-orgs")}>🏛️ Manage organizations</button>
                  <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setTab("volunteers")}>🙋 Manage volunteers</button>
                  <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setTab("hospitals")}>🏥 Manage hospitals</button>
                  <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setTab("donors")}>🩸 Manage donors</button>
                  <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setTab("requests")}>🚨 Manage requests</button>
                </div>
              </div>
            </div>
          ) : null}
          {tab === "manage-orgs" ? <OrganizationsTab /> : null}
          {tab === "manage-camps" ? <BloodCampsTab /> : null}
          {tab === "hospitals" ? <HospitalsTab /> : null}
          {tab === "brand" ? <BrandTab /> : null}
          {tab === "home" ? <HomeContentTab /> : null}
          {tab === "about" ? <AboutContentTab /> : null}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------- Overview ---------------------------------- */

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<any>("/api/v1/admin")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) return <div className="bm-alert bm-alert-error">{error}</div>;
  if (!data) return <div className="bm-grid-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bm-card" style={{ padding: 20 }}><div className="bm-skeleton" style={{ height: 44 }} /></div>)}</div>;

  const D = data.donors ?? {};
  const V = data.volunteers ?? {};
  const R = data.requests ?? {};
  const DN = data.donations ?? {};
  const C = data.certificates ?? {};
  const S = data.schedule ?? {};
  const E = data.ecosystem ?? {};

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Project control dashboard</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Network at a glance</h2>
        </div>
        <a href="/api/v1/admin/donors" className="bm-btn bm-btn-outline bm-btn-sm" target="_blank" rel="noreferrer">Export donors (API)</a>
      </div>

      <h4 style={{ margin: "0 0 10px", color: "var(--bm-slate)" }}>Donors</h4>
      <div className="bm-grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Total donors" value={D.total ?? 0} icon="🩸" />
        <StatCard label="Active donors" value={D.active ?? 0} icon="✅" accent="green" />
        <StatCard label="Verified donors" value={D.verified ?? 0} icon="🛡️" accent="blue" />
        <StatCard label="Eligible donors" value={D.eligible ?? 0} icon="💉" accent="green" />
        <StatCard label="Temporarily deferred" value={D.temporarilyDeferred ?? 0} icon="⏸️" accent="amber" />
        <StatCard label="Health review pending" value={D.healthReviewPending ?? 0} icon="🩺" accent="red" />
        <StatCard label="New today" value={D.newToday ?? 0} icon="✨" accent="blue" />
        <StatCard label="Pending verification" value={D.pendingVerification ?? 0} icon="📋" accent="amber" />
      </div>

      <h4 style={{ margin: "0 0 10px", color: "var(--bm-slate)" }}>Registrations</h4>
      <div className="bm-grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="This week" value={D.newThisWeek ?? 0} icon="📅" accent="blue" />
        <StatCard label="This month" value={D.newThisMonth ?? 0} icon="📆" accent="blue" />
        <StatCard label="Available now" value={D.availableNow ?? 0} icon="🟢" accent="green" />
        <StatCard label="Overdue confirmations" value={D.overdueConfirmation ?? 0} icon="⏰" accent="red" />
      </div>

      <h4 style={{ margin: "0 0 10px", color: "var(--bm-slate)" }}>Volunteers</h4>
      <div className="bm-grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Total volunteers" value={V.total ?? 0} icon="🙋" />
        <StatCard label="Active volunteers" value={V.active ?? 0} icon="🟢" accent="green" />
      </div>

      <h4 style={{ margin: "0 0 10px", color: "var(--bm-slate)" }}>Blood requests</h4>
      <div className="bm-grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Total requests" value={R.total ?? 0} icon="🚨" />
        <StatCard label="Emergency (critical)" value={R.emergency ?? 0} icon="🔴" accent="red" />
        <StatCard label="High urgency" value={R.high ?? 0} icon="🟠" accent="amber" />
        <StatCard label="Fulfilled" value={R.fulfilled ?? 0} icon="✅" accent="green" />
        <StatCard label="Pending" value={R.pending ?? 0} icon="⏳" accent="amber" />
      </div>

      <h4 style={{ margin: "0 0 10px", color: "var(--bm-slate)" }}>Donations &amp; certificates</h4>
      <div className="bm-grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Total donations" value={DN.total ?? 0} icon="💉" />
        <StatCard label="Donations this month" value={DN.thisMonth ?? 0} icon="📈" accent="blue" />
        <StatCard label="Certificates pending" value={C.pending ?? 0} icon="📜" accent="amber" />
        <StatCard label="Certificates received" value={C.received ?? 0} icon="📬" accent="green" />
      </div>

      <h4 style={{ margin: "0 0 10px", color: "var(--bm-slate)" }}>Schedule &amp; ecosystem</h4>
      <div className="bm-grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Upcoming donations (7d)" value={S.upcomingDonations?.[0]?.c ?? 0} icon="🗓️" accent="blue" />
        <StatCard label="Upcoming camps" value={S.upcomingCamps?.length ?? 0} icon="⛺" accent="green" />
        <StatCard label="Overdue follow-ups" value={S.overdueFollowUps ?? 0} icon="⚠️" accent="red" />
        <StatCard label="Hospitals / Orgs" value={`${E.hospitals ?? 0} / ${E.organizations ?? 0}`} icon="🏥" />
      </div>

      <div className="bm-grid-2">
        <div className="bm-card" style={{ padding: 20 }}>
          <h4 style={{ margin: "0 0 12px" }}>Blood group distribution</h4>
          {(D.byBloodGroup ?? []).map((b: any) => (
            <div key={b.bloodGroup} style={{ marginBottom: 8 }}>
              <div className="flex justify-between" style={{ fontSize: 13, fontWeight: 650, marginBottom: 4 }}>
                <span className="bm-blood-chip" style={{ minWidth: 36, padding: "2px 8px", fontSize: 12 }}>{b.bloodGroup}</span>
                <span>{b.count}</span>
              </div>
              <div className="bm-bar-track"><div className="bm-bar-fill" style={{ width: `${Math.max(4, (b.count / Math.max(1, D.total)) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="bm-card" style={{ padding: 20 }}>
          <h4 style={{ margin: "0 0 12px" }}>Open blood requests</h4>
          {(R.open ?? []).length === 0 ? <p style={{ color: "var(--bm-muted)", fontSize: 14 }}>No open requests. 🎉</p> : (
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead><tr><th>ID</th><th>Blood</th><th>Units</th><th>Urgency</th><th>City</th><th>Status</th></tr></thead>
                <tbody>
                  {(R.open ?? []).map((r: any) => (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td><span className="bm-blood-chip" style={{ minWidth: 34, padding: "2px 8px", fontSize: 12 }}>{r.bloodGroup}</span></td>
                      <td>{r.unitsRequired}</td>
                      <td><Badge value={r.urgency} /></td>
                      <td>{r.city ?? "—"}</td>
                      <td><Badge value={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Donors ------------------------------------ */

function DonorsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState({ search: "", bloodGroup: "", city: "", district: "", status: "", eligibility: "", health: "", verification: "", sort: "registrationDate", order: "desc" });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v) params.set(k, v);
      params.set("page", String(page));
      params.set("pageSize", "15");
      const data = await apiFetch<any>(`/api/v1/admin/donors?${params.toString()}`);
      setRows(data.data);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load donors");
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const [editing, setEditing] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const act = async (donorId: number, action: string, extra: Record<string, unknown> = {}) => {
    try {
      await apiFetch("/api/v1/admin/donors", {
        method: "PATCH",
        body: JSON.stringify({ donorId, action, ...extra }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const startEdit = (r: any) => {
    setEditing({
      donorId: r.id, fullName: r.fullName ?? "", mobile: r.mobile ?? "", email: (r as any).email ?? "",
      bloodGroup: r.bloodGroup ?? "", city: r.city ?? "", district: r.district ?? "",
      availabilityStatus: r.availabilityStatus ?? "AVAILABLE", eligibilityStatus: r.eligibilityStatus ?? "ELIGIBLE",
      healthStatus: r.healthStatus ?? "HEALTHY", isProfileVerified: !!r.isProfileVerified,
    });
    setIsEditing(true); setFormError(null); setSaved(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true); setFormError(null);
    try {
      await apiFetch("/api/v1/admin/donors", { method: "PATCH", body: JSON.stringify({ ...editing, action: "edit" }) });
      setIsEditing(false); setEditing(null); setSaved("Donor updated."); load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const removeDonor = async (id: number, name: string) => {
    if (!window.confirm(`Remove donor "${name}"? This deletes their profile and history.`)) return;
    try {
      await apiFetch("/api/v1/admin/donors", { method: "DELETE", body: JSON.stringify({ donorId: id }) });
      setSaved("Donor removed."); load();
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  };

  const set = (k: string, v: string) => { setQ((f) => ({ ...f, [k]: v })); setPage(1); };

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Donor management</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Donors ({total})</h2>
        </div>
        <a href="/api/v1/admin/donors?" download className="bm-btn bm-btn-outline bm-btn-sm" onClick={(e) => {
          e.preventDefault();
          apiFetch<any>("/api/v1/admin/donors").then(() => {});
          window.open("/api/v1/admin/donors", "_blank");
        }}>Export CSV</a>
      </div>

      <div className="bm-card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="bm-form-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className="bm-field"><label className="bm-label">Search</label>
            <input className="bm-input" placeholder="Name / mobile / city" value={q.search} onChange={(e) => set("search", e.target.value)} /></div>
          <div className="bm-field"><label className="bm-label">Blood group</label>
            <select className="bm-select" value={q.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
              <option value="">Any</option>{BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
            </select></div>
          <div className="bm-field"><label className="bm-label">City</label>
            <input className="bm-input" value={q.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div className="bm-field"><label className="bm-label">District</label>
            <input className="bm-input" value={q.district} onChange={(e) => set("district", e.target.value)} /></div>
          <div className="bm-field"><label className="bm-label">Status</label>
            <select className="bm-select" value={q.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">Any</option>
              {["ACTIVE", "RECENTLY_DONATED", "VERIFIED", "REGULAR_DONOR", "INACTIVE", "TEMPORARILY_DEFERRED", "UNDER_REVIEW"].map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div className="bm-field"><label className="bm-label">Eligibility</label>
            <select className="bm-select" value={q.eligibility} onChange={(e) => set("eligibility", e.target.value)}>
              <option value="">Any</option><option>ELIGIBLE</option><option>TEMPORARILY_DEFERRED</option><option>UNDER_REVIEW</option>
            </select></div>
          <div className="bm-field"><label className="bm-label">Health</label>
            <select className="bm-select" value={q.health} onChange={(e) => set("health", e.target.value)}>
              <option value="">Any</option><option>HEALTHY</option><option>TEMPORARY_DEFERRAL</option><option>UNDER_REVIEW</option><option>INELIGIBLE</option>
            </select></div>
          <div className="bm-field"><label className="bm-label">Verification</label>
            <select className="bm-select" value={q.verification} onChange={(e) => set("verification", e.target.value)}>
              <option value="">Any</option><option value="verified">Verified</option><option value="unverified">Unverified</option>
            </select></div>
        </div>
      </div>

      {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {saved ? <div className="bm-alert bm-alert-success" style={{ marginBottom: 12 }}>{saved}</div> : null}
      {formError ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{formError}</div> : null}

      {isEditing && editing && (
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="bm-card" style={{ padding: 20, marginBottom: 16, maxWidth: 760 }}>
          <h4 style={{ margin: "0 0 12px" }}>Edit donor #{editing.donorId}</h4>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">Full name *</label>
              <input className="bm-input" value={editing.fullName} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} required /></div>
            <div className="bm-field"><label className="bm-label">Mobile *</label>
              <input className="bm-input" inputMode="numeric" value={editing.mobile} onChange={(e) => setEditing({ ...editing, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} required /></div>
            <div className="bm-field"><label className="bm-label">Email</label>
              <input className="bm-input" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Blood group *</label>
              <select className="bm-select" value={editing.bloodGroup} onChange={(e) => setEditing({ ...editing, bloodGroup: e.target.value })}>
                {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
              </select></div>
            <div className="bm-field"><label className="bm-label">City</label>
              <input className="bm-input" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">District</label>
              <input className="bm-input" value={editing.district} onChange={(e) => setEditing({ ...editing, district: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Availability</label>
              <select className="bm-select" value={editing.availabilityStatus} onChange={(e) => setEditing({ ...editing, availabilityStatus: e.target.value })}>
                {["AVAILABLE", "UNAVAILABLE"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="bm-field"><label className="bm-label">Eligibility</label>
              <select className="bm-select" value={editing.eligibilityStatus} onChange={(e) => setEditing({ ...editing, eligibilityStatus: e.target.value })}>
                {["ELIGIBLE", "TEMPORARILY_DEFERRED", "UNDER_REVIEW"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="bm-field"><label className="bm-label">Health</label>
              <select className="bm-select" value={editing.healthStatus} onChange={(e) => setEditing({ ...editing, healthStatus: e.target.value })}>
                {["HEALTHY", "TEMPORARY_DEFERRAL", "UNDER_REVIEW", "INELIGIBLE"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="bm-field"><label className="bm-label">Verified</label>
              <select className="bm-select" value={editing.isProfileVerified ? "yes" : "no"} onChange={(e) => setEditing({ ...editing, isProfileVerified: e.target.value === "yes" })}>
                <option value="yes">Verified</option>
                <option value="no">Unverified</option>
              </select></div>
          </div>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
            <button type="submit" className="bm-btn bm-btn-primary bm-btn-sm" disabled={saving}>{saving ? "Saving…" : "Update donor"}</button>
            <button type="button" className="bm-btn bm-btn-ghost bm-btn-sm" disabled={saving} onClick={() => { setIsEditing(false); setEditing(null); }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="bm-table-wrap">
        <table className="bm-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Mobile</th><th>Blood</th><th>Age</th><th>City</th>
              <th>Verified</th><th>Health</th><th>Eligibility</th><th>Status</th>
              <th>Last donation</th><th>Next eligible</th><th>Donations</th><th>Certificate</th><th>Volunteer</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={16} style={{ textAlign: "center", padding: 24 }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={16} style={{ textAlign: "center", padding: 24 }}>No donors found</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td style={{ fontWeight: 650 }}>{r.fullName}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12.5 }}>{r.mobile}</td>
                <td><span className="bm-blood-chip" style={{ minWidth: 34, padding: "2px 8px", fontSize: 12 }}>{r.bloodGroup}</span></td>
                <td>{r.age ?? "—"}</td>
                <td>{r.city ?? "—"}</td>
                <td><Badge value={r.isProfileVerified ? "true" : "false"} /></td>
                <td><Badge value={r.healthStatus} /></td>
                <td><Badge value={r.eligibilityStatus} /></td>
                <td><Badge value={r.status} /></td>
                <td>{r.lastDonationDate ?? "—"}</td>
                <td>{r.nextEligibleDate ?? "—"}</td>
                <td>{r.totalDonations}</td>
                <td>{r.certificateStatus ? <Badge value={r.certificateStatus} /> : "—"}</td>
                <td style={{ fontSize: 12.5 }}>{r.assignedVolunteer ?? "—"}</td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => startEdit(r)}>Edit</button>
                    {!r.isProfileVerified ? (
                      <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => act(r.id, "verify")}>Verify</button>
                    ) : null}
                    <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => act(r.id, "status", { status: r.status === "INACTIVE" ? "ACTIVE" : "INACTIVE" })}>
                      {r.status === "INACTIVE" ? "Activate" : "Deactivate"}
                    </button>
                    <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => removeDonor(r.id, r.fullName)}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between" style={{ marginTop: 14 }}>
        <span style={{ fontSize: 13, color: "var(--bm-muted)" }}>
          Page {page} · {total} donor{total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <button className="bm-btn bm-btn-outline bm-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <button className="bm-btn bm-btn-outline bm-btn-sm" disabled={page * 15 >= total} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Requests ---------------------------------- */

function RequestsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>("/api/v1/blood-requests");
      setRows(data.data);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const [editing, setEditing] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const advance = async (id: number, status: string) => {
    try {
      await apiFetch(`/api/v1/blood-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };

  const nextWave = async (id: number) => {
    try {
      await apiFetch(`/api/v1/blood-requests/${id}?action=next-wave`, { method: "PATCH", body: "{}" });
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };

  const startEdit = (r: any) => {
    setEditing({
      id: r.id, bloodGroup: r.bloodGroup ?? "", unitsRequired: String(r.unitsRequired ?? 1),
      urgency: r.urgency ?? "MEDIUM", hospitalName: r.hospitalName ?? "", city: r.city ?? "",
      district: r.district ?? "", requesterName: r.requesterName ?? "", requesterPhone: r.requesterPhone ?? "",
      details: r.details ?? "", status: r.status ?? "CREATED",
    });
    setIsEditing(true); setFormError(null); setSaved(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true); setFormError(null);
    try {
      await apiFetch(`/api/v1/blood-requests/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...editing, unitsRequired: Number(editing.unitsRequired) || 1 }),
      });
      setIsEditing(false); setEditing(null); setSaved("Blood request updated."); load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const removeReq = async (id: number) => {
    if (!window.confirm(`Delete blood request #${id}?`)) return;
    try { await apiFetch(`/api/v1/blood-requests/${id}`, { method: "DELETE" }); setSaved("Request deleted."); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  };

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Request tracking</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Blood requests</h2>
          <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 6 }}>
            Edit details, advance lifecycle, trigger waves or remove requests.
          </p>
        </div>
        <Link href="/emergency" className="bm-btn bm-btn-primary bm-btn-sm">🚨 New request</Link>
      </div>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
        {summary.map((s) => <span key={s.status} className="bm-badge bm-badge-gray">{s.status}: {s.count}</span>)}
      </div>
      {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {saved ? <div className="bm-alert bm-alert-success" style={{ marginBottom: 12 }}>{saved}</div> : null}
      {formError ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{formError}</div> : null}
      {isEditing && editing && (
        <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="bm-card" style={{ padding: 20, marginBottom: 16, maxWidth: 760 }}>
          <h4 style={{ margin: "0 0 12px" }}>Edit request #{editing.id}</h4>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">Blood group</label>
              <select className="bm-select" value={editing.bloodGroup} onChange={(e) => setEditing({ ...editing, bloodGroup: e.target.value })}>
                {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
              </select></div>
            <div className="bm-field"><label className="bm-label">Units</label>
              <input type="number" min={1} max={20} className="bm-input" value={editing.unitsRequired} onChange={(e) => setEditing({ ...editing, unitsRequired: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Urgency</label>
              <select className="bm-select" value={editing.urgency} onChange={(e) => setEditing({ ...editing, urgency: e.target.value })}>
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="bm-field"><label className="bm-label">Status</label>
              <select className="bm-select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {["CREATED", "VERIFICATION", "DONORS_NOTIFIED", "RESPONSES_CONFIRMED", "CONFIRMED", "COLLECTED", "FULFILLED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="bm-field"><label className="bm-label">Hospital</label>
              <input className="bm-input" value={editing.hospitalName} onChange={(e) => setEditing({ ...editing, hospitalName: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">City</label>
              <input className="bm-input" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">District</label>
              <input className="bm-input" value={editing.district} onChange={(e) => setEditing({ ...editing, district: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Requester</label>
              <input className="bm-input" value={editing.requesterName} onChange={(e) => setEditing({ ...editing, requesterName: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Phone</label>
              <input className="bm-input" value={editing.requesterPhone} onChange={(e) => setEditing({ ...editing, requesterPhone: e.target.value })} /></div>
          </div>
          <div className="bm-field" style={{ marginTop: 12 }}><label className="bm-label">Details</label>
            <textarea className="bm-textarea" rows={2} value={editing.details} onChange={(e) => setEditing({ ...editing, details: e.target.value })} /></div>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
            <button type="submit" className="bm-btn bm-btn-primary bm-btn-sm" disabled={saving}>{saving ? "Saving…" : "Update request"}</button>
            <button type="button" className="bm-btn bm-btn-ghost bm-btn-sm" disabled={saving} onClick={() => { setIsEditing(false); setEditing(null); }}>Cancel</button>
          </div>
        </form>
      )}
      <div className="bm-table-wrap">
        <table className="bm-table">
          <thead><tr><th>ID</th><th>Blood</th><th>Units</th><th>Urgency</th><th>Hospital</th><th>City</th><th>Status</th><th>Notified</th><th>Responses</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={10} style={{ textAlign: "center", padding: 24 }}>Loading…</td></tr> : rows.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 24 }}>No requests yet</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td><span className="bm-blood-chip" style={{ minWidth: 34, padding: "2px 8px", fontSize: 12 }}>{r.bloodGroup}</span></td>
                <td>{r.unitsRequired}</td>
                <td><Badge value={r.urgency} /></td>
                <td>{r.hospitalName ?? "—"}</td>
                <td>{r.city ?? "—"}</td>
                <td><Badge value={r.status} /></td>
                <td>{r.donorsNotified}</td>
                <td>{r.responsesReceived}</td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => startEdit(r)}>Edit</button>
                    {r.currentWave < 3 && r.status !== "FULFILLED" && r.status !== "CANCELLED" ? (
                      <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => nextWave(r.id)}>Wave {r.currentWave + 1}</button>
                    ) : null}
                    {r.status !== "FULFILLED" && r.status !== "CANCELLED" ? (
                      <>
                        <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => advance(r.id, "CONFIRMED")}>Confirm</button>
                        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={() => advance(r.id, "FULFILLED")}>Fulfilled</button>
                      </>
                    ) : null}
                    <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => removeReq(r.id)}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------- Certificates --------------------------------- */

function CertificatesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      const data = await apiFetch<any>(`/api/v1/certificates?${params.toString()}`);
      setRows(data.data);
      setTotals(data.totals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load certificates");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  const advance = async (id: number, next: string) => {
    try {
      await apiFetch("/api/v1/certificates", { method: "PATCH", body: JSON.stringify({ id, status: next }) });
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };

  const NEXT: Record<string, string> = { PENDING: "GENERATED", GENERATED: "ISSUED", ISSUED: "RECEIVED", RECEIVED: "VERIFIED" };

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Certificate tracking</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Donation certificates</h2>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
        {totals.map((t) => <span key={t.status} className="bm-badge bm-badge-gray">{t.status}: {t.count}</span>)}
      </div>
      <div className="bm-card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="bm-form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="bm-field"><label className="bm-label">Search (donor / certificate #)</label>
            <input className="bm-input" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="bm-field"><label className="bm-label">Status</label>
            <select className="bm-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any</option>
              {["PENDING", "GENERATED", "ISSUED", "RECEIVED", "VERIFIED"].map((s) => <option key={s}>{s}</option>)}
            </select></div>
        </div>
      </div>
      {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <div className="bm-table-wrap">
        <table className="bm-table">
          <thead><tr><th>Certificate #</th><th>Donor</th><th>Blood</th><th>Donation date</th><th>Status</th><th>Issued</th><th>Received</th><th>Action</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 24 }}>Loading…</td></tr> : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 24 }}>No certificates found</td></tr>
            ) : rows.map((r) => {
              const cert = r.certificate ?? r;
              const next = NEXT[cert.status];
              return (
                <tr key={cert.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{cert.certificateNumber}</td>
                  <td style={{ fontWeight: 650 }}>{r.donorName ?? `#${cert.donorId}`}</td>
                  <td>{r.donorBloodGroup ?? "—"}</td>
                  <td>{r.donationDate ?? "—"}</td>
                  <td><Badge value={cert.status} /></td>
                  <td>{cert.issuedDate ?? "—"}</td>
                  <td>{cert.receivedDate ?? "—"}</td>
                  <td>{next ? <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => advance(cert.id, next)}>Mark {next}</button> : <Badge value="VERIFIED" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ Volunteers ---------------------------------- */

function VolunteersTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      setData(await apiFetch<any>(`/api/v1/volunteers?${params.toString()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load volunteers");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const blank = () => ({
    id: null, name: "", mobile: "", email: "", district: "", city: "",
    assignedArea: "", availability: "FLEXIBLE", status: "ACTIVE",
    responsibility: "", coordinator: "",
  });

  const startAdd = () => { setEditing(blank()); setIsEditing(true); setFormError(null); };
  const startEdit = (v: any) => {
    setEditing({
      id: v.id, name: v.name ?? "", mobile: v.mobile ?? "", email: v.email ?? "",
      district: v.district ?? "", city: v.city ?? "", assignedArea: v.assignedArea ?? "",
      availability: v.availability ?? "FLEXIBLE", status: v.status ?? "ACTIVE",
      responsibility: v.responsibility ?? "", coordinator: v.coordinator ?? "",
    });
    setIsEditing(true); setFormError(null);
  };
  const cancel = () => { setIsEditing(false); setEditing(null); setFormError(null); };

  const save = async () => {
    if (!editing?.name?.trim()) { setFormError("Volunteer name is required"); return; }
    if (!/^[6-9]\d{9}$/.test((editing.mobile ?? "").trim())) { setFormError("Valid 10-digit mobile is required"); return; }
    setSaving(true); setFormError(null);
    try {
      if (editing.id) {
        await apiFetch("/api/v1/volunteers", { method: "PATCH", body: JSON.stringify(editing) });
        setSaved("Volunteer updated.");
      } else {
        await apiFetch("/api/v1/volunteers", { method: "POST", body: JSON.stringify(editing) });
        setSaved("Volunteer added.");
      }
      setIsEditing(false); setEditing(null); await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const setStatus = async (id: number, status: string) => {
    setSaving(true);
    try { await apiFetch("/api/v1/volunteers", { method: "PATCH", body: JSON.stringify({ id, status }) }); setSaved(`Volunteer ${status.toLowerCase()}.`); await load(); }
    catch (e) { setFormError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: number, name: string) => {
    if (!window.confirm(`Remove volunteer "${name}"?`)) return;
    setSaving(true);
    try { await apiFetch("/api/v1/volunteers", { method: "DELETE", body: JSON.stringify({ id }) }); setSaved("Volunteer removed."); await load(); }
    catch (e) { setFormError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setSaving(false); }
  };

  if (error) return <div className="bm-alert bm-alert-error">{error}</div>;
  if (loading && !data) return <div className="bm-card" style={{ padding: 24 }}><div className="bm-skeleton" style={{ height: 120 }} /></div>;

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Volunteer control</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Volunteers ({data?.total ?? 0})</h2>
          <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 6 }}>
            Add, edit and remove volunteers — same as organizations and blood camps. Status changes apply instantly.
          </p>
        </div>
        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={startAdd}>+ Add volunteer</button>
      </div>
      <div className="bm-grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Total volunteers" value={data?.totals?.total ?? 0} icon="🙋" />
        <StatCard label="Active" value={data?.totals?.active ?? 0} icon="🟢" accent="green" />
        {(data?.assignments ?? []).map((a: any) => (
          <StatCard key={a.status} label={`Assignments: ${a.status}`} value={a.count} icon="📋" accent="blue" />
        ))}
      </div>
      <div className="bm-card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="bm-form-grid" style={{ gridTemplateColumns: "2fr 1fr auto" }}>
          <div className="bm-field"><label className="bm-label">Search</label>
            <input className="bm-input" placeholder="Name / city" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="bm-field"><label className="bm-label">Status</label>
            <select className="bm-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Any</option>
              {["ACTIVE", "PENDING", "ON_LEAVE", "INACTIVE"].map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div className="bm-field" style={{ justifyContent: "flex-end" }}><label className="bm-label">&nbsp;</label>
            <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={load}>↻ Refresh</button></div>
        </div>
      </div>
      {saved ? <div className="bm-alert bm-alert-success" style={{ marginBottom: 12 }}>{saved}</div> : null}
      {formError ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{formError}</div> : null}
      {isEditing && editing && (
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="bm-card" style={{ padding: 20, marginBottom: 16, maxWidth: 760 }}>
          <h4 style={{ margin: "0 0 12px" }}>{editing.id ? "Edit volunteer" : "Add volunteer"}</h4>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">Name *</label>
              <input className="bm-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></div>
            <div className="bm-field"><label className="bm-label">Mobile *</label>
              <input className="bm-input" inputMode="numeric" value={editing.mobile} onChange={(e) => setEditing({ ...editing, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} required /></div>
            <div className="bm-field"><label className="bm-label">Email</label>
              <input className="bm-input" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Status</label>
              <select className="bm-select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {["ACTIVE", "PENDING", "ON_LEAVE", "INACTIVE"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="bm-field"><label className="bm-label">District</label>
              <input className="bm-input" value={editing.district} onChange={(e) => setEditing({ ...editing, district: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">City</label>
              <input className="bm-input" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Assigned area</label>
              <input className="bm-input" value={editing.assignedArea} onChange={(e) => setEditing({ ...editing, assignedArea: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Availability</label>
              <select className="bm-select" value={editing.availability} onChange={(e) => setEditing({ ...editing, availability: e.target.value })}>
                {["FLEXIBLE", "WEEKDAYS", "WEEKENDS", "MORNING", "EVENING", "ON_CALL"].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div className="bm-field"><label className="bm-label">Coordinator</label>
              <input className="bm-input" value={editing.coordinator} onChange={(e) => setEditing({ ...editing, coordinator: e.target.value })} /></div>
          </div>
          <div className="bm-field" style={{ marginTop: 12 }}><label className="bm-label">Responsibility</label>
            <textarea className="bm-textarea" rows={2} value={editing.responsibility} onChange={(e) => setEditing({ ...editing, responsibility: e.target.value })} /></div>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
            <button type="submit" className="bm-btn bm-btn-primary bm-btn-sm" disabled={saving}>{saving ? "Saving…" : editing.id ? "Update volunteer" : "Add volunteer"}</button>
            <button type="button" className="bm-btn bm-btn-ghost bm-btn-sm" disabled={saving} onClick={cancel}>Cancel</button>
          </div>
        </form>
      )}
      <div className="bm-table-wrap">
        <table className="bm-table">
          <thead><tr><th>ID</th><th>Name</th><th>Mobile</th><th>District</th><th>Area</th><th>Status</th><th>Responsibility</th><th>Coordinator</th><th>Actions</th></tr></thead>
          <tbody>
            {(data?.data ?? []).length === 0 ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 24 }}>No volunteers yet</td></tr> :
            (data?.data ?? []).map((v: any) => (
              <tr key={v.id}>
                <td>#{v.id}</td>
                <td style={{ fontWeight: 650 }}>{v.name}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12.5 }}>{v.mobile}</td>
                <td>{v.district ?? "—"}</td>
                <td>{v.assignedArea ?? "—"}</td>
                <td><Badge value={v.status} /></td>
                <td style={{ whiteSpace: "normal", minWidth: 180 }}>{v.responsibility ?? "—"}</td>
                <td>{v.coordinator ?? "—"}</td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => startEdit(v)}>Edit</button>
                    {v.status === "ACTIVE"
                      ? <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setStatus(v.id, "INACTIVE")}>Deactivate</button>
                      : <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setStatus(v.id, "ACTIVE")}>Activate</button>}
                    <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => remove(v.id, v.name)}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ Hospitals ----------------------------------- */

function HospitalsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const data = await apiFetch<any>(`/api/v1/hospitals?${params.toString()}`);
      setRows(data.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load hospitals"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const blank = () => ({ id: null, name: "", address: "", city: "", district: "", pincode: "", phone: "", email: "", type: "HOSPITAL", status: "ACTIVE" });
  const startAdd = () => { setEditing(blank()); setIsEditing(true); setFormError(null); };
  const startEdit = (h: any) => {
    setEditing({ id: h.id, name: h.name ?? "", address: h.address ?? "", city: h.city ?? "", district: h.district ?? "", pincode: h.pincode ?? "", phone: h.phone ?? "", email: h.email ?? "", type: h.type ?? "HOSPITAL", status: h.status ?? "ACTIVE" });
    setIsEditing(true); setFormError(null);
  };

  const save = async () => {
    if (!editing?.name?.trim()) { setFormError("Hospital name is required"); return; }
    setSaving(true); setFormError(null);
    try {
      if (editing.id) await apiFetch("/api/v1/hospitals", { method: "PATCH", body: JSON.stringify(editing) });
      else await apiFetch("/api/v1/hospitals", { method: "POST", body: JSON.stringify(editing) });
      setSaved(editing.id ? "Hospital updated." : "Hospital added.");
      setIsEditing(false); setEditing(null); await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: number, name: string) => {
    if (!window.confirm(`Remove hospital "${name}"?`)) return;
    setSaving(true);
    try { await apiFetch("/api/v1/hospitals", { method: "DELETE", body: JSON.stringify({ id }) }); setSaved("Hospital removed."); await load(); }
    catch (e) { setFormError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Partner directory</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Hospitals ({rows.length})</h2>
          <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 6 }}>Add, edit and remove hospitals shown in request forms and reports.</p>
        </div>
        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={startAdd}>+ Add hospital</button>
      </div>
      <div className="bm-grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Total hospitals" value={rows.length} icon="🏥" />
        <StatCard label="Active" value={rows.filter((r) => r.status === "ACTIVE").length} icon="🟢" accent="green" />
      </div>
      <div className="bm-card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="bm-form-grid" style={{ gridTemplateColumns: "2fr auto" }}>
          <div className="bm-field"><label className="bm-label">Search</label>
            <input className="bm-input" placeholder="Name / city" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="bm-field" style={{ justifyContent: "flex-end" }}><label className="bm-label">&nbsp;</label>
            <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={load}>↻ Refresh</button></div>
        </div>
      </div>
      {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {saved ? <div className="bm-alert bm-alert-success" style={{ marginBottom: 12 }}>{saved}</div> : null}
      {formError ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{formError}</div> : null}
      {isEditing && editing && (
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="bm-card" style={{ padding: 20, marginBottom: 16, maxWidth: 720 }}>
          <h4 style={{ margin: "0 0 12px" }}>{editing.id ? "Edit hospital" : "Add hospital"}</h4>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">Name *</label>
              <input className="bm-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></div>
            <div className="bm-field"><label className="bm-label">Type</label>
              <input className="bm-input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">City</label>
              <input className="bm-input" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">District</label>
              <input className="bm-input" value={editing.district} onChange={(e) => setEditing({ ...editing, district: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Phone</label>
              <input className="bm-input" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Email</label>
              <input className="bm-input" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div className="bm-field"><label className="bm-label">Status</label>
              <select className="bm-select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select></div>
          </div>
          <div className="bm-field" style={{ marginTop: 12 }}><label className="bm-label">Address</label>
            <textarea className="bm-textarea" rows={2} value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
            <button type="submit" className="bm-btn bm-btn-primary bm-btn-sm" disabled={saving}>{saving ? "Saving…" : editing.id ? "Update hospital" : "Add hospital"}</button>
            <button type="button" className="bm-btn bm-btn-ghost bm-btn-sm" disabled={saving} onClick={() => { setIsEditing(false); setEditing(null); }}>Cancel</button>
          </div>
        </form>
      )}
      {loading ? <div className="bm-card" style={{ padding: 24 }}><div className="bm-skeleton" style={{ height: 120 }} /></div> : (
        <div className="bm-table-wrap">
          <table className="bm-table">
            <thead><tr><th>ID</th><th>Name</th><th>City</th><th>District</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 24 }}>No hospitals yet</td></tr> :
              rows.map((h: any) => (
                <tr key={h.id}>
                  <td>#{h.id}</td>
                  <td style={{ fontWeight: 650 }}>{h.name}</td>
                  <td>{h.city ?? "—"}</td>
                  <td>{h.district ?? "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12.5 }}>{h.phone ?? "—"}</td>
                  <td><Badge value={h.status} /></td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => startEdit(h)}>Edit</button>
                      <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => remove(h.id, h.name)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Branding & contact ----------------------------- */

interface BrandForm {
  name: string;
  tagline: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}

function BrandTab() {
  const [form, setForm] = useState<BrandForm>({ name: "", tagline: "", logoUrl: "", contactEmail: "", contactPhone: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ settings: { name?: string; tagline?: string; logoUrl?: string; contactEmail?: string; contactPhone?: string; address?: string; pages?: Record<string, Record<string, string>> } }>("/api/v1/settings")
      .then((d) => {
        const s = d.settings;
        setForm({
          name: s.name ?? "",
          tagline: s.tagline ?? "",
          logoUrl: s.logoUrl ?? "",
          contactEmail: s.contactEmail ?? "",
          contactPhone: s.contactPhone ?? "",
          address: s.address ?? "",
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load site content"))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof BrandForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const data = await apiFetch<{ message: string; settings: { name?: string; tagline?: string; logoUrl?: string; contactEmail?: string; contactPhone?: string; address?: string; pages?: Record<string, Record<string, string>> } }>("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setSaved(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogoFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setSaved(null);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/v1/settings/logo", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Logo upload failed");
      setSaved("Logo uploaded and applied across the site.");
      // Refresh so the new logo is shown immediately.
      const refreshed = await apiFetch<{ settings: { logoUrl?: string } }>("/api/v1/settings");
      setForm((f) => ({ ...f, logoUrl: refreshed.settings.logoUrl ?? "" }));
      setLogoFile(null);
      setLogoInputKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    setUploading(true);
    setError(null);
    setSaved(null);
    try {
      const data = await apiFetch<{ message: string }>("/api/v1/settings/logo", {
        method: "DELETE",
      });
      setSaved(`${data.message} — the default mark is shown again.`);
      setForm((f) => ({ ...f, logoUrl: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove logo");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="bm-card" style={{ padding: 24 }}><div className="bm-skeleton" style={{ height: 160 }} /></div>;

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Website customization</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Branding & contact</h2>
          <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 6 }}>
            Change the logo and contact details shown across the whole website — navbar, footer and contact sections update immediately.
          </p>
        </div>
      </div>

      {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {saved ? <div className="bm-alert bm-alert-success" style={{ marginBottom: 12 }}>{saved}</div> : null}

      <form onSubmit={save} className="bm-card" style={{ padding: 24, maxWidth: 720 }}>
        <h4 style={{ margin: "0 0 14px" }}>Branding</h4>
        <div className="bm-form-grid">
          <div className="bm-field"><label className="bm-label">Site name</label>
            <input className="bm-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Blood Mithra" /></div>
          <div className="bm-field"><label className="bm-label">Tagline</label>
            <input className="bm-input" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Every drop counts…" /></div>
        </div>

        {/* Site logo */}
        <div className="bm-field" style={{ marginTop: 14 }}>
          <label className="bm-label">Site logo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, border: "1px dashed var(--bm-line)", borderRadius: 12, background: "#fff" }}>
            <span className="bm-brand" style={{ pointerEvents: "none" }}>
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="Current logo" style={{ height: 34, width: "auto", borderRadius: 6 }} />
              ) : (
                <span className="bm-brand-mark">🩸</span>
              )}
              {form.name || "Blood Mithra"}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>
              {form.logoUrl ? "Current logo — uploading a new image replaces it." : "No logo uploaded — the default 🩸 mark is shown."}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 10 }}>
            <input
              key={logoInputKey}
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setLogoFile(f);
                if (f) uploadLogoFile(f);
              }}
            />
            <button
              type="button"
              className="bm-btn bm-btn-outline bm-btn-sm"
              disabled={uploading}
              onClick={() => logoInputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "⬆️ Upload logo"}
            </button>
            {logoFile ? (
              <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>{logoFile.name}</span>
            ) : null}
            {form.logoUrl ? (
              <button
                type="button"
                className="bm-btn bm-btn-ghost bm-btn-sm"
                disabled={uploading}
                onClick={removeLogo}
              >
                Remove logo
              </button>
            ) : null}
          </div>
          <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>
            Click Upload logo to pick a PNG, JPG, WebP or GIF (max 2MB) — it uploads automatically and appears in the navbar, footer and this preview.
          </span>
        </div>

        <h4 style={{ margin: "22px 0 14px" }}>Contact details</h4>
        <div className="bm-form-grid">
          <div className="bm-field"><label className="bm-label">Contact email</label>
            <input className="bm-input" type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="help@bloodmithra.org" /></div>
          <div className="bm-field"><label className="bm-label">Contact phone</label>
            <input className="bm-input" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="1800-000-0000" /></div>
        </div>
        <div className="bm-field" style={{ marginTop: 14 }}><label className="bm-label">Address</label>
          <input className="bm-input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Bengaluru, Karnataka, India" /></div>

        <div style={{ marginTop: 20 }}>
          <button type="submit" className="bm-btn bm-btn-primary" disabled={saving}>
            {saving ? "Saving…" : "💾 Save branding & contact"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------- Reports ----------------------------------- */

const ORG_TYPES = ["NGO", "HOSPITAL", "BLOOD_BANK", "CORPORATE", "COMMUNITY"];

function OrganizationsTab() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ data: any[]; total: number; byType: any[] }>("/api/v1/organizations");
      setOrgs(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addOrg = () => {
    setIsEditing(true);
    setEditingOrg({
      id: null,
      name: "", type: "NGO", address: "", city: "", district: "",
      contactPerson: "", phone: "", email: "", status: "ACTIVE",
    });
    setFormError(null);
    setTimeout(() => document.getElementById("org-name")?.focus(), 0);
  };

  const editOrg = (o: any) => {
    setIsEditing(true);
    setEditingOrg({
      id: o.id, name: o.name, type: o.type, address: o.address ?? "", city: o.city ?? "", district: o.district ?? "",
      contactPerson: o.contactPerson ?? "", phone: o.phone ?? "", email: o.email ?? "", status: o.status,
    });
    setFormError(null);
    setTimeout(() => document.getElementById("org-name")?.focus(), 0);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingOrg(null);
    setFormError(null);
  };

  const createOrg = async () => {
    if (!editingOrg || !editingOrg.name.trim()) {
      setFormError("Organization name is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify(editingOrg),
      });
      setIsEditing(false);
      setEditingOrg(null);
      setSaved("Organization added.");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add organization");
    } finally {
      setSaving(false);
    }
  };

  const updateOrg = async () => {
    if (!editingOrg) {
      setFormError("No organization selected");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/organizations", {
        method: "PATCH",
        body: JSON.stringify(editingOrg),
      });
      setIsEditing(false);
      setEditingOrg(null);
      setSaved("Organization updated.");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update organization");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: number, status: string) => {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/organizations", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      setSaved(`Organization ${status.toLowerCase()}.`);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to change status");
    } finally {
      setSaving(false);
    }
  };

  const removeOrg = async (id: number, name: string) => {
    if (!window.confirm(`Remove “${name}”? This cannot be undone.`)) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/organizations", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setSaved(`Organization removed.`);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to remove organization");
    } finally {
      setSaving(false);
    }
  };

  const [editingOrg, setEditingOrg] = useState<{
    id: number | null;
    name: string; type: string; address: string; city: string; district: string;
    contactPerson: string; phone: string; email: string; status: string;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const totals = orgs.reduce((acc: Record<string, number>, o: any) => {
    acc[o.type] = (acc[o.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Partner directory</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Organizations</h2>
          <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 6 }}>
            Manage partner organizations shown on the public Organizations page — add, edit and remove hospitals, blood banks, NGOs, corporates and community groups.
          </p>
        </div>
        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={addOrg}>+ Add organization</button>
      </div>

      <div className="bm-grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Total organizations" value={orgs.length} icon="🏛️" />
        {ORG_TYPES.map((t) => (
          <StatCard key={t} label={t} value={totals[t] ?? 0} icon="📋" accent="blue" />
        ))}
      </div>

      {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {saved ? <div className="bm-alert bm-alert-success" style={{ marginBottom: 12 }}>{saved}</div> : null}
      {formError ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{formError}</div> : null}

      {isEditing && editingOrg && (
        <form onSubmit={(e) => { e.preventDefault(); editingOrg.id ? updateOrg() : createOrg(); }} className="bm-card" style={{ padding: 20, marginBottom: 16, maxWidth: 720 }}>
          <h4 style={{ margin: "0 0 12px" }}>{editingOrg.id ? "Edit organization" : "Add organization"}</h4>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">Name *</label>
              <input id="org-name" className="bm-input" value={editingOrg.name} onChange={(e) => setEditingOrg((o) => o ? { ...o, name: e.target.value } : o)} required /></div>
            <div className="bm-field"><label className="bm-label">Type</label>
              <select className="bm-select" value={editingOrg.type} onChange={(e) => setEditingOrg((o) => o ? { ...o, type: e.target.value } : o)}>
                {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select></div>
          </div>
          <div className="bm-field" style={{ marginTop: 12 }}><label className="bm-label">Address</label>
            <textarea className="bm-textarea" rows={2} value={editingOrg.address} onChange={(e) => setEditingOrg((o) => o ? { ...o, address: e.target.value } : o)} /></div>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">City</label>
              <input className="bm-input" value={editingOrg.city} onChange={(e) => setEditingOrg((o) => o ? { ...o, city: e.target.value } : o)} /></div>
            <div className="bm-field"><label className="bm-label">District</label>
              <input className="bm-input" value={editingOrg.district} onChange={(e) => setEditingOrg((o) => o ? { ...o, district: e.target.value } : o)} /></div>
          </div>
          <h4 style={{ margin: "18px 0 10px" }}>Contact</h4>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">Contact person</label>
              <input className="bm-input" value={editingOrg.contactPerson} onChange={(e) => setEditingOrg((o) => o ? { ...o, contactPerson: e.target.value } : o)} /></div>
            <div className="bm-field"><label className="bm-label">Phone</label>
              <input className="bm-input" value={editingOrg.phone} onChange={(e) => setEditingOrg((o) => o ? { ...o, phone: e.target.value } : o)} /></div>
            <div className="bm-field"><label className="bm-label">Email</label>
              <input className="bm-input" type="email" value={editingOrg.email} onChange={(e) => setEditingOrg((o) => o ? { ...o, email: e.target.value } : o)} /></div>
            <div className="bm-field"><label className="bm-label">Status</label>
              <select className="bm-select" value={editingOrg.status} onChange={(e) => setEditingOrg((o) => o ? { ...o, status: e.target.value } : o)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select></div>
          </div>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
            <button type="submit" className="bm-btn bm-btn-primary bm-btn-sm" disabled={saving}>{saving ? "Saving…" : editingOrg.id ? "Update organization" : "Add organization"}</button>
            <button type="button" className="bm-btn bm-btn-ghost bm-btn-sm" disabled={saving} onClick={cancelEdit}>Cancel</button>
          </div>
        </form>
      )}

      <div className="bm-table-wrap">
        <table className="bm-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Type</th><th>City</th><th>District</th>
              <th>Contact person</th><th>Phone</th><th>Email</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 24 }}>No organizations yet</td></tr>
            ) : orgs.map((o: any) => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td style={{ fontWeight: 650 }}>{o.name}</td>
                <td><Badge value={o.type} /></td>
                <td>{o.city ?? "—"}</td>
                <td>{o.district ?? "—"}</td>
                <td style={{ whiteSpace: "normal" }}>{o.contactPerson ?? "—"}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12.5 }}>{o.phone ?? "—"}</td>
                <td style={{ fontSize: 12.5 }}>{o.email ?? "—"}</td>
                <td><Badge value={o.status} /></td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => editOrg(o)}>Edit</button>
                    {o.status === "ACTIVE" ? (
                      <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setStatus(o.id, "INACTIVE")}>Deactivate</button>
                    ) : (
                      <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => setStatus(o.id, "ACTIVE")}>Activate</button>
                    )}
                    <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => removeOrg(o.id, o.name)}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Reports ----------------------------------- */

interface ContentBlockForm {
  heroImage: string;
  heroHeadline: string;
  heroSubcopy: string;
  ctaLabel: string;
  ctaHref: string;
  faqs: { q: string; a: string }[];
  card1Title: string;
  card1Text: string;
  card2Title: string;
  card2Text: string;
  card3Title: string;
  card3Text: string;
  contactHeading: string;
  officeHours: string;
  partnerEmail: string;
}

const EMPTY_CONTENT_BLOCK: ContentBlockForm = {
  heroImage: "",
  heroHeadline: "",
  heroSubcopy: "",
  ctaLabel: "",
  ctaHref: "/",
  faqs: [],
  card1Title: "",
  card1Text: "",
  card2Title: "",
  card2Text: "",
  card3Title: "",
  card3Text: "",
  contactHeading: "",
  officeHours: "",
  partnerEmail: "",
};

function useContentBlock(pageId: SiteTab) {
  const [block, setBlock] = useState<ContentBlockForm>(EMPTY_CONTENT_BLOCK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [faqDraft, setFaqDraft] = useState<{ q: string; a: string }>({ q: "", a: "" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ settings: { pages?: { [page: string]: Partial<ContentBlockForm> } } }>("/api/v1/settings");
      const pageBlock = data.settings.pages?.[pageId];
      if (pageBlock) {
        setBlock((b) => ({
          ...b,
          heroImage: typeof pageBlock.heroImage === "string" ? pageBlock.heroImage : b.heroImage,
          heroHeadline: typeof pageBlock.heroHeadline === "string" ? pageBlock.heroHeadline : b.heroHeadline,
          heroSubcopy: typeof pageBlock.heroSubcopy === "string" ? pageBlock.heroSubcopy : b.heroSubcopy,
          ctaLabel: typeof pageBlock.ctaLabel === "string" ? pageBlock.ctaLabel : b.ctaLabel,
          ctaHref: typeof pageBlock.ctaHref === "string" ? pageBlock.ctaHref : b.ctaHref,
          faqs: Array.isArray(pageBlock.faqs) ? pageBlock.faqs : b.faqs,
          card1Title: typeof pageBlock.card1Title === "string" ? pageBlock.card1Title : b.card1Title,
          card1Text: typeof pageBlock.card1Text === "string" ? pageBlock.card1Text : b.card1Text,
          card2Title: typeof pageBlock.card2Title === "string" ? pageBlock.card2Title : b.card2Title,
          card2Text: typeof pageBlock.card2Text === "string" ? pageBlock.card2Text : b.card2Text,
          card3Title: typeof pageBlock.card3Title === "string" ? pageBlock.card3Title : b.card3Title,
          card3Text: typeof pageBlock.card3Text === "string" ? pageBlock.card3Text : b.card3Text,
          contactHeading: typeof pageBlock.contactHeading === "string" ? pageBlock.contactHeading : b.contactHeading,
          officeHours: typeof pageBlock.officeHours === "string" ? pageBlock.officeHours : b.officeHours,
          partnerEmail: typeof pageBlock.partnerEmail === "string" ? pageBlock.partnerEmail : b.partnerEmail,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page content");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  const setField = (k: keyof ContentBlockForm, v: string | { q: string; a: string }[]) => {
    setBlock((b) => ({ ...b, [k]: v }));
    setSaved(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const payload = {
        pages: {
          [pageId]: block,
        },
      };
      const data = await apiFetch<{ message: string }>("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSaved(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save page content");
    } finally {
      setSaving(false);
    }
  };

  const uploadHeroImage = async (file?: File | null) => {
    const target = file ?? heroFile;
    if (!target) return;
    setUploading(true);
    setError(null);
    setSaved(null);
    try {
      const fd = new FormData();
      fd.append("file", target);
      fd.append("page", pageId);
      fd.append("field", "heroImage");
      const res = await fetch("/api/v1/settings/images", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Hero image upload failed");
      setSaved(`Hero image uploaded and applied to ${pageId}.`);
      // Refresh the block so the new URL is shown immediately.
      const refreshed = await apiFetch<{ settings: { pages?: { [page: string]: Partial<ContentBlockForm> } } }>("/api/v1/settings");
      const pageBlock = refreshed.settings.pages?.[pageId];
      if (pageBlock) {
        setBlock((b) => ({ ...b, heroImage: pageBlock.heroImage ?? "" }));
      }
      setHeroFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hero image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeHeroImage = async () => {
    setUploading(true);
    setError(null);
    setSaved(null);
    try {
      const data = await apiFetch<{ message: string }>("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify({
          pages: {
            [pageId]: { heroImage: "" },
          },
        }),
      });
      setSaved(`Hero image removed from ${pageId}.`);
      const refreshed = await apiFetch<{ settings: { pages?: { [page: string]: Partial<ContentBlockForm> } } }>("/api/v1/settings");
      const pageBlock = refreshed.settings.pages?.[pageId];
      if (pageBlock) {
        setBlock((b) => ({ ...b, heroImage: pageBlock.heroImage ?? "" }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove hero image");
    } finally {
      setUploading(false);
    }
  };

  const addFaq = () => {
    if (!faqDraft.q.trim() || !faqDraft.a.trim()) return;
    setBlock((b) => ({ ...b, faqs: [...b.faqs, faqDraft] }));
    setFaqDraft({ q: "", a: "" });
    setSaved(null);
  };

  const updateFaq = (i: number, field: "q" | "a", v: string) => {
    setBlock((b) => ({
      ...b,
      faqs: b.faqs.map((f, idx) => (idx === i ? { ...f, [field]: v } : f)),
    }));
    setSaved(null);
  };

  const removeFaq = (i: number) => {
    setBlock((b) => ({ ...b, faqs: b.faqs.filter((_, idx) => idx !== i) }));
    setSaved(null);
  };

  return {
    block, setField, loading, saving, uploading, heroFile, setHeroFile,
    faqDraft, setFaqDraft, error, saved, save,
    uploadHeroImage, removeHeroImage, addFaq, updateFaq, removeFaq,
  };
}

type ContentHook = ReturnType<typeof useContentBlock>;

function HeroImageSection({ h }: { h: ContentHook }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <h4 style={{ margin: "0 0 14px" }}>Hero image</h4>
      <div className="bm-field">
        <label className="bm-label">Hero banner image</label>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, border: "1px dashed var(--bm-line)", borderRadius: 12, background: "#fff" }}>
          {h.block.heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={h.block.heroImage} alt="Current hero image" style={{ height: 48, width: "auto", borderRadius: 6, objectFit: "cover" }} />
          ) : (
            <span className="bm-brand-mark" style={{ fontSize: 28 }}>🖼️</span>
          )}
          <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>
            {h.block.heroImage ? "Current hero image — uploading a new image replaces it." : "No hero image uploaded."}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 10 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              h.setHeroFile(f);
              if (f) h.uploadHeroImage(f);
            }}
          />
          <button
            type="button"
            className="bm-btn bm-btn-outline bm-btn-sm"
            disabled={h.uploading}
            onClick={() => inputRef.current?.click()}
          >
            {h.uploading ? "Uploading…" : "⬆️ Upload hero image"}
          </button>
          {h.heroFile ? (
            <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>{h.heroFile.name}</span>
          ) : null}
          {h.block.heroImage ? (
            <button
              type="button"
              className="bm-btn bm-btn-ghost bm-btn-sm"
              disabled={h.uploading}
              onClick={h.removeHeroImage}
            >
              Remove hero image
            </button>
          ) : null}
        </div>
        <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>
          Click Upload hero image to pick a PNG, JPG, WebP or GIF (max 2MB) — it uploads automatically and shows as a banner above the hero.
        </span>
      </div>
    </>
  );
}

function HeroCopySection({ h }: { h: ContentHook }) {
  return (
    <>
      <h4 style={{ margin: "22px 0 14px" }}>Hero section</h4>
      <div className="bm-form-grid">
        <div className="bm-field"><label className="bm-label">Hero headline</label>
          <input className="bm-input" value={h.block.heroHeadline} onChange={(e) => h.setField("heroHeadline", e.target.value)} placeholder="e.g. Every drop counts." /></div>
        <div className="bm-field" style={{ gridColumn: "1 / -1" }}><label className="bm-label">Hero subcopy</label>
          <textarea className="bm-textarea" rows={3} value={h.block.heroSubcopy} onChange={(e) => h.setField("heroSubcopy", e.target.value)} placeholder="Short intro text that appears under the hero headline." /></div>
      </div>
    </>
  );
}

function CtaSection({ h }: { h: ContentHook }) {
  return (
    <>
      <h4 style={{ margin: "22px 0 14px" }}>Call to action</h4>
      <div className="bm-form-grid">
        <div className="bm-field"><label className="bm-label">CTA button label</label>
          <input className="bm-input" value={h.block.ctaLabel} onChange={(e) => h.setField("ctaLabel", e.target.value)} placeholder="e.g. 🩸 Find Blood" />
          <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>Leave empty to hide the CTA button.</span></div>
        <div className="bm-field"><label className="bm-label">CTA link</label>
          <input className="bm-input" value={h.block.ctaHref} onChange={(e) => h.setField("ctaHref", e.target.value)} placeholder="e.g. /find-donors" />
          <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>Site path (e.g. /become-donor) or an http(s) URL.</span></div>
      </div>
    </>
  );
}

function FaqSection({ h }: { h: ContentHook }) {
  return (
    <>
      <h4 style={{ margin: "22px 0 14px" }}>FAQ</h4>
      <div className="bm-form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="bm-field"><label className="bm-label">Question</label>
          <input className="bm-input" value={h.faqDraft.q} onChange={(e) => h.setFaqDraft((d) => ({ ...d, q: e.target.value }))} placeholder="e.g. Who can donate blood?" /></div>
        <div className="bm-field" style={{ gridColumn: "1 / -1" }}><label className="bm-label">Answer</label>
          <textarea className="bm-textarea" rows={2} value={h.faqDraft.a} onChange={(e) => h.setFaqDraft((d) => ({ ...d, a: e.target.value }))} placeholder="Short answer shown in the FAQ list." /></div>
      </div>
      <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
        <button type="button" className="bm-btn bm-btn-outline bm-btn-sm" disabled={!h.faqDraft.q.trim() || !h.faqDraft.a.trim()} onClick={h.addFaq}>
          + Add FAQ
        </button>
        <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>FAQ items are saved only when you click Save.</span>
      </div>

      {h.block.faqs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: "0 0 10px" }}>Saved FAQs ({h.block.faqs.length})</h4>
          {h.block.faqs.map((f, i) => (
            <div key={i} className="bm-card" style={{ padding: 14, marginBottom: 8 }}>
              <div className="flex justify-between items-start gap-2">
                <div style={{ flex: 1 }}>
                  <input
                    className="bm-input"
                    value={f.q}
                    onChange={(e) => h.updateFaq(i, "q", e.target.value)}
                    placeholder="Question"
                  />
                  <textarea
                    className="bm-textarea"
                    rows={2}
                    style={{ marginTop: 8 }}
                    value={f.a}
                    onChange={(e) => h.updateFaq(i, "a", e.target.value)}
                    placeholder="Answer"
                  />
                </div>
                <button type="button" className="bm-btn bm-btn-ghost bm-btn-sm" disabled={h.saving || h.uploading} onClick={() => h.removeFaq(i)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function HomeContentTab() {
  const h = useContentBlock("home");
  if (h.loading) return <div className="bm-card" style={{ padding: 24 }}><div className="bm-skeleton" style={{ height: 180 }} /></div>;
  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Page content · home</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Home page</h2>
          <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 6 }}>
            Editing content for <strong>/</strong> — changes go live immediately (hero banner, headline, subcopy, CTA button and FAQ).
          </p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="bm-btn bm-btn-outline bm-btn-sm">↗ View live page</a>
      </div>

      {h.error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{h.error}</div> : null}
      {h.saved ? <div className="bm-alert bm-alert-success" style={{ marginBottom: 12 }}>{h.saved}</div> : null}

      <form onSubmit={h.save} className="bm-card" style={{ padding: 24, maxWidth: 760 }}>
        <HeroImageSection h={h} />
        <HeroCopySection h={h} />
        <CtaSection h={h} />
        <FaqSection h={h} />
        <div style={{ marginTop: 22 }}>
          <button type="submit" className="bm-btn bm-btn-primary" disabled={h.saving}>
            {h.saving ? "Saving…" : "💾 Save home page"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AboutContentTab() {
  const h = useContentBlock("about");
  if (h.loading) return <div className="bm-card" style={{ padding: 24 }}><div className="bm-skeleton" style={{ height: 180 }} /></div>;
  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Page content · about</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>About page</h2>
          <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 6 }}>
            Editing content for <strong>/about</strong> — hero, mission cards, contact section, CTA and FAQ. Changes go live immediately.
          </p>
        </div>
        <a href="/about" target="_blank" rel="noreferrer" className="bm-btn bm-btn-outline bm-btn-sm">↗ View live page</a>
      </div>

      {h.error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{h.error}</div> : null}
      {h.saved ? <div className="bm-alert bm-alert-success" style={{ marginBottom: 12 }}>{h.saved}</div> : null}

      <form onSubmit={h.save} className="bm-card" style={{ padding: 24, maxWidth: 760 }}>
        <HeroImageSection h={h} />
        <HeroCopySection h={h} />

        <h4 style={{ margin: "22px 0 14px" }}>Mission cards</h4>
        <div className="bm-form-grid">
          <div className="bm-field"><label className="bm-label">Card 1 — title</label>
            <input className="bm-input" value={h.block.card1Title} onChange={(e) => h.setField("card1Title", e.target.value)} placeholder="e.g. Our mission" /></div>
          <div className="bm-field" style={{ gridColumn: "1 / -1" }}><label className="bm-label">Card 1 — text</label>
            <textarea className="bm-textarea" rows={2} value={h.block.card1Text} onChange={(e) => h.setField("card1Text", e.target.value)} /></div>
          <div className="bm-field"><label className="bm-label">Card 2 — title</label>
            <input className="bm-input" value={h.block.card2Title} onChange={(e) => h.setField("card2Title", e.target.value)} placeholder="e.g. How we help" /></div>
          <div className="bm-field" style={{ gridColumn: "1 / -1" }}><label className="bm-label">Card 2 — text</label>
            <textarea className="bm-textarea" rows={2} value={h.block.card2Text} onChange={(e) => h.setField("card2Text", e.target.value)} /></div>
          <div className="bm-field"><label className="bm-label">Card 3 — title</label>
            <input className="bm-input" value={h.block.card3Title} onChange={(e) => h.setField("card3Title", e.target.value)} placeholder="e.g. Who we serve" /></div>
          <div className="bm-field" style={{ gridColumn: "1 / -1" }}><label className="bm-label">Card 3 — text</label>
            <textarea className="bm-textarea" rows={2} value={h.block.card3Text} onChange={(e) => h.setField("card3Text", e.target.value)} /></div>
        </div>

        <h4 style={{ margin: "22px 0 14px" }}>Contact section</h4>
        <div className="bm-form-grid">
          <div className="bm-field"><label className="bm-label">Contact heading</label>
            <input className="bm-input" value={h.block.contactHeading} onChange={(e) => h.setField("contactHeading", e.target.value)} placeholder="e.g. Contact us" /></div>
          <div className="bm-field"><label className="bm-label">Partner email</label>
            <input className="bm-input" type="email" value={h.block.partnerEmail} onChange={(e) => h.setField("partnerEmail", e.target.value)} placeholder="partner@bloodmithra.org" /></div>
          <div className="bm-field" style={{ gridColumn: "1 / -1" }}><label className="bm-label">Office hours</label>
            <textarea className="bm-textarea" rows={3} value={h.block.officeHours} onChange={(e) => h.setField("officeHours", e.target.value)} placeholder={"Monday – Saturday: 9:00 AM – 6:00 PM IST"} />
            <span style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>Line breaks are shown as new lines on the About page.</span></div>
        </div>

        <CtaSection h={h} />
        <FaqSection h={h} />
        <div style={{ marginTop: 22 }}>
          <button type="submit" className="bm-btn bm-btn-primary" disabled={h.saving}>
            {h.saving ? "Saving…" : "💾 Save about page"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------- Reports ----------------------------------- */

function BloodCampsTab() {
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [orgOptions, setOrgOptions] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, o] = await Promise.all([
        apiFetch<{ data: any[]; total: number }>("/api/v1/camps"),
        apiFetch<{ data: any[]; total: number }>("/api/v1/organizations"),
      ]);
      const orgByName: Record<string, string> = {};
      o.data.forEach((org: any) => { if (org.name) orgByName[org.name] = String(org.id); });
      const merged = c.data.map((row: any) => ({
        ...row.camp,
        organizerName: row.organizerName ?? "",
        organizerId: row.camp.organizerId ?? null,
      }));
      setCamps(merged);
      setOrgOptions(o.data.filter((org: any) => org.status === "ACTIVE").map((org: any) => ({ id: org.id, name: org.name, type: org.type })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load blood camps");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCamp = () => {
    setIsEditing(true);
    setEditingCamp({
      id: null,
      name: "", organizerId: "", location: "", address: "", city: "", district: "",
      latitude: "", longitude: "", startDate: "", endDate: "",
      startTime: "", endTime: "", targetDonors: "", contact: "", status: "UPCOMING",
    });
    setFormError(null);
    setTimeout(() => document.getElementById("camp-name")?.focus(), 0);
  };

  const editCamp = (c: any) => {
    setIsEditing(true);
    setEditingCamp({
      id: c.id,
      name: c.name,
      organizerId: c.organizerId ? String(c.organizerId) : "",
      location: c.location ?? "", address: c.address ?? "", city: c.city ?? "", district: c.district ?? "",
      latitude: c.latitude ?? "", longitude: c.longitude ?? "", startDate: c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : "",
      endDate: c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : "",
      startTime: c.startTime ?? "", endTime: c.endTime ?? "", targetDonors: c.targetDonors ?? "", contact: c.contact ?? "", status: c.status,
    });
    setFormError(null);
    setTimeout(() => document.getElementById("camp-name")?.focus(), 0);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingCamp(null);
    setFormError(null);
  };

  const saveCamp = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/camps", {
        method: "POST",
        body: JSON.stringify({ camp: editingCamp }),
      });
      setIsEditing(false);
      setEditingCamp(null);
      setSaved("Blood camp added.");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add blood camp");
    } finally {
      setSaving(false);
    }
  };

  const updateCamp = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/camps", {
        method: "PATCH",
        body: JSON.stringify({ id: editingCamp?.id ?? null, ...editingCamp }),
      });
      setIsEditing(false);
      setEditingCamp(null);
      setSaved("Blood camp updated.");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update blood camp");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: number, status: string) => {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/camps", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      setSaved(`Blood camp marked ${status.toLowerCase()}.`);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to change status");
    } finally {
      setSaving(false);
    }
  };

  const removeCamp = async (id: number, name: string) => {
    if (!window.confirm(`Remove blood camp “${name}”? This cannot be undone.`)) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/api/v1/camps", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setSaved(`Blood camp removed.`);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to remove blood camp");
    } finally {
      setSaving(false);
    }
  };

  const [editingCamp, setEditingCamp] = useState<{
    id: number | null;
    name: string; organizerId: string; location: string; address: string; city: string; district: string;
    latitude: string; longitude: string; startDate: string; endDate: string;
    startTime: string; endTime: string; targetDonors: string; contact: string; status: string;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (error) return <div className="bm-alert bm-alert-error">{error}</div>;
  if (loading) return <div className="bm-card" style={{ padding: 24 }}><div className="bm-skeleton" style={{ height: 160 }} /></div>;

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Blood camp directory</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Blood camps</h2>
          <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 6 }}>
            Manage blood donation camps shown on the public Camps page — add, edit and remove camps, set dates, targets and status.
          </p>
        </div>
        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={addCamp}>+ Add blood camp</button>
      </div>

      <div className="bm-grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Total camps" value={camps.length} icon="⛺" />
        <StatCard label="Upcoming" value={camps.filter((c: any) => c.status === "UPCOMING" || c.status === "ONGOING").length} icon="🟢" accent="green" />
        <StatCard label="Target donors" value={camps.reduce((s: number, c: any) => s + (Number(c.targetDonors) || 0), 0)} icon="🩸" accent="blue" />
        <StatCard label="Registered" value={camps.reduce((s: number, c: any) => s + (Number(c.registeredDonors) || 0), 0)} icon="✅" accent="blue" />
      </div>

      {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {saved ? <div className="bm-alert bm-alert-success" style={{ marginBottom: 12 }}>{saved}</div> : null}
      {formError ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{formError}</div> : null}

      {isEditing && editingCamp && (
        <form onSubmit={(e) => { e.preventDefault(); editingCamp.id ? updateCamp() : saveCamp(); }} className="bm-card" style={{ padding: 20, marginBottom: 16, maxWidth: 760 }}>
          <h4 style={{ margin: "0 0 12px" }}>{editingCamp.id ? "Edit blood camp" : "Add blood camp"}</h4>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">Camp name *</label>
              <input id="camp-name" className="bm-input" value={editingCamp.name} onChange={(e) => setEditingCamp((c) => c ? { ...c, name: e.target.value } : c)} required /></div>
            <div className="bm-field"><label className="bm-label">Organizing organization</label>
              <select className="bm-select" value={editingCamp.organizerId} onChange={(e) => setEditingCamp((c) => c ? { ...c, organizerId: e.target.value } : c)}>
                <option value="">— None —</option>
                {orgOptions.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.type})</option>)}
              </select></div>
          </div>
          <div className="bm-field" style={{ marginTop: 12 }}><label className="bm-label">Location</label>
            <input className="bm-input" value={editingCamp.location} onChange={(e) => setEditingCamp((c) => c ? { ...c, location: e.target.value } : c)} placeholder="e.g. Main hall, St. Mary's College" /></div>
          <div className="bm-field" style={{ marginTop: 12 }}><label className="bm-label">Address</label>
            <textarea className="bm-textarea" rows={2} value={editingCamp.address} onChange={(e) => setEditingCamp((c) => c ? { ...c, address: e.target.value } : c)} /></div>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">City</label>
              <input className="bm-input" value={editingCamp.city} onChange={(e) => setEditingCamp((c) => c ? { ...c, city: e.target.value } : c)} /></div>
            <div className="bm-field"><label className="bm-label">District</label>
              <input className="bm-input" value={editingCamp.district} onChange={(e) => setEditingCamp((c) => c ? { ...c, district: e.target.value } : c)} /></div>
            <div className="bm-field"><label className="bm-label">Latitude (optional)</label>
              <input className="bm-input" value={editingCamp.latitude} onChange={(e) => setEditingCamp((c) => c ? { ...c, latitude: e.target.value } : c)} placeholder="12.9716" /></div>
            <div className="bm-field"><label className="bm-label">Longitude (optional)</label>
              <input className="bm-input" value={editingCamp.longitude} onChange={(e) => setEditingCamp((c) => c ? { ...c, longitude: e.target.value } : c)} placeholder="77.5946" /></div>
          </div>
          <h4 style={{ margin: "18px 0 10px" }}>Dates & times</h4>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">Start date *</label>
              <input type="date" className="bm-input" value={editingCamp.startDate} onChange={(e) => setEditingCamp((c) => c ? { ...c, startDate: e.target.value } : c)} required /></div>
            <div className="bm-field"><label className="bm-label">End date</label>
              <input type="date" className="bm-input" value={editingCamp.endDate} onChange={(e) => setEditingCamp((c) => c ? { ...c, endDate: e.target.value } : c)} /></div>
            <div className="bm-field"><label className="bm-label">Start time</label>
              <input type="time" className="bm-input" value={editingCamp.startTime} onChange={(e) => setEditingCamp((c) => c ? { ...c, startTime: e.target.value } : c)} /></div>
            <div className="bm-field"><label className="bm-label">End time</label>
              <input type="time" className="bm-input" value={editingCamp.endTime} onChange={(e) => setEditingCamp((c) => c ? { ...c, endTime: e.target.value } : c)} /></div>
          </div>
          <div className="bm-form-grid">
            <div className="bm-field"><label className="bm-label">Target donors</label>
              <input type="number" className="bm-input" min={0} value={editingCamp.targetDonors} onChange={(e) => setEditingCamp((c) => c ? { ...c, targetDonors: e.target.value } : c)} /></div>
            <div className="bm-field"><label className="bm-label">Status</label>
              <select className="bm-select" value={editingCamp.status} onChange={(e) => setEditingCamp((c) => c ? { ...c, status: e.target.value } : c)}>
                <option value="UPCOMING">Upcoming</option>
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select></div>
          </div>
          <div className="bm-field" style={{ marginTop: 12 }}><label className="bm-label">Contact (phone)</label>
            <input className="bm-input" value={editingCamp.contact} onChange={(e) => setEditingCamp((c) => c ? { ...c, contact: e.target.value } : c)} placeholder="e.g. 1800-000-0000" /></div>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
            <button type="submit" className="bm-btn bm-btn-primary bm-btn-sm" disabled={saving}>{saving ? "Saving…" : editingCamp.id ? "Update blood camp" : "Add blood camp"}</button>
            <button type="button" className="bm-btn bm-btn-ghost bm-btn-sm" disabled={saving} onClick={cancelEdit}>Cancel</button>
          </div>
        </form>
      )}

      <div className="bm-table-wrap">
        <table className="bm-table">
          <thead>
            <tr>
              <th>ID</th><th>Camp</th><th>Organizer</th><th>Location</th><th>City</th><th>District</th>
              <th>Start</th><th>End</th><th>Target</th><th>Registered</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {camps.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: "center", padding: 24 }}>No camps yet</td></tr>
            ) : camps.map((c: any) => (
              <tr key={c.id}>
                <td>#{c.id}</td>
                <td style={{ fontWeight: 650 }}>{c.name}</td>
                <td style={{ fontSize: 12.5 }}>{c.organizerName || (c.organizerId ? `ID #${c.organizerId}` : "—")}</td>
                <td style={{ whiteSpace: "normal" }}>{c.location ?? "—"}</td>
                <td>{c.city ?? "—"}</td>
                <td>{c.district ?? "—"}</td>
                <td>{c.startDate ? new Date(c.startDate).toLocaleDateString("en-IN") : "—"}</td>
                <td>{c.endDate ? new Date(c.endDate).toLocaleDateString("en-IN") : "—"}</td>
                <td>{Number(c.targetDonors) || 0}</td>
                <td>{Number(c.registeredDonors) || 0}</td>
                <td><Badge value={c.status} /></td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => editCamp(c)}>Edit</button>
                    {c.status === "UPCOMING" && <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => changeStatus(c.id, "ONGOING")}>Start</button>}
                    {c.status === "ONGOING" && <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => changeStatus(c.id, "COMPLETED")}>Complete</button>}
                    {(c.status !== "UPCOMING" && c.status !== "ONGOING" && c.status !== "COMPLETED") && <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => changeStatus(c.id, "UPCOMING")}>Reopen</button>}
                    <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => removeCamp(c.id, c.name)}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsTab() {
  const [growth, setGrowth] = useState<any>(null);
  const [bloodGroups, setBloodGroups] = useState<any>(null);
  const [districts, setDistricts] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [donations, setDonations] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [g, b, d, a, dn] = await Promise.all([
          apiFetch<any>("/api/v1/reports?type=growth"),
          apiFetch<any>("/api/v1/reports?type=bloodGroups"),
          apiFetch<any>("/api/v1/reports?type=districts"),
          apiFetch<any>("/api/v1/reports?type=activity"),
          apiFetch<any>("/api/v1/reports?type=donations"),
        ]);
        setGrowth(g); setBloodGroups(b); setDistricts(d); setActivity(a); setDonations(dn);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load reports");
      }
    };
    load();
  }, []);

  if (error) return <div className="bm-alert bm-alert-error">{error}</div>;
  if (!growth) return <div className="bm-card" style={{ padding: 24 }}><div className="bm-skeleton" style={{ height: 160 }} /></div>;

  const maxMonthly = Math.max(1, ...(growth.monthly ?? []).map((r: any) => r.count));
  const maxBg = Math.max(1, ...(bloodGroups?.data ?? []).map((r: any) => r.total));
  const maxDistrict = Math.max(1, ...(districts?.data ?? []).map((r: any) => r.donors));

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Project overview analytics</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Reports &amp; analytics</h2>
        </div>
      </div>

      <div className="bm-grid-2" style={{ marginBottom: 20 }}>
        <div className="bm-card" style={{ padding: 20 }}>
          <h4 style={{ margin: "0 0 14px" }}>Donor growth — monthly (last 12 months)</h4>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
            {(growth.monthly ?? []).map((r: any) => (
              <div key={r.bucket} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }} title={`${r.bucket}: ${r.count}`}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--bm-slate)" }}>{r.count}</span>
                <div style={{ width: "100%", height: `${Math.max(4, (r.count / maxMonthly) * 100)}%`, background: "linear-gradient(180deg, var(--bm-red), #e63950)", borderRadius: "6px 6px 0 0" }} />
              </div>
            ))}
          </div>
        </div>

        <div className="bm-card" style={{ padding: 20 }}>
          <h4 style={{ margin: "0 0 14px" }}>Blood group distribution</h4>
          {(bloodGroups?.data ?? []).map((r: any) => (
            <div key={r.bloodGroup} style={{ marginBottom: 9 }}>
              <div className="flex justify-between" style={{ fontSize: 13, fontWeight: 650, marginBottom: 4 }}>
                <span className="bm-blood-chip" style={{ minWidth: 36, padding: "2px 8px", fontSize: 12 }}>{r.bloodGroup}</span>
                <span>{r.total} total · {r.eligible} eligible</span>
              </div>
              <div className="bm-bar-track"><div className="bm-bar-fill" style={{ width: `${(r.total / maxBg) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="bm-grid-2">
        <div className="bm-card" style={{ padding: 20 }}>
          <h4 style={{ margin: "0 0 14px" }}>District coverage</h4>
          {(districts?.data ?? []).map((r: any) => (
            <div key={r.district} style={{ marginBottom: 9 }}>
              <div className="flex justify-between" style={{ fontSize: 13, fontWeight: 650, marginBottom: 4 }}>
                <span>{r.district}</span>
                <span>{r.donors} donors · {r.volunteers} volunteers</span>
              </div>
              <div className="bm-bar-track">
                <div className="bm-bar-fill" style={{ width: `${(r.donors / maxDistrict) * 100}%`, background: "linear-gradient(90deg, var(--bm-blue), #53b1fd)" }} />
              </div>
            </div>
          ))}
        </div>

        <div className="bm-card" style={{ padding: 20 }}>
          <h4 style={{ margin: "0 0 6px" }}>Donor activity</h4>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--bm-muted)" }}>
            {activity?.activePct ?? 0}% of donors are active
          </p>
          {(activity?.byStatus ?? []).map((r: any) => (
            <div key={r.status} style={{ marginBottom: 9 }}>
              <div className="flex justify-between" style={{ fontSize: 13, fontWeight: 650, marginBottom: 4 }}>
                <Badge value={r.status} /> <span>{r.count}</span>
              </div>
              <div className="bm-bar-track"><div className="bm-bar-fill" style={{ width: `${Math.max(3, (r.count / Math.max(1, activity?.total ?? 1)) * 100)}%`, background: "linear-gradient(90deg, var(--bm-green), #19b287)" }} /></div>
            </div>
          ))}
          <h4 style={{ margin: "16px 0 10px" }}>Donations by blood group</h4>
          <div className="flex flex-wrap gap-2">
            {(donations?.byBloodGroup ?? []).map((r: any) => (
              <span key={r.blood_group} className="bm-badge bm-badge-red">{r.blood_group}: {r.count}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
