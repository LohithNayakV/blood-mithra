"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, saveSession } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStage, setOtpStage] = useState<{ identifier: string; demoOtp?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        token?: string;
        user?: Record<string, unknown>;
        needsVerification?: boolean;
        identifier?: string;
        demoOtp?: string;
        message?: string;
      }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });

      if (data.needsVerification) {
        setOtpStage({ identifier: data.identifier ?? identifier, demoOtp: data.demoOtp });
        return;
      }
      if (data.token && data.user) {
        saveSession(data.token, data.user);
        const role = String(data.user.role ?? "");
        router.push(role === "DONOR" ? "/dashboard" : "/admin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ token: string; user: Record<string, unknown> }>(
        "/api/v1/auth/verify-otp",
        { method: "POST", body: JSON.stringify({ identifier: otpStage?.identifier, otp }) },
      );
      saveSession(data.token, data.user);
      const role = String(data.user.role ?? "");
      router.push(role === "DONOR" ? "/dashboard" : "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bm-section">
      <div className="bm-container" style={{ maxWidth: 460 }}>
        <div className="bm-card" style={{ padding: 32 }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <span className="bm-brand-mark" style={{ width: 46, height: 46, fontSize: 22 }}>🩸</span>
            <h1 style={{ fontSize: 24, margin: "12px 0 4px" }}>
              {otpStage ? "Verify your mobile" : "Welcome back"}
            </h1>
            <p style={{ color: "var(--bm-slate)", margin: 0, fontSize: 14.5 }}>
              {otpStage
                ? `Enter the OTP sent to ${otpStage.identifier}`
                : "Login to manage donations, requests and certificates"}
            </p>
          </div>

          {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 16 }}>{error}</div> : null}

          {otpStage ? (
            <form onSubmit={verifyOtp} className="flex flex-col gap-4">
              {otpStage.demoOtp ? (
                <div className="bm-alert bm-alert-info">
                  Demo mode — your OTP is <strong style={{ fontFamily: "monospace", fontSize: 18 }}>{otpStage.demoOtp}</strong>
                </div>
              ) : null}
              <div className="bm-field">
                <label className="bm-label">6-digit OTP</label>
                <input
                  className="bm-input"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  style={{ textAlign: "center", fontSize: 22, letterSpacing: 8 }}
                />
              </div>
              <button className="bm-btn bm-btn-primary" disabled={loading}>
                {loading ? "Verifying…" : "Verify & continue"}
              </button>
              <button type="button" className="bm-btn bm-btn-ghost" onClick={() => setOtpStage(null)}>
                Back to login
              </button>
            </form>
          ) : (
            <form onSubmit={login} className="flex flex-col gap-4">
              <div className="bm-field">
                <label className="bm-label">Mobile or email</label>
                <input
                  className="bm-input"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="9XXXXXXXXX or you@example.com"
                />
              </div>
              <div className="bm-field">
                <label className="bm-label">Password</label>
                <input
                  className="bm-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button className="bm-btn bm-btn-primary" disabled={loading}>
                {loading ? "Logging in…" : "Login"}
              </button>
              <p style={{ textAlign: "center", margin: 0, fontSize: 14, color: "var(--bm-slate)" }}>
                New here?{" "}
                <Link href="/become-donor" style={{ color: "var(--bm-red)", fontWeight: 700 }}>
                  Become a donor
                </Link>
              </p>
              <div className="bm-alert bm-alert-info" style={{ fontSize: 13 }}>
                Demo accounts — Admin: <strong>admin@bloodmithra.org / admin123</strong> ·
                Donor: any seeded mobile (e.g. <strong>9811111111 / donor123</strong>)
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
