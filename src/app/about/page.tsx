import Link from "next/link";

export const metadata = {
  title: "About & Contact",
  description: "Learn about Blood Mithra — a community-powered blood donor network — and get in touch with our team.",
};

export default function AboutPage() {
  return (
    <main className="bm-section">
      <div className="bm-container" style={{ maxWidth: 880 }}>
        <span className="bm-eyebrow">About us</span>
        <h1 className="bm-h2">About Blood Mithra</h1>
        <p className="bm-lead" style={{ marginTop: 16 }}>
          Blood Mithra — <em>friends of blood</em> — is a community-powered platform that connects
          voluntary blood donors with patients, hospitals and blood banks across India. Our mission is
          simple: <strong>no patient should wait for blood because donors couldn&apos;t be found.</strong>
        </p>

        <div className="bm-grid-3" style={{ margin: "36px 0" }}>
          <div className="bm-stat-card">
            <div className="bm-stat-label">Our mission</div>
            <p style={{ margin: "8px 0 0", color: "var(--bm-slate)", fontSize: 14.5, lineHeight: 1.65 }}>
              Build India&apos;s most responsive, transparent and privacy-first blood donor network.
            </p>
          </div>
          <div className="bm-stat-card">
            <div className="bm-stat-label">How we help</div>
            <p style={{ margin: "8px 0 0", color: "var(--bm-slate)", fontSize: 14.5, lineHeight: 1.65 }}>
              GPS-matched donor search, emergency notification waves, donation tracking and certificates.
            </p>
          </div>
          <div className="bm-stat-card">
            <div className="bm-stat-label">Who we serve</div>
            <p style={{ margin: "8px 0 0", color: "var(--bm-slate)", fontSize: 14.5, lineHeight: 1.65 }}>
              Patients, hospitals, blood banks, NGOs, corporates, volunteers and donors.
            </p>
          </div>
        </div>

        <div className="bm-card" style={{ padding: 32 }}>
          <h2 style={{ margin: "0 0 18px", fontSize: 22 }}>Contact us</h2>
          <div className="bm-grid-2" style={{ gap: 24 }}>
            <div style={{ color: "var(--bm-slate)", fontSize: 15, lineHeight: 2 }}>
              <div>📧 <strong>Email:</strong> help@bloodmithra.org</div>
              <div>📞 <strong>Helpline:</strong> 1800-000-0000 (toll-free, 8am–8pm IST)</div>
              <div>🚨 <strong>Emergency desk:</strong> Use the <Link href="/emergency" style={{ color: "var(--bm-red)", fontWeight: 700 }}>Emergency Request</Link> form</div>
              <div>📍 <strong>Address:</strong> Blood Mithra Foundation, Jayanagar 4th Block, Bengaluru, Karnataka 560041</div>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Office hours</h3>
              <p style={{ margin: 0, color: "var(--bm-slate)", fontSize: 14.5, lineHeight: 1.8 }}>
                Monday – Saturday: 9:00 AM – 6:00 PM IST<br />
                Sunday: Emergency support only<br />
                <br />
                For partnerships (hospitals, blood banks, NGOs, corporates), email
               {" "}<strong>partner@bloodmithra.org</strong>.
              </p>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 40 }}>
          <Link href="/become-donor" className="bm-btn bm-btn-primary">❤️ Join the mission — Become a Donor</Link>
        </div>
      </div>
    </main>
  );
}
