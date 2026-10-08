import { NextRequest } from "next/server";
import { db } from "@/db";
import { donors } from "@/db/schema";
import { and, eq, like, desc, asc, or } from "drizzle-orm";
import { json, errorResponse, getAuthContext, maskPhone, canViewFullContact, ApiError } from "@/lib/api";
import { haversineKm } from "@/lib/geo";

export const dynamic = "force-dynamic";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const SORTABLE: Record<string, (t: typeof donors) => ReturnType<typeof asc>> = {
  name: (t) => asc(t.fullName),
  registration: (t) => desc(t.registrationDate),
  lastDonation: (t) => desc(t.lastDonationDate),
  nextEligible: (t) => asc(t.nextEligibleDate),
  city: (t) => asc(t.addressCity),
  donations: (t) => desc(t.totalDonations),
  activity: (t) => desc(t.activityScore),
};

// GET /api/v1/donors — donor search & listing.
// Filters: bloodGroup, city, district, pincode, lat, lng, radiusKm,
// availability, eligibility, status, search, sort, page, pageSize.
// Filter flow: Registered → Verified → Eligible → Active → Location match → Responsive.
// Contact details are masked for anonymous/public callers.
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  const sp = req.nextUrl.searchParams;

  const bloodGroup = sp.get("bloodGroup")?.toUpperCase() || null;
  const city = sp.get("city") || null;
  const district = sp.get("district") || null;
  const pincode = sp.get("pincode") || null;
  const availability = sp.get("availability") || null;
  const eligibility = sp.get("eligibility") || null;
  const status = sp.get("status") || null;
  const search = sp.get("search")?.trim() || null;
  const lat = sp.get("lat");
  const lng = sp.get("lng");
  const radiusKm = Number(sp.get("radiusKm") ?? 0);
  const sortKey = sp.get("sort") ?? "registration";
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 20)));

  if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup)) {
    throw new ApiError(400, "Invalid blood group");
  }

  const conditions = [];
  // Registered (always) → Verified → Eligible → Active stages of the funnel.
  if (sp.get("verified") === "true") conditions.push(eq(donors.isProfileVerified, true));
  if (bloodGroup) conditions.push(eq(donors.bloodGroup, bloodGroup));
  if (city) conditions.push(like(donors.addressCity, `%${city}%`));
  if (district) conditions.push(like(donors.addressDistrict, `%${district}%`));
  if (pincode) conditions.push(eq(donors.pincode, pincode));
  if (availability) conditions.push(eq(donors.availabilityStatus, availability.toUpperCase()));
  if (eligibility) conditions.push(eq(donors.eligibilityStatus, eligibility.toUpperCase()));
  if (status) conditions.push(eq(donors.status, status.toUpperCase()));
  if (search) {
    conditions.push(or(
      like(donors.fullName, `%${search}%`),
      like(donors.addressCity, `%${search}%`),
      eq(donors.mobile, search),
    )!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const sortFn = SORTABLE[sortKey] ?? SORTABLE.registration;

  const rows = await db.select().from(donors).where(where).orderBy(sortFn(donors));

  // Location match: compute haversine distance when coordinates are provided.
  const withDistance = rows.map((d) => ({
    ...d,
    distanceKm: lat && lng ? haversineKm(lat, lng, d.latitude, d.longitude) : null,
  }));

  const filtered = lat && lng && radiusKm > 0
    ? withDistance.filter((d) => d.distanceKm !== null && d.distanceKm <= radiusKm)
    : withDistance;

  // Responsive donor ranking: activity score desc as tiebreaker.
  filtered.sort((a, b) => (b.activityScore ?? 0) - (a.activityScore ?? 0));

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const showContact = canViewFullContact(auth);
  const data = pageRows.map((d) => ({
    id: d.id,
    fullName: d.fullName,
    bloodGroup: d.bloodGroup,
    age: d.dateOfBirth ? new Date().getFullYear() - new Date(d.dateOfBirth).getFullYear() : null,
    gender: d.gender,
    city: d.addressCity,
    district: d.addressDistrict,
    state: d.addressState,
    pincode: d.pincode,
    mobile: showContact ? d.mobile : maskPhone(d.mobile),
    email: showContact ? d.email : null,
    availabilityStatus: d.availabilityStatus,
    eligibilityStatus: d.eligibilityStatus,
    healthStatus: d.healthStatus,
    status: d.status,
    isProfileVerified: d.isProfileVerified,
    isMobileVerified: d.isMobileVerified,
    totalDonations: d.totalDonations,
    lastDonationDate: d.lastDonationDate,
    nextEligibleDate: d.nextEligibleDate,
    activityScore: d.activityScore,
    distanceKm: d.distanceKm !== null ? Number(d.distanceKm.toFixed(2)) : null,
    registrationDate: d.registrationDate,
  }));

  // Aggregate funnel counts for the current filter set (before pagination).
  const funnel = {
    registered: rows.length,
    verified: rows.filter((d) => d.isProfileVerified).length,
    eligible: rows.filter((d) => d.eligibilityStatus === "ELIGIBLE").length,
    active: rows.filter((d) => d.status === "ACTIVE" || d.status === "VERIFIED" || d.status === "REGULAR_DONOR").length,
    locationMatched: filtered.length,
  };

  return json({ data, total, page, pageSize, funnel });
}

// GET helper for counts only (used by dashboards): /api/v1/donors?summary=1
// (kept in the same handler via query flag)
export async function POST() {
  return errorResponse("Use /api/v1/auth/register to create a donor account", 405);
}
