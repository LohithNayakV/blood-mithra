import { NextRequest } from "next/server";
import { db } from "@/db";
import { bloodRequests, requestNotifications, donors, notifications, hospitals } from "@/db/schema";
import { eq, desc, and, or, like, inArray, sql } from "drizzle-orm";
import { json, ApiError, parseBody, requireAuth, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";
import { haversineKm } from "@/lib/geo";

export const dynamic = "force-dynamic";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// Compatibility: exact group matches first, then compatible groups.
const COMPATIBLE: Record<string, string[]> = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"], // universal donor
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

// GET /api/v1/blood-requests — list/search requests with lifecycle status.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.toUpperCase() || null;
  const urgency = sp.get("urgency")?.toUpperCase() || null;
  const bloodGroup = sp.get("bloodGroup")?.toUpperCase() || null;
  const city = sp.get("city") || null;
  const district = sp.get("district") || null;
  const search = sp.get("search")?.trim() || null;

  const conditions = [];
  if (status) conditions.push(eq(bloodRequests.status, status));
  if (urgency) conditions.push(eq(bloodRequests.urgency, urgency));
  if (bloodGroup) conditions.push(eq(bloodRequests.bloodGroup, bloodGroup));
  if (city) conditions.push(like(bloodRequests.city, `%${city}%`));
  if (district) conditions.push(like(bloodRequests.district, `%${district}%`));
  if (search) {
    conditions.push(or(
      like(bloodRequests.hospitalName, `%${search}%`),
      like(bloodRequests.requesterName, `%${search}%`),
    )!);
  }

  const rows = await db.select().from(bloodRequests)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bloodRequests.createdAt))
    .limit(100);

  const summary = await db.select({
    status: bloodRequests.status,
    count: sql<number>`count(*)`,
  }).from(bloodRequests).groupBy(bloodRequests.status);

  return json({ data: rows, total: rows.length, summary });
}

