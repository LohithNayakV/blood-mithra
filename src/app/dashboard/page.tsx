"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getStoredUser } from "@/lib/client";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";

interface DashboardData {
  donor: Record<string, any>;
  profile: Record<string, any> | null;
  health: Record<string, any> | null;
  stats: {
    profileCompletion: number;
    totalDonations: number;
    activityScore: number;
    badges: string[];
    unreadNotifications: number;
    pendingCertificates: number;
    receivedCertificates: number;
  };
  eligibility: Record<string, any>;
  availability: Record<string, any>;
  donationHistory: Record<string, any>[];
  certificates: Record<string, any>[];
  certificateSummary: Record<string, number>;
  emergencyRequests: { notification: Record<string, any>; request: Record<string, any> | null }[];
  notifications: Record<string, any>[];
  schedules: Record<string, any>[];
  scheduleSummary: Record<string, number>;
  responseStats: Record<string, any>[];
}

export default function DonorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const user = getStoredUser();

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<DashboardData>("/api/v1/dashboard"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (notificationId: number, response: string) => {
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/notifications/${notificationId}/respond`, {
        method: "POST",
        body: JSON.stringify({ response }),
      });
      setActionMsg(res.message);
      load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const confirmAvailability = async (available: boolean) => {
    if (!data) return;
    try {
      const res = await apiFetch<{ message: string }>("/api/v1/donors/availability", {
        method: "POST",
        body: JSON.stringify({ donorId: data.donor.id, available: available ? "YES" : "NO" }),
      });
      setActionMsg(res.message);
      load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) {
    return (
      <main className="bm-section"><div className="bm-container">
        <div className="bm-grid-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bm-card" style={{ padding: 20 }}>
              <div className="bm-skeleton" style={{ height: 16, width: "50%", marginBottom: 10 }} />
              <div className="bm-skeleton" style={{ height: 28, width: "40%" }} />
            </div>
          ))}
        </div>
      </div></main>
    );
  }

  if (error || !data) {
    return (
      <main className="bm-section"><div className="bm-container" style={{ maxWidth: 560 }}>
        <div className="bm-card" style={{ padding: 32, textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>Donor dashboard</h2>
          <p style={{ color: "var(--bm-slate)" }}>{error ?? "Please login as a donor to view this page."}</p>
          <Link href="/login" className="bm-btn bm-btn-primary">Login</Link>
        </div>
      </div></main>
    );
  }

  const d = data.donor;
  // Defensive: stats.badges must be an array (a malformed payload must not crash the page).
  const badges = Array.isArray(data.stats.badges) ? data.stats.badges : [];

  return (
    <main className="bm-section">
      <div className="bm-container">
        <div className="bm-page-header">
          <div>
            <span className="bm-eyebrow">Donor dashboard</span>
            <h1 className="bm-h2" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span className="bm-blood-chip" style={{ fontSize: 20, padding: "8px 16px" }}>{d.bloodGroup}</span>
              {d.fullName}
            </h1>
            <p style={{ color: "var(--bm-slate)", marginTop: 8 }}>
              {d.addressCity ?? "—"}{d.addressDistrict ? `, ${d.addressDistrict}` : ""}
              {user?.role ? ` · ${user.role}` : ""} · Member since {new Date(d.registrationDate).toLocaleDateString("en-IN")}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge value={d.status} />
            <Badge value={d.availabilityStatus} />
            <Badge value={d.eligibilityStatus} />
          </div>
        </div>

        {actionMsg ? (
          <div className="bm-alert bm-alert-info" style={{ marginBottom: 16 }}>{actionMsg}</div>
        ) : null}

        {/* Stat cards */}
        <div className="bm-grid-4" style={{ marginBottom: 24 }}>
          <StatCard label="Profile completion" value={`${data.stats.profileCompletion}%`} icon="📋" accent="blue" />
          <StatCard label="Total donations" value={data.stats.totalDonations} icon="💉" accent="red" />
          <StatCard label="Activity score" value={`${data.stats.activityScore}/100`} icon="⚡" accent="amber" />
          <StatCard label="Unread notifications" value={data.stats.unreadNotifications} icon="🔔" accent="green" />
        </div>

        <div className="bm-grid-2" style={{ marginBottom: 24 }}>
          {/* Eligibility & schedule */}
          <div className="bm-card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17 }}>Eligibility &amp; schedule</h3>
            <div className="bm-grid-2" style={{ gap: 12 }}>
              <div>
                <div className="bm-stat-label">Last donation</div>
                <div style={{ fontWeight: 700, marginTop: 3 }}>{d.lastDonationDate ?? "Never"}</div>
              </div>
              <div>
                <div className="bm-stat-label">Next eligible date</div>
                <div style={{ fontWeight: 700, marginTop: 3 }}>{d.nextEligibleDate ?? "Now — you're eligible!"}</div>
              </div>
              <div>
                <div className="bm-stat-label">Donation type</div>
                <div style={{ fontWeight: 700, marginTop: 3 }}>{String(d.donationType ?? "WHOLE_BLOOD").replace(/_/g, " ")}</div>
              </div>
              <div>
                <div className="bm-stat-label">Health status</div>
                <div style={{ marginTop: 3 }}><Badge value={d.healthStatus} /></div>
              </div>
            </div>
            <h4 style={{ margin: "18px 0 10px", fontSize: 14 }}>Schedule</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.scheduleSummary).map(([k, v]) => (
                <span key={k} className="bm-badge bm-badge-gray" style={{ textTransform: "capitalize" }}>
                  {k.replace(/([A-Z])/g, " $1")}: {v}
                </span>
              ))}
            </div>
            {data.schedules.length > 0 ? (
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                {data.schedules.slice(0, 6).map((s) => (
                  <div key={s.id} className="flex items-center justify-between" style={{ border: "1px solid var(--bm-line)", borderRadius: 10, padding: "9px 12px", fontSize: 13.5 }}>
                    <span>
                      <strong>{String(s.type).replace(/_/g, " ")}</strong> · {new Date(s.scheduledDate).toLocaleDateString("en-IN")}
                      {s.notes ? <span style={{ color: "var(--bm-muted)" }}> — {s.notes}</span> : null}
                    </span>
                    <Badge value={s.bucket} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Availability confirmation */}
          <div className="bm-card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 17 }}>Availability confirmation</h3>
            <p style={{ color: "var(--bm-slate)", fontSize: 14, marginTop: 0 }}>
              Are you currently available to help with a blood request?
            </p>
            <div style={{ fontSize: 14, margin: "10px 0 16px" }}>
              Current status: <Badge value={d.availabilityStatus} />
              {data.availability?.nextConfirmation ? (
                <span style={{ color: "var(--bm-muted)" }}> · next confirmation due {new Date(data.availability.nextConfirmation).toLocaleDateString("en-IN")}</span>
              ) : null}
            </div>
            <div className="flex gap-3">
              <button className="bm-btn bm-btn-primary" onClick={() => confirmAvailability(true)}>✅ Yes, I&apos;m available</button>
              <button className="bm-btn bm-btn-outline" onClick={() => confirmAvailability(false)}>❌ Not now</button>
            </div>

            <h4 style={{ margin: "22px 0 10px", fontSize: 14 }}>Badges &amp; recognition</h4>
            <div className="flex flex-wrap gap-2">
              {badges.length > 0 ? badges.map((b: string) => (
                <span key={b} className="bm-badge bm-badge-amber">🏅 {String(b).replace(/_/g, " ")}</span>
              )) : <span style={{ color: "var(--bm-muted)", fontSize: 13.5 }}>Donate to earn badges</span>}
            </div>

            <h4 style={{ margin: "22px 0 10px", fontSize: 14 }}>Health snapshot <span style={{ color: "var(--bm-muted)", fontWeight: 500 }}>(private)</span></h4>
            {data.health ? (
              <div style={{ fontSize: 13.5, color: "var(--bm-slate)", lineHeight: 1.8 }}>
                Status: <Badge value={data.health.healthStatus} /> · Screening: <Badge value={data.health.screeningStatus} />
                <br />Last confirmed: {data.health.lastHealthConfirmation ? new Date(data.health.lastHealthConfirmation).toLocaleDateString("en-IN") : "—"}
                {data.health.nextReviewDate ? <> · Next review: {data.health.nextReviewDate}</> : null}
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--bm-muted)" }}>No health declaration yet. Please complete your health profile.</p>
            )}
          </div>
        </div>

        {/* Emergency requests */}
        <div className="bm-card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 17 }}>🚨 Emergency requests sent to you</h3>
          {data.emergencyRequests.length === 0 ? (
            <p style={{ color: "var(--bm-muted)", margin: 0, fontSize: 14 }}>No emergency requests right now. Stay available!</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {data.emergencyRequests.map(({ notification, request }) => (
                <div key={notification.id} style={{ border: "1px solid var(--bm-line)", borderRadius: 12, padding: 14 }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="bm-blood-chip" style={{ marginRight: 8 }}>{request?.bloodGroup ?? "—"}</span>
                      <strong>{request?.hospitalName ?? "Hospital"}</strong>
                      <span style={{ color: "var(--bm-muted)", fontSize: 13 }}>
                        {" "}· {request?.unitsRequired} unit(s) · wave {notification.wave}
                        {notification.distanceKm ? ` · ~${Number(notification.distanceKm).toFixed(1)} km away` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {request ? <Badge value={request.urgency} /> : null}
                      <Badge value={notification.status} />
                    </div>
                  </div>
                  {request?.details ? <p style={{ margin: "8px 0", fontSize: 13.5, color: "var(--bm-slate)" }}>{request.details}</p> : null}
                  <div style={{ fontSize: 12.5, color: "var(--bm-muted)" }}>
                    {request?.city ?? ""}{request?.requiredAt ? ` · needed by ${new Date(request.requiredAt).toLocaleString("en-IN")}` : ""}
                  </div>
                  {notification.status === "SENT" || notification.status === "VIEWED" ? (
                    <div className="flex gap-2" style={{ marginTop: 10 }}>
                      <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={() => respond(notification.id, "ACCEPTED")}>✅ Accept — I can donate</button>
                      <button className="bm-btn bm-btn-outline bm-btn-sm" onClick={() => respond(notification.id, "REJECTED")}>Decline</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bm-grid-2">
          {/* Donation history */}
          <div className="bm-card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17 }}>Donation history</h3>
            {data.donationHistory.length === 0 ? (
              <p style={{ color: "var(--bm-muted)", fontSize: 14, margin: 0 }}>No donations recorded yet.</p>
            ) : (
              <div className="bm-table-wrap">
                <table className="bm-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Units</th><th>Verified</th></tr></thead>
                  <tbody>
                    {data.donationHistory.map((dn) => (
                      <tr key={dn.id}>
                        <td>{dn.donationDate}</td>
                        <td>{String(dn.donationType).replace(/_/g, " ")}</td>
                        <td>{dn.units}</td>
                        <td><Badge value={dn.verified ? "true" : "false"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Certificates */}
          <div className="bm-card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>Certificates</h3>
            <div className="flex flex-wrap gap-2" style={{ margin: "8px 0 14px" }}>
              <span className="bm-badge bm-badge-amber">Pending: {data.certificateSummary.pending}</span>
              <span className="bm-badge bm-badge-blue">Issued: {data.certificateSummary.issued}</span>
              <span className="bm-badge bm-badge-green">Received: {data.certificateSummary.received}</span>
              <span className="bm-badge bm-badge-green">Verified: {data.certificateSummary.verified}</span>
            </div>
            {data.certificates.length === 0 ? (
              <p style={{ color: "var(--bm-muted)", fontSize: 14, margin: 0 }}>No certificates yet.</p>
            ) : (
              <div className="bm-table-wrap">
                <table className="bm-table">
                  <thead><tr><th>Certificate #</th><th>Status</th><th>Issued</th><th>Received</th></tr></thead>
                  <tbody>
                    {data.certificates.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12.5 }}>{c.certificateNumber}</td>
                        <td><Badge value={c.status} /></td>
                        <td>{c.issuedDate ?? "—"}</td>
                        <td>{c.receivedDate ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="bm-card" style={{ padding: 24, marginTop: 24 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 17 }}>Notifications</h3>
          {data.notifications.length === 0 ? (
            <p style={{ color: "var(--bm-muted)", fontSize: 14, margin: 0 }}>You&apos;re all caught up.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {data.notifications.slice(0, 10).map((n) => (
                <div key={n.id} style={{ border: "1px solid var(--bm-line)", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, opacity: n.readAt ? 0.65 : 1 }}>
                  <strong>{n.title}</strong>
                  <div style={{ color: "var(--bm-slate)" }}>{n.message}</div>
                  <div style={{ fontSize: 11.5, color: "var(--bm-muted)", marginTop: 3 }}>
                    {new Date(n.sentAt).toLocaleString("en-IN")} · {n.type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
