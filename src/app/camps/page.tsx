import Link from "next/link";
import { db } from "@/db";
import { bloodCamps, organizations } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Blood Donation Camps",
  description: "Find upcoming blood donation camps near you. Register for camps organized by NGOs, hospitals, blood banks and corporates on Blood Mithra.",
};

export default async function CampsPage() {
  let camps: { camp: typeof bloodCamps.$inferSelect; organizerName: string | null }[] = [];
  try {
    camps = await db
      .select({ camp: bloodCamps, organizerName: organizations.name })
      .from(bloodCamps)
      .leftJoin(organizations, eq(bloodCamps.organizerId, organizations.id))
      .orderBy(asc(bloodCamps.startDate));
  } catch {
    camps = [];
  }

  const upcoming = camps.filter((c) => c.camp.status === "UPCOMING" || c.camp.status === "ONGOING");

  return (
    <main className="bm-section">
      <div className="bm-container">
        <div className="bm-page-header">
          <div>
            <span className="bm-eyebrow">Blood camps</span>
            <h1 className="bm-h2">Donation camps near you</h1>
            <p className="bm-lead" style={{ marginTop: 10 }}>
              Walk in, donate, save a life. Camps are organized by partner NGOs, hospitals, blood banks and corporates.
            </p>
          </div>
          <Link href="/become-donor" className="bm-btn bm-btn-primary">❤️ Become a Donor</Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="bm-card" style={{ padding: 40, textAlign: "center", color: "var(--bm-slate)" }}>
            No upcoming camps right now. Please check back soon — or{" "}
            <Link href="/organizations" style={{ color: "var(--bm-red)", fontWeight: 650 }}>partner with us</Link> to host one.
          </div>
        ) : (
          <div className="bm-grid-3">
            {upcoming.map(({ camp, organizerName }) => (
              <div key={camp.id} className="bm-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="flex items-start justify-between gap-2">
                  <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.3 }}>{camp.name}</h3>
                  <Badge value={camp.status} />
                </div>
                <div style={{ color: "var(--bm-slate)", fontSize: 14, lineHeight: 1.7 }}>
                  <div>📍 {camp.location ?? camp.address ?? "—"}{camp.city ? `, ${camp.city}` : ""}</div>
                  <div>📅 {camp.startDate ? new Date(camp.startDate).toLocaleDateString('en-IN') : '—'}{camp.endDate && camp.endDate !== camp.startDate ? ` → ${camp.endDate ? new Date(camp.endDate).toLocaleDateString('en-IN') : ''}` : ''}{camp.startTime ? ` · ${camp.startTime}${camp.endTime ? `–${camp.endTime}` : ''}` : ''}</div>
                  {organizerName ? <div>🤝 {organizerName}</div> : null}
                  {camp.contact ? <div>📞 {camp.contact}</div> : null}
                </div>
                <div className="bm-bar-track" title={`${camp.registeredDonors} registered`}>
                  <div
                    className="bm-bar-fill"
                    style={{
                      width: `${(camp.targetDonors ?? 0) > 0 ? Math.min(100, Math.round((camp.registeredDonors / (camp.targetDonors ?? 1)) * 100)) : 0}%`,
                      background: "linear-gradient(90deg, var(--bm-green), #19b287)",
                    }}
                  />
                </div>
                <div style={{ fontSize: 12.5, color: "var(--bm-muted)", fontWeight: 600 }}>
                  {camp.registeredDonors} registered{(camp.targetDonors ?? 0) > 0 ? ` · target ${camp.targetDonors}` : ""}
                </div>
                <Link href="/become-donor" className="bm-btn bm-btn-outline bm-btn-sm" style={{ marginTop: "auto" }}>
                  Register for this camp
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