// POST /api/v1/blood-requests — create a request (emergency supported) and
// initiate notification waves to suitable eligible donors.
// Wave 1: nearby eligible active donors · Wave 2: additional eligible donors ·
// Wave 3: larger donor pool (verified donors in the same district).
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req); // public allowed for emergency use, auth enriches the record
  const body = await parseBody(req);

  const bloodGroup = String(body.bloodGroup ?? "").trim().toUpperCase();
  if (!BLOOD_GROUPS.includes(bloodGroup)) throw new ApiError(400, "Invalid blood group");

  const unitsRequired = Number(body.unitsRequired ?? 1);
  if (!Number.isInteger(unitsRequired) || unitsRequired < 1 || unitsRequired > 20) {
    throw new ApiError(400, "unitsRequired must be between 1 and 20");
  }

  const urgency = String(body.urgency ?? "MEDIUM").toUpperCase();
  if (!URGENCIES.includes(urgency)) throw new ApiError(400, "Invalid urgency level");

  const requesterPhone = String(body.requesterPhone ?? body.contactInfo ?? "").trim();
  if (!requesterPhone) throw new ApiError(400, "A contact phone number is required");

  await db.insert(bloodRequests).values({
    requesterId: auth?.userId ?? null,
    requesterName: body.requesterName ? String(body.requesterName) : null,
    requesterPhone,
    bloodGroup,
    unitsRequired,
    hospitalId: body.hospitalId ? Number(body.hospitalId) : null,
    hospitalName: body.hospitalName ? String(body.hospitalName) : null,
    hospitalLocation: body.hospitalLocation ? String(body.hospitalLocation) : null,
    city: body.city ? String(body.city) : null,
    district: body.district ? String(body.district) : null,
    latitude: body.latitude ? String(body.latitude) : null,
    longitude: body.longitude ? String(body.longitude) : null,
    requiredAt: body.requiredAt ? new Date(String(body.requiredAt)) : null,
    urgency,
    contactInfo: body.contactInfo ? String(body.contactInfo) : requesterPhone,
    details: body.details ? String(body.details) : null,
    status: "CREATED",
  });
  // MySQL doesn't support returning(), fetch the inserted request
  const [request] = await db.select().from(bloodRequests).orderBy(desc(bloodRequests.id)).limit(1);

  // ---- Donor matching: eligible + available + compatible group + location ----
  const compatible = COMPATIBLE[bloodGroup] ?? [bloodGroup];
  const candidates = await db.select().from(donors).where(
    and(
      inArray(donors.bloodGroup, compatible),
      eq(donors.availabilityStatus, "AVAILABLE"),
      eq(donors.eligibilityStatus, "ELIGIBLE"),
      eq(donors.emergencyNotifications, true),
      or(eq(donors.status, "ACTIVE"), eq(donors.status, "VERIFIED"), eq(donors.status, "REGULAR_DONOR")),
    ),
  );

  const reqLat = body.latitude ? Number(body.latitude) : null;
  const reqLng = body.longitude ? Number(body.longitude) : null;
  const reqCity = body.city ? String(body.city).toLowerCase() : null;
  const reqDistrict = body.district ? String(body.district).toLowerCase() : null;

  const withDistance = candidates
    .map((d) => ({
      ...d,
      distanceKm: haversineKm(reqLat, reqLng, d.latitude, d.longitude),
    }))
    .filter((d) => d.distanceKm !== null || (reqLat === null && reqLng === null));

  // Wave 1: nearby (within donor's preferred radius or 25km) & responsive (activity score).
  const wave1 = withDistance
    .filter((d) => d.distanceKm === null || d.distanceKm <= Math.max(Number(d.preferredRadiusKm ?? 10), 25))
    .sort((a, b) => (b.activityScore ?? 0) - (a.activityScore ?? 0))
    .slice(0, 25);
  // Wave 2: next ring — same city/district.
  const wave1Ids = new Set(wave1.map((d) => d.id));
  const wave2 = withDistance
    .filter((d) => !wave1Ids.has(d.id) && (
      (reqCity && d.addressCity?.toLowerCase() === reqCity) ||
      (reqDistrict && d.addressDistrict?.toLowerCase() === reqDistrict)
    ))
    .slice(0, 50);

  const notified: typeof wave1 = [];
  const notifyWave = async (wave: typeof wave1, waveNumber: number) => {
    for (const d of wave) {
      await db.insert(requestNotifications).values({
        requestId: request.id,
        donorId: d.id,
        wave: waveNumber,
        status: "SENT",
        distanceKm: d.distanceKm !== null ? String(d.distanceKm.toFixed(2)) : null,
      });
      await db.insert(notifications).values({
        donorId: d.id,
        type: "EMERGENCY_REQUEST",
        title: `🩸 ${urgency} request: ${bloodGroup} blood needed${body.city ? ` in ${body.city}` : ""}`,
        message: `${unitsRequired} unit(s) of ${bloodGroup} needed at ${body.hospitalName ?? "a nearby hospital"}${body.requiredAt ? ` by ${new Date(String(body.requiredAt)).toLocaleString("en-IN")}` : ""}. ${body.details ?? ""}`,
      });
      notified.push(d);
    }
  };

  await notifyWave(wave1, 1);
  // Waves 2 and 3 are staged: they are triggered as the request escalates
  // (see PATCH /api/v1/blood-requests/:id?action=next-wave).
  const staged = wave2;

  await db.update(bloodRequests).set({
    status: notified.length > 0 ? "DONORS_NOTIFIED" : "VERIFICATION",
    currentWave: notified.length > 0 ? 1 : 0,
    donorsNotified: notified.length,
    updatedAt: new Date(),
  }).where(eq(bloodRequests.id, request.id));

  if (auth) {
    await writeAuditLog({
      userId: auth.userId, action: "BLOOD_REQUEST_CREATED", entityType: "blood_requests",
      entityId: request.id, details: { bloodGroup, urgency, unitsRequired, donorsNotified: notified.length },
      ipAddress: getClientIp(req),
    });
  }

  return json({
    message: notified.length > 0
      ? `Request created. Notification wave 1 sent to ${notified.length} eligible donor(s).`
      : "Request created. No immediately eligible donors found — staff verification started.",
    request,
    wave1Count: notified.length,
    wave2Staged: staged.length,
    nextWave: staged.length > 0 ? 2 : null,
  }, 201);
}

// Convenience: look up hospitals for the request form.
export async function PUT() {
  return json({ hospitals: await db.select().from(hospitals).orderBy(hospitals.name) });
}
