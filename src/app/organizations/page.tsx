import { db } from "@/db";
import { organizations, bloodCamps } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Partner Organizations",
  description: "Hospitals, blood banks, NGOs and corporates powering the Blood Mithra donor network across India.",
};

const TYPE_EMOJI: Record<string, string> = {
  NGO: "🤝",
  HOSPITAL: "🏥",
  BLOOD_BANK: "🩸",
  CORPORATE: "🏢",
  COMMUNITY: "🏘️",
};

export default async function OrganizationsPage() {
  let orgs: (typeof organizations.$inferSelect & { campCount: number })[] = [];
  try {
    const rows = await db
      .select({
        org: organizations,
        campCount: sql<number>`count(${bloodCamps.id})::int`,
      })
      .from(organizations)
      .leftJoin(bloodCamps, eq(bloodCamps.organizerId, organizations.id))
      .groupBy(organizations.id)
      .orderBy(desc(organizations.createdAt));
    orgs = rows.map((r) => ({ ...r.org, campCount: r.campCount }));
  } catch {
    orgs = [];
  }

  return (
    <main className="bm-section">
      <div className="bm-container">
        <div className="bm-page-header">
          <div>
            <span className="bm-eyebrow">Our network</span>
            <h1 className="bm-h2">Partner organizations</h1>
            <p className="bm-lead" style={{ marginTop: 10 }}>
              Blood Mithra is powered by hospitals, blood banks, NGOs and caring corporates.
            </p>
          </div>
        </div>

        {orgs.length === 0 ? (
          <div className="bm-card" style={{ padding: 40, textAlign: "center", color: "var(--bm-slate)" }}>
            No organizations registered yet.
          </div>
        ) : (
          <div className="bm-grid-3">
            {orgs.map((org) => (
              <div key={org.id} className="bm-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="flex items-start justify-between">
                  <div style={{ fontSize: 30 }}>{TYPE_EMOJI[org.type] ?? "🏛️"}</div>
                  <span className="bm-badge bm-badge-blue">{org.type}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: 17 }}>{org.name}</h3>
                <div style={{ color: "var(--bm-slate)", fontSize: 14, lineHeight: 1.7 }}>
                  {org.address ? <div>📍 {org.address}{org.city ? `, ${org.city}` : ""}</div> : null}
                  {org.contactPerson ? <div>👤 {org.contactPerson}</div> : null}
                  {org.phone ? <div>📞 {org.phone}</div> : null}
                  {org.email ? <div>📧 {org.email}</div> : null}
                </div>
                <div style={{ marginTop: "auto", fontSize: 12.5, fontWeight: 650, color: "var(--bm-muted)" }}>
                  {org.campCount} camp{org.campCount === 1 ? "" : "s"} organized
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
