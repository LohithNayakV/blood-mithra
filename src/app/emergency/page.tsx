"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, BLOOD_GROUPS } from "@/lib/client";
import { Badge } from "@/components/Badge";

const EMPTY = {
  requesterName: "",
  requesterPhone: "",
  bloodGroup: "",
  unitsRequired: "1",
  hospitalName: "",
  hospitalLocation: "",
  city: "",
  district: "",
  requiredAt: "",
  urgency: "HIGH",
  contactInfo: "",
  details: "",
};

interface CreateResponse {
  message: string;
  request: { id: number; status: string };
  wave1Count: number;
  wave2Staged: number;
  nextWave: number | null;
}

export default function EmergencyPage() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<CreateResponse>("/api/v1/blood-requests", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          unitsRequired: Number(form.unitsRequired) || 1,
        }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bm-section">
      <div className="bm-container" style={{ maxWidth: 860 }}>
        <div className="bm-page-header">
          <div>
            <span className="bm-eyebrow" style={{ color: "var(--bm-red)" }}>🚨 Emergency</span>
            <h1 className="bm-h2">Emergency blood request</h1>
            <p className="bm-lead" style={{ marginTop: 10 }}>
              Our backend instantly notifies nearby eligible donors in waves — nearest and most
              responsive first. No account needed for emergencies.
            </p>
          </div>
        </div>

        {result ? (
          <div className="bm-card" style={{ padding: 32 }}>
            <div style={{ fontSize: 40 }}>🚨</div>
            <h2 style={{ margin: "10px 0 6px", fontSize: 22 }}>Request #{result.request.id} created</h2>
            <p style={{ color: "var(--bm-slate)", marginTop: 0 }}>{result.message}</p>
            <div className="bm-grid-3" style={{ margin: "18px 0" }}>
              <div className="bm-stat-card" style={{ padding: 14 }}>
                <div className="bm-stat-label">Status</div>
                <div style={{ marginTop: 6 }}><Badge value={result.request.status} /></div>
              </div>
              <div className="bm-stat-card" style={{ padding: 14 }}>
                <div className="bm-stat-label">Wave 1 notified</div>
                <div className="bm-stat-value" style={{ fontSize: 22 }}>{result.wave1Count}</div>
              </div>
              <div className="bm-stat-card" style={{ padding: 14 }}>
                <div className="bm-stat-label">Wave 2 staged</div>
                <div className="bm-stat-value" style={{ fontSize: 22 }}>{result.wave2Staged}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="bm-btn bm-btn-outline" onClick={() => { setResult(null); setForm(EMPTY); }}>
                Create another request
              </button>
              <Link href="/find-donors" className="bm-btn bm-btn-primary">Find donors manually</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="bm-card" style={{ padding: 28 }}>
            {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 16 }}>{error}</div> : null}

            <div className="bm-form-grid">
              <div className="bm-field">
                <label className="bm-label">Blood group needed *</label>
                <select className="bm-select" required value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="bm-field">
                <label className="bm-label">Units required *</label>
                <input className="bm-input" type="number" min={1} max={20} required value={form.unitsRequired} onChange={(e) => set("unitsRequired", e.target.value)} />
              </div>
              <div className="bm-field">
                <label className="bm-label">Urgency *</label>
                <select className="bm-select" value={form.urgency} onChange={(e) => set("urgency", e.target.value)}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">🚨 Critical</option>
                </select>
              </div>
              <div className="bm-field">
                <label className="bm-label">Required by (date &amp; time)</label>
                <input className="bm-input" type="datetime-local" value={form.requiredAt} onChange={(e) => set("requiredAt", e.target.value)} />
              </div>
            </div>

            <h3 style={{ margin: "24px 0 14px", fontSize: 16 }}>Hospital / location</h3>
            <div className="bm-form-grid">
              <div className="bm-field">
                <label className="bm-label">Hospital name</label>
                <input className="bm-input" value={form.hospitalName} onChange={(e) => set("hospitalName", e.target.value)} placeholder="e.g. City Care Hospital" />
              </div>
              <div className="bm-field">
                <label className="bm-label">Hospital location</label>
                <input className="bm-input" value={form.hospitalLocation} onChange={(e) => set("hospitalLocation", e.target.value)} placeholder="Address / landmark" />
              </div>
              <div className="bm-field">
                <label className="bm-label">City</label>
                <input className="bm-input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Bengaluru" />
              </div>
              <div className="bm-field">
                <label className="bm-label">District</label>
                <input className="bm-input" value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="e.g. Bengaluru Urban" />
              </div>
            </div>

            <h3 style={{ margin: "24px 0 14px", fontSize: 16 }}>Contact</h3>
            <div className="bm-form-grid">
              <div className="bm-field">
                <label className="bm-label">Your name</label>
                <input className="bm-input" value={form.requesterName} onChange={(e) => set("requesterName", e.target.value)} placeholder="Requester / doctor on duty" />
              </div>
              <div className="bm-field">
                <label className="bm-label">Contact phone *</label>
                <input className="bm-input" required inputMode="numeric" value={form.requesterPhone} onChange={(e) => set("requesterPhone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" />
              </div>
              <div className="bm-field bm-field-full">
                <label className="bm-label">Case details</label>
                <textarea className="bm-textarea" rows={3} value={form.details} onChange={(e) => set("details", e.target.value)} placeholder="Patient condition, blood group confirmation, any special instructions…" />
              </div>
            </div>

            <div className="bm-alert bm-alert-info" style={{ marginTop: 20 }}>
              This request will be matched against eligible, available donors near the hospital and
              notification waves will be sent automatically.
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="submit" className="bm-btn bm-btn-primary" disabled={loading} style={{ width: "100%" }}>
                {loading ? "Sending alerts…" : "🚨 Send emergency request & alert donors"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
