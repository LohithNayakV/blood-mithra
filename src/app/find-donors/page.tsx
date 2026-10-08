"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, BLOOD_GROUPS } from "@/lib/client";
import { Badge } from "@/components/Badge";

interface DonorRow {
  id: number;
  fullName: string;
  bloodGroup: string;
  age: number | null;
  gender: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  mobile: string | null;
  availabilityStatus: string;
  eligibilityStatus: string;
  status: string;
  isProfileVerified: boolean;
  totalDonations: number;
  nextEligibleDate: string | null;
  activityScore: number;
  distanceKm: number | null;
}

interface SearchResponse {
  data: DonorRow[];
  total: number;
  page: number;
  pageSize: number;
  funnel: Record<string, number>;
}

export default function FindDonorsPage() {
  const [filters, setFilters] = useState({
    bloodGroup: "",
    city: "",
    district: "",
    pincode: "",
    availability: "",
    eligibility: "",
    lat: "",
    lng: "",
    radiusKm: "25",
    search: "",
  });
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [located, setLocated] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      params.set("pageSize", "24");
      const data = await apiFetch<SearchResponse>(`/api/v1/donors?${params.toString()}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFilters((f) => ({
          ...f,
          lat: String(pos.coords.latitude.toFixed(6)),
          lng: String(pos.coords.longitude.toFixed(6)),
        }));
        setLocated(true);
      },
      () => setError("Location access denied. You can still search by city or pincode."),
    );
  };

  return (
    <main className="bm-section">
      <div className="bm-container">
        <div className="bm-page-header">
          <div>
            <span className="bm-eyebrow">Find donors</span>
            <h1 className="bm-h2">Search our donor network</h1>
            <p className="bm-lead" style={{ marginTop: 10 }}>
              Filter by blood group, location, availability and eligibility. Contact details are shared
              only with verified staff — public results show masked numbers.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bm-card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="bm-form-grid">
            <div className="bm-field">
              <label className="bm-label">Blood group</label>
              <select
                className="bm-select"
                value={filters.bloodGroup}
                onChange={(e) => setFilters({ ...filters, bloodGroup: e.target.value })}
              >
                <option value="">Any blood group</option>
                {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="bm-field">
              <label className="bm-label">City</label>
              <input className="bm-input" placeholder="e.g. Bengaluru" value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
            </div>
            <div className="bm-field">
              <label className="bm-label">District</label>
              <input className="bm-input" placeholder="e.g. Mysuru" value={filters.district}
                onChange={(e) => setFilters({ ...filters, district: e.target.value })} />
            </div>
            <div className="bm-field">
              <label className="bm-label">Pincode</label>
              <input className="bm-input" placeholder="e.g. 560001" value={filters.pincode}
                onChange={(e) => setFilters({ ...filters, pincode: e.target.value })} />
            </div>
            <div className="bm-field">
              <label className="bm-label">Availability</label>
              <select className="bm-select" value={filters.availability}
                onChange={(e) => setFilters({ ...filters, availability: e.target.value })}>
                <option value="">Any</option>
                <option value="AVAILABLE">Available now</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </div>
            <div className="bm-field">
              <label className="bm-label">Eligibility</label>
              <select className="bm-select" value={filters.eligibility}
                onChange={(e) => setFilters({ ...filters, eligibility: e.target.value })}>
                <option value="">Any</option>
                <option value="ELIGIBLE">Eligible to donate</option>
                <option value="TEMPORARILY_DEFERRED">Temporarily deferred</option>
              </select>
            </div>
            <div className="bm-field">
              <label className="bm-label">Latitude (optional)</label>
              <input className="bm-input" placeholder="12.9716" value={filters.lat}
                onChange={(e) => setFilters({ ...filters, lat: e.target.value })} />
            </div>
            <div className="bm-field">
              <label className="bm-label">Longitude (optional)</label>
              <input className="bm-input" placeholder="77.5946" value={filters.lng}
                onChange={(e) => setFilters({ ...filters, lng: e.target.value })} />
            </div>
            <div className="bm-field">
              <label className="bm-label">Radius (km)</label>
              <input className="bm-input" type="number" min={1} max={200} value={filters.radiusKm}
                onChange={(e) => setFilters({ ...filters, radiusKm: e.target.value })} />
            </div>
            <div className="bm-field">
              <label className="bm-label">Search name / city</label>
              <input className="bm-input" placeholder="Name or city" value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3" style={{ marginTop: 16 }}>
            <button className="bm-btn bm-btn-primary" onClick={search} disabled={loading}>
              {loading ? "Searching…" : "🔍 Search donors"}
            </button>
            <button className="bm-btn bm-btn-outline" onClick={useMyLocation}>
              📍 Use my location
            </button>
            {located ? <span className="bm-alert bm-alert-info" style={{ padding: "8px 14px" }}>Location set — radius filter applies.</span> : null}
          </div>
        </div>

        {error ? <div className="bm-alert bm-alert-error" style={{ marginBottom: 16 }}>{error}</div> : null}

        {/* Funnel */}
        {result ? (
          <div className="bm-grid-4" style={{ marginBottom: 20, gridTemplateColumns: "repeat(5, 1fr)" }}>
            {Object.entries(result.funnel).map(([k, v]) => (
              <div key={k} className="bm-stat-card" style={{ padding: 14 }}>
                <div className="bm-stat-label" style={{ textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</div>
                <div className="bm-stat-value" style={{ fontSize: 22 }}>{v}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Results */}
        {loading && !result ? (
          <div className="bm-grid-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bm-card" style={{ padding: 20 }}>
                <div className="bm-skeleton" style={{ height: 20, width: "60%", marginBottom: 10 }} />
                <div className="bm-skeleton" style={{ height: 14, width: "80%" }} />
              </div>
            ))}
          </div>
        ) : null}

        {result && result.data.length === 0 ? (
          <div className="bm-card" style={{ padding: 40, textAlign: "center", color: "var(--bm-slate)" }}>
            No donors matched these filters. Try widening the radius or clearing the blood group filter.
          </div>
        ) : null}

        {result && result.data.length > 0 ? (
          <div className="bm-table-wrap">
            <table className="bm-table">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th>Blood</th>
                  <th>Age</th>
                  <th>Location</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Eligibility</th>
                  <th>Donations</th>
                  <th>Distance</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{d.fullName}</div>
                      <div style={{ fontSize: 12, color: "var(--bm-muted)" }}>
                        {d.isProfileVerified ? "✔ Verified donor" : "Verification pending"}
                      </div>
                    </td>
                    <td><span className="bm-blood-chip">{d.bloodGroup}</span></td>
                    <td>{d.age ?? "—"}</td>
                    <td>
                      <div>{d.city ?? "—"}{d.district ? `, ${d.district}` : ""}</div>
                      <div style={{ fontSize: 12, color: "var(--bm-muted)" }}>{d.pincode ?? ""}</div>
                    </td>
                    <td style={{ fontFamily: "monospace" }}>{d.mobile ?? "—"}</td>
                    <td><Badge value={d.availabilityStatus} /></td>
                    <td><Badge value={d.eligibilityStatus} /></td>
                    <td>{d.totalDonations}</td>
                    <td>{d.distanceKm !== null ? `${d.distanceKm} km` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {result ? (
          <p style={{ marginTop: 14, color: "var(--bm-muted)", fontSize: 13 }}>
            Showing {result.data.length} of {result.total} donor{result.total === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </main>
  );
}
