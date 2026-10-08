"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, saveSession, BLOOD_GROUPS } from "@/lib/client";

const EMPTY = {
  fullName: "",
  mobile: "",
  email: "",
  password: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  weight: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  preferredRadiusKm: "10",
  preferredContact: "PHONE",
  emergencyNotifications: true,
  consentGiven: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

export default function BecomeDonorPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<{ otp?: string } | null>(null);

  const set = (k: keyof typeof EMPTY, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Clear that field's error as soon as the user fixes it.
    setFieldErrors((prev) => (prev[k] ? { ...prev, [k]: "" } : prev));
  };

  /** Client-side validation mirroring the server rules, so mistakes are
   * shown inline instantly instead of only coming back from the API. */
  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim() || form.fullName.trim().length < 3) {
      errs.fullName = "Please enter your full name (min 3 characters).";
    }
    if (!MOBILE_RE.test(form.mobile.trim())) {
      errs.mobile = "Enter a valid 10-digit Indian mobile number starting with 6–9.";
    }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      errs.email = "That email address doesn't look valid.";
    }
    if (form.password.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }
    if (!form.bloodGroup) {
      errs.bloodGroup = "Please select your blood group.";
    }
    if (form.consentGiven !== true) {
      errs.consentGiven = "Consent is required to register as a donor.";
    }
    return errs;
  };

  const fieldError = (k: keyof typeof EMPTY) =>
    fieldErrors[k] ? <div className="bm-field-error" role="alert">{fieldErrors[k]}</div> : null;

  const invalidClass = (k: keyof typeof EMPTY) => (fieldErrors[k] ? " bm-input-invalid" : "");

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(() => undefined, () => undefined);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      setError("Please fix the highlighted fields below and try again.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...form,
        weight: form.weight ? Number(form.weight) : undefined,
        preferredRadiusKm: Number(form.preferredRadiusKm) || 10,
        consentGiven: form.consentGiven === true,
      };
      const data = await apiFetch<{
        token: string;
        user: Record<string, unknown>;
        donorId: number;
        demoOtp?: string;
        message: string;
      }>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(payload) });

      saveSession(data.token, { ...data.user, donorId: data.donorId });
      setSuccess({ otp: data.demoOtp });
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="bm-section">
        <div className="bm-container" style={{ maxWidth: 560 }}>
          <div className="bm-card" style={{ padding: 36, textAlign: "center" }}>
            <div style={{ fontSize: 44 }}>🎉</div>
            <h1 style={{ fontSize: 24, margin: "12px 0 8px" }}>You&apos;re registered!</h1>
            <p style={{ color: "var(--bm-slate)" }}>
              We&apos;ve sent a 6-digit OTP to your mobile. {success.otp ? <>For this demo, your OTP is <strong style={{ fontFamily: "monospace", fontSize: 18 }}>{success.otp}</strong>.</> : null}
            </p>
            <div className="bm-alert bm-alert-success" style={{ marginTop: 16 }}>
              Redirecting you to your donor dashboard…
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bm-section">
      <div className="bm-container" style={{ maxWidth: 820 }}>
        <div className="bm-page-header">
          <div>
            <span className="bm-eyebrow">Become a donor</span>
            <h1 className="bm-h2">Join the lifeline</h1>
            <p className="bm-lead" style={{ marginTop: 10 }}>
              Fill in your details below. It takes less than two minutes — and it could save a life.
            </p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="bm-card" style={{ padding: 28 }}>
          {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 16 }}>{error}</div> : null}

          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Personal details</h3>
          <div className="bm-form-grid">
            <div className="bm-field">
              <label className="bm-label">Full name *</label>
              <input className={`bm-input${invalidClass("fullName")}`} required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Rahul Verma" />
              {fieldError("fullName")}
            </div>
            <div className="bm-field">
              <label className="bm-label">Mobile number *</label>
              <input className={`bm-input${invalidClass("mobile")}`} required inputMode="numeric" value={form.mobile} onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" />
              {fieldError("mobile")}
            </div>
            <div className="bm-field">
              <label className="bm-label">Email</label>
              <input className={`bm-input${invalidClass("email")}`} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
              {fieldError("email")}
            </div>
            <div className="bm-field">
              <label className="bm-label">Password *</label>
              <input className={`bm-input${invalidClass("password")}`} type="password" required minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min 6 characters" />
              {fieldError("password")}
            </div>
            <div className="bm-field">
              <label className="bm-label">Date of birth</label>
              <input className="bm-input" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            </div>
            <div className="bm-field">
              <label className="bm-label">Gender</label>
              <select className="bm-select" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <h3 style={{ margin: "24px 0 14px", fontSize: 16 }}>Donation details</h3>
          <div className="bm-form-grid">
            <div className="bm-field">
              <label className="bm-label">Blood group *</label>
              <select className={`bm-select${invalidClass("bloodGroup")}`} required value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
                <option value="">Select blood group</option>
                {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {fieldError("bloodGroup")}
            </div>
            <div className="bm-field">
              <label className="bm-label">Weight (kg)</label>
              <input className="bm-input" type="number" min={30} max={200} value={form.weight} onChange={(e) => set("weight", e.target.value)} placeholder="e.g. 70" />
            </div>
            <div className="bm-field">
              <label className="bm-label">Preferred contact</label>
              <select className="bm-select" value={form.preferredContact} onChange={(e) => set("preferredContact", e.target.value)}>
                <option value="PHONE">Phone call</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <div className="bm-field">
              <label className="bm-label">Search radius (km)</label>
              <input className="bm-input" type="number" min={1} max={100} value={form.preferredRadiusKm} onChange={(e) => set("preferredRadiusKm", e.target.value)} />
            </div>
          </div>

          <h3 style={{ margin: "24px 0 14px", fontSize: 16 }}>Address</h3>
          <div className="bm-form-grid">
            <div className="bm-field">
              <label className="bm-label">City</label>
              <input className="bm-input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Bengaluru" />
            </div>
            <div className="bm-field">
              <label className="bm-label">District</label>
              <input className="bm-input" value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="e.g. Bengaluru Urban" />
            </div>
            <div className="bm-field">
              <label className="bm-label">State</label>
              <input className="bm-input" value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="e.g. Karnataka" />
            </div>
            <div className="bm-field">
              <label className="bm-label">Pincode</label>
              <input className="bm-input" inputMode="numeric" value={form.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="e.g. 560041" />
            </div>
          </div>

          <div className="bm-field bm-field-full" style={{ marginTop: 20 }}>
            <label className="flex items-start gap-3" style={{ fontSize: 14, color: "var(--bm-slate)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.consentGiven}
                onChange={(e) => set("consentGiven", e.target.checked)}
                required
                style={{ marginTop: 3 }}
              />
              <span>
                I consent to Blood Mithra storing my information and contacting me for blood donation
                requests. I confirm the information provided is accurate and I am eligible to donate as
                per medical guidelines.
              </span>
            </label>
            {fieldError("consentGiven")}
          </div>
          <div className="bm-field bm-field-full" style={{ marginTop: 8 }}>
            <label className="flex items-center gap-3" style={{ fontSize: 14, color: "var(--bm-slate)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.emergencyNotifications}
                onChange={(e) => set("emergencyNotifications", e.target.checked)}
              />
              <span>Notify me about emergency blood requests near me.</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3" style={{ marginTop: 24 }}>
            <button type="submit" className="bm-btn bm-btn-primary" disabled={loading}>
              {loading ? "Registering…" : "❤️ Register as a Donor"}
            </button>
            <button type="button" className="bm-btn bm-btn-outline" onClick={useMyLocation}>
              📍 Detect my location
            </button>
          </div>
          <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--bm-muted)" }}>
            * Required fields. Your health details stay private and are visible only to authorized staff.
          </p>
        </form>
      </div>
    </main>
  );
}
