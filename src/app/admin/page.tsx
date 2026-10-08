"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getStoredUser } from "@/lib/client";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";
import { BLOOD_GROUPS } from "@/lib/client";

type Tab = "overview" | "donors" | "requests" | "certificates" | "volunteers" | "reports";

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

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Project Control", icon: "📊" },
    { id: "donors", label: "Donor Management", icon: "🩸" },
    { id: "requests", label: "Blood Requests", icon: "🚨" },
    { id: "certificates", label: "Certificates", icon: "📜" },
    { id: "volunteers", label: "Volunteers", icon: "🙋" },
    { id: "reports", label: "Reports & Analytics", icon: "📈" },
  ];

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
          {tabs.map((t) => (
            <a
              key={t.id}
              href="#"
              className={tab === t.id ? "active" : ""}
              onClick={(e) => { e.preventDefault(); setTab(t.id); }}
            >
              <span>{t.icon}</span> {t.label}
            </a>
          ))}
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
                  <div className="flex gap-1">
                    {!r.isProfileVerified ? (
                      <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => act(r.id, "verify")}>Verify</button>
                    ) : null}
                    <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => act(r.id, "status", { status: r.status === "INACTIVE" ? "ACTIVE" : "INACTIVE" })}>
                      {r.status === "INACTIVE" ? "Activate" : "Deactivate"}
                    </button>
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

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Request tracking</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Blood requests</h2>
        </div>
        <Link href="/emergency" className="bm-btn bm-btn-primary bm-btn-sm">🚨 New request</Link>
      </div>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
        {summary.map((s) => <span key={s.status} className="bm-badge bm-badge-gray">{s.status}: {s.count}</span>)}
      </div>
      {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
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
                    {r.currentWave < 3 && r.status !== "FULFILLED" && r.status !== "CANCELLED" ? (
                      <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => nextWave(r.id)}>Wave {r.currentWave + 1}</button>
                    ) : null}
                    {r.status !== "FULFILLED" && r.status !== "CANCELLED" ? (
                      <>
                        <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => advance(r.id, "CONFIRMED")}>Confirm</button>
                        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={() => advance(r.id, "FULFILLED")}>Fulfilled</button>
                      </>
                    ) : null}
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

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<any>("/api/v1/volunteers"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load volunteers");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <div className="bm-alert bm-alert-error">{error}</div>;
  if (!data) return <div className="bm-card" style={{ padding: 24 }}><div className="bm-skeleton" style={{ height: 120 }} /></div>;

  return (
    <div>
      <div className="bm-page-header">
        <div>
          <span className="bm-eyebrow">Volunteer control</span>
          <h2 className="bm-h2" style={{ fontSize: 24 }}>Volunteers</h2>
        </div>
      </div>
      <div className="bm-grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="Total volunteers" value={data.totals?.total ?? 0} icon="🙋" />
        <StatCard label="Active" value={data.totals?.active ?? 0} icon="🟢" accent="green" />
        {(data.assignments ?? []).map((a: any) => (
          <StatCard key={a.status} label={`Assignments: ${a.status}`} value={a.count} icon="📋" accent="blue" />
        ))}
      </div>
      <h4 style={{ margin: "0 0 10px" }}>District-wise distribution</h4>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
        {(data.byDistrict ?? []).map((d: any) => (
          <span key={d.district ?? "unknown"} className="bm-badge bm-badge-blue">
            {d.district ?? "Unknown"}: {d.active}/{d.total} active
          </span>
        ))}
      </div>
      <div className="bm-table-wrap">
        <table className="bm-table">
          <thead><tr><th>ID</th><th>Name</th><th>Mobile</th><th>District</th><th>Area</th><th>Status</th><th>Responsibility</th><th>Coordinator</th></tr></thead>
          <tbody>
            {(data.data ?? []).map((v: any) => (
              <tr key={v.id}>
                <td>#{v.id}</td>
                <td style={{ fontWeight: 650 }}>{v.name}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12.5 }}>{v.mobile}</td>
                <td>{v.district ?? "—"}</td>
                <td>{v.assignedArea ?? "—"}</td>
                <td><Badge value={v.status} /></td>
                <td style={{ whiteSpace: "normal", minWidth: 180 }}>{v.responsibility ?? "—"}</td>
                <td>{v.coordinator ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Reports ----------------------------------- */

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
