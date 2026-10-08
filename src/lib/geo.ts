// ---------------------------------------------------------------------------
// Geographic helpers: haversine distance between two lat/lng points (km).
// ---------------------------------------------------------------------------

export function haversineKm(
  lat1: number | string | null | undefined,
  lng1: number | string | null | undefined,
  lat2: number | string | null | undefined,
  lng2: number | string | null | undefined,
): number | null {
  const toNum = (v: number | string | null | undefined): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : null;
  };
  const a = toNum(lat1);
  const b = toNum(lng1);
  const c = toNum(lat2);
  const d = toNum(lng2);
  if (a === null || b === null || c === null || d === null) return null;

  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(c - a);
  const dLng = toRad(d - b);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough pincode/city centroid fallback used when precise coords are missing. */
export function approxCityDistanceKm(cityA?: string | null, cityB?: string | null): number | null {
  if (!cityA || !cityB) return null;
  if (cityA.trim().toLowerCase() === cityB.trim().toLowerCase()) return 0;
  return null; // unknown — treat as "same metro unknown"; callers fall back to city match
}
