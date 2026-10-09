import Link from "next/link";
import { db } from "@/db";
import { donors, bloodRequests, donations, volunteers, bloodCamps, systemSettings } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import { parseJsonField } from "@/lib/api";
import { normalizeSiteSettings } from "@/lib/site";
import { PageHeroImage } from "@/components/PageContent";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Blood Mithra — India's Community Blood Donor Network",
  description:
    "Blood Mithra connects voluntary blood donors with patients, hospitals and blood banks. Find donors by blood group and location, register as a donor, and respond to emergency blood requests.",
};

type Stats = {
  donors: number;
  activeDonors: number;
  donations: number;
  requests: number;
  fulfilled: number;
  volunteers: number;
  camps: number;
  byBloodGroup: { bloodGroup: string; count: number }[];
};

export async function getSiteSettings() {
  try {
    const [appSetting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "app"))
      .limit(1);
    return normalizeSiteSettings(parseJsonField<unknown>(appSetting?.value, null));
  } catch {
    return normalizeSiteSettings(null);
  }
}

export async function getStats(): Promise<Stats> {
  try {
    const [donorTotal] = await db.select({ c: sql<number>`count(*)` }).from(donors);
    const [activeDonors] = await db.select({ c: sql<number>`count(*)` }).from(donors).where(sql`status IN ('ACTIVE','VERIFIED','REGULAR_DONOR')`);
    const [donationTotal] = await db.select({ c: sql<number>`count(*)` }).from(donations);
    const [requestTotal] = await db.select({ c: sql<number>`count(*)` }).from(bloodRequests);
    const [fulfilled] = await db.select({ c: sql<number>`count(*)` }).from(bloodRequests).where(eq(bloodRequests.status, "FULFILLED"));
    const [volunteerTotal] = await db.select({ c: sql<number>`count(*)` }).from(volunteers).where(eq(volunteers.status, "ACTIVE"));
    const [campTotal] = await db.select({ c: sql<number>`count(*)` }).from(bloodCamps);
    const byBloodGroup = await db.select({
      bloodGroup: donors.bloodGroup,
      count: sql<number>`count(*)`,
    }).from(donors).groupBy(donors.bloodGroup);
    return {
      donors: donorTotal.c,
      activeDonors: activeDonors.c,
      donations: donationTotal.c,
      requests: requestTotal.c,
      fulfilled: fulfilled.c,
      volunteers: volunteerTotal.c,
      camps: campTotal.c,
      byBloodGroup,
    };
  } catch {
    return {
      donors: 0, activeDonors: 0, donations: 0, requests: 0, fulfilled: 0,
      volunteers: 0, camps: 0, byBloodGroup: [],
    };
  }
}

const FAQS = [
  {
    q: "Who can donate blood?",
    a: "Most people aged 18–65, weighing at least 50 kg, and in good health can donate. You must wait 90 days (male) / 120 days (female) between whole blood donations. Our system calculates your personal next eligible date automatically.",
  },
  {
    q: "How does Blood Mithra match donors to requests?",
    a: "When a request is created, our backend filters donors by blood-group compatibility, eligibility, availability and location (using GPS distance), then notifies them in waves — nearest and most responsive donors first.",
  },
  {
    q: "Is my health information private?",
    a: "Yes. Health declarations are stored separately and are visible only to authorized roles (admins, hospital coordinators, blood bank operators). Your phone number is masked from the public.",
  },
  {
    q: "How do I get my donation certificate?",
    a: "After each verified donation, a certificate is generated with a unique certificate number. You can track its status — Pending → Generated → Issued → Received — from your donor dashboard.",
  },
  {
    q: "Can organizations host blood camps?",
    a: "Absolutely. NGOs, corporates, hospitals and community groups can organize blood camps through Blood Mithra. Volunteers help with registration, verification and follow-ups.",
  },
];

