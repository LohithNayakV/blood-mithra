import Link from "next/link";
import { ContactDetails } from "@/components/Site";
import { getSiteSettings } from "@/app/page";
import { PageHeroImage, PageFaqList } from "@/components/PageContent";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "About & Contact",
  description: "Learn about Blood Mithra — a community-powered blood donor network — and get in touch with our team.",
};

export default async function AboutPage() {
  const site = await getSiteSettings();
  const page = site.pages.about;

  const cards = [
    { title: page.card1Title || "Our mission", text: page.card1Text || "Build India's most responsive, transparent and privacy-first blood donor network." },
    { title: page.card2Title || "How we help", text: page.card2Text || "GPS-matched donor search, emergency notification waves, donation tracking and certificates." },
    { title: page.card3Title || "Who we serve", text: page.card3Text || "Patients, hospitals, blood banks, NGOs, corporates, volunteers and donors." },
  ];

  return (
    <main className="bm-section">
      <div className="bm-container" style={{ maxWidth: 880 }}>
        <PageHeroImage page={page} />
        <span className="bm-eyebrow">About us</span>
        <h1 className="bm-h2">
          {page.heroHeadline || "About Blood Mithra"}
        </h1>
        <p className="bm-lead" style={{ marginTop: 16 }}>
          {page.heroSubcopy || "Blood Mithra — friends of blood — is a community-powered platform that connects voluntary blood donors with patients, hospitals and blood banks across India."}
        </p>

        <div className="bm-grid-3" style={{ margin: "36px 0" }}>
          {cards.map((c) => (
            <div key={c.title} className="bm-stat-card">
              <div className="bm-stat-label">{c.title}</div>
              <p style={{ margin: "8px 0 0", color: "var(--bm-slate)", fontSize: 14.5, lineHeight: 1.65 }}>
                {c.text}
              </p>
            </div>
          ))}
        </div>

        <div className="bm-card" style={{ padding: 32 }}>
          <h2 style={{ margin: "0 0 18px", fontSize: 22 }}>{page.contactHeading || "Contact us"}</h2>
          <div className="bm-grid-2" style={{ gap: 24 }}>
            <div style={{ color: "var(--bm-slate)", fontSize: 15, lineHeight: 2 }}>
              <ContactDetails />
              <div>🚨 <strong>Emergency desk:</strong> Use the <Link href="/emergency" style={{ color: "var(--bm-red)", fontWeight: 700 }}>Emergency Request</Link> form</div>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Office hours</h3>
              <p style={{ margin: 0, color: "var(--bm-slate)", fontSize: 14.5, lineHeight: 1.8, whiteSpace: "pre-line" }}>
                {page.officeHours || "Monday – Saturday: 9:00 AM – 6:00 PM IST\nSunday: Emergency support only"}
                <br />
                <br />
                For partnerships (hospitals, blood banks, NGOs, corporates), email
                {" "}<strong>{page.partnerEmail || "partner@bloodmithra.org"}</strong>.
              </p>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 40 }}>
          <Link href={page.ctaHref || "/become-donor"} className="bm-btn bm-btn-primary">
            {page.ctaLabel || "❤️ Join the mission — Become a Donor"}
          </Link>
        </div>

        <PageFaqList page={page} />
      </div>
    </main>
  );
}