const STEPS = [
  { icon: "📝", title: "Register", text: "Create your donor profile in under 2 minutes with your blood group and location." },
  { icon: "✅", title: "Get Verified", text: "Verify your mobile via OTP and complete your health declaration to become eligible." },
  { icon: "🚨", title: "Respond", text: "Get notified about emergency requests near you and confirm your availability." },
  { icon: "🏅", title: "Donate & Earn", text: "Donate, save lives, and earn badges, milestones and digital certificates." },
];

const TRUST = [
  "🔒 Private health data — role-based access only",
  "📱 OTP-verified mobile numbers",
  "📍 GPS-based donor matching with masked public contacts",
  "📜 Audit-logged admin actions",
  "🏥 Hospital & blood bank verified partners",
  "🤝 NGO & volunteer network across districts",
];

export default async function HomePage() {
  const [site, stats] = await Promise.all([getSiteSettings(), getStats()]);
  const maxBg = Math.max(1, ...stats.byBloodGroup.map((b) => b.count));

  const homePage = site.pages.home;

  return (
    <main>
      {/* Hero */}
      <section className="bm-hero">
        <div className="bm-container">
          <PageHeroImage page={homePage} />
        </div>
        <div className="bm-container bm-hero-grid">
          <div>
            <span className="bm-eyebrow">🩸 India&apos;s community blood donor network</span>
            <h1 className="bm-h1">
              {homePage.heroHeadline || "Every drop counts."}<br />
              <span style={{ color: "var(--bm-red)" }}>Be someone&apos;s lifeline.</span>
            </h1>
            <p className="bm-lead" style={{ marginTop: 20 }}>
              {homePage.heroSubcopy ?? "Blood Mithra connects voluntary donors with patients, hospitals and blood banks — in minutes, not days."}
            </p>
            <div className="flex flex-wrap gap-3" style={{ marginTop: 28 }}>
              <Link href={homePage.ctaHref || "/find-donors"} className="bm-btn bm-btn-primary">
                {homePage.ctaLabel || "🩸 Find Blood"}
              </Link>
              <Link href="/become-donor" className="bm-btn bm-btn-outline">❤️ Become a Donor</Link>
              <Link href="/emergency" className="bm-btn bm-btn-outline" style={{ borderColor: "var(--bm-red)", color: "var(--bm-red)" }}>🚨 Emergency Request</Link>
            </div>
            <div className="bm-hero-stats">
              <div className="bm-stat-card">
                <div className="bm-stat-label">Registered Donors</div>
                <div className="bm-stat-value">{stats.donors.toLocaleString("en-IN")}</div>
              </div>
              <div className="bm-stat-card">
                <div className="bm-stat-label">Donations Made</div>
                <div className="bm-stat-value">{stats.donations.toLocaleString("en-IN")}</div>
              </div>
              <div className="bm-stat-card">
                <div className="bm-stat-label">Active Volunteers</div>
                <div className="bm-stat-value">{stats.volunteers.toLocaleString("en-IN")}</div>
              </div>
            </div>
          </div>

          <div className="bm-card" style={{ padding: 26 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 750 }}>Live Blood Group Availability</h2>
            <p style={{ margin: "0 0 18px", color: "var(--bm-slate)", fontSize: 14 }}>
              Registered donors by blood group
            </p>
            <div style={{ display: "grid", gap: 11 }}>
              {stats.byBloodGroup.length === 0 ? (
                <p style={{ color: "var(--bm-muted)", fontSize: 14 }}>No donors registered yet.</p>
              ) : (
                stats.byBloodGroup
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((b) => (
                    <div key={b.bloodGroup}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 5, fontSize: 13.5, fontWeight: 650 }}>
                        <span className="bm-blood-chip" style={{ minWidth: 38, padding: "3px 9px", fontSize: 13 }}>{b.bloodGroup}</span>
                        <span style={{ color: "var(--bm-slate)" }}>{b.count} donor{b.count === 1 ? "" : "s"}</span>
                      </div>
                      <div className="bm-bar-track">
                        <div className="bm-bar-fill" style={{ width: `${Math.round((b.count / maxBg) * 100)}%` }} />
                      </div>
                    </div>
                  ))
              )}
            </div>
            <div className="bm-grid-3" style={{ marginTop: 20, gap: 10 }}>
              <div className="bm-stat-card" style={{ padding: 14 }}>
                <div className="bm-stat-label">Blood Requests</div>
                <div className="bm-stat-value" style={{ fontSize: 22 }}>{stats.requests}</div>
              </div>
              <div className="bm-stat-card" style={{ padding: 14 }}>
                <div className="bm-stat-label">Fulfilled</div>
                <div className="bm-stat-value" style={{ fontSize: 22 }}>{stats.fulfilled}</div>
              </div>
              <div className="bm-stat-card" style={{ padding: 14 }}>
                <div className="bm-stat-label">Blood Camps</div>
                <div className="bm-stat-value" style={{ fontSize: 22 }}>{stats.camps}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bm-section">
        <div className="bm-container">
          <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 40px" }}>
            <span className="bm-eyebrow">How it works</span>
            <h2 className="bm-h2">Four steps between you and a saved life</h2>
          </div>
          <div className="bm-grid-4">
            {STEPS.map((s) => (
              <div key={s.title} className="bm-card" style={{ padding: 24 }}>
                <div style={{ fontSize: 30 }}>{s.icon}</div>
                <h3 style={{ margin: "12px 0 6px", fontSize: 17 }}>{s.title}</h3>
                <p style={{ margin: 0, color: "var(--bm-slate)", fontSize: 14, lineHeight: 1.6 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="bm-section" style={{ background: "#fff", borderTop: "1px solid var(--bm-line)", borderBottom: "1px solid var(--bm-line)" }}>
        <div className="bm-container">
          <div className="bm-grid-2" style={{ alignItems: "center", gap: 40 }}>
            <div>
              <span className="bm-eyebrow">Why trust Blood Mithra</span>
              <h2 className="bm-h2">Privacy-first. Safety-obsessed.</h2>
              <p className="bm-lead" style={{ marginTop: 14 }}>
                We built Blood Mithra the way a medical platform should be built: verified donors,
                masked contacts, encrypted credentials, and strict role-based access to health data.
              </p>
            </div>
            <div className="bm-grid-2" style={{ gap: 12 }}>
              {TRUST.map((t) => (
                <div key={t} className="bm-card" style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, color: "var(--bm-slate)" }}>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bm-section">
        <div className="bm-container" style={{ maxWidth: 820 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <span className="bm-eyebrow">FAQ</span>
            <h2 className="bm-h2">Questions, answered</h2>
          </div>
          {homePage.faqs && homePage.faqs.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {homePage.faqs.map((f) => (
                <div key={f.q} className="bm-faq-item">
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {FAQS.map((f) => (
                <div key={f.q} className="bm-faq-item">
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bm-section" style={{ paddingTop: 0 }}>
        <div className="bm-container">
          <div
            className="bm-card"
            style={{
              padding: "48px 32px",
              textAlign: "center",
              background: "linear-gradient(135deg, var(--bm-red), #e63950)",
              border: "none",
              color: "#fff",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
              One pint of your blood can save up to three lives.
            </h2>
            <p style={{ margin: "14px auto 26px", maxWidth: 560, opacity: 0.92, fontSize: 16 }}>
              Join {stats.donors.toLocaleString("en-IN")}+ registered donors on Blood Mithra today.
            </p>
            <div className="flex flex-wrap gap-3" style={{ justifyContent: "center" }}>
              <Link href="/become-donor" className="bm-btn" style={{ background: "#fff", color: "var(--bm-red)" }}>
                ❤️ Become a Donor
              </Link>
              <Link href="/find-donors" className="bm-btn" style={{ background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)" }}>
                🩸 Find Blood
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
