import { NextRequest } from "next/server";
import { db } from "@/db";
import { bloodCamps, campRegistrations, organizations, donors } from "@/db/schema";
import { like, or, and, eq, desc, asc, sql, gte } from "drizzle-orm";
import { json, ApiError, parseBody, requireAuth, requireStaff, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/v1/camps — blood camp directory (public), supports ?upcoming=1.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const city = sp.get("city") || null;
  const district = sp.get("district") || null;
  const search = sp.get("search")?.trim() || null;
  const upcomingOnly = sp.get("upcoming") === "1";
  const status = sp.get("status")?.toUpperCase() || null;

  const conditions = [];
  if (city) conditions.push(like(bloodCamps.city, `%${city}%`));
  if (district) conditions.push(like(bloodCamps.district, `%${district}%`));
  if (status) conditions.push(eq(bloodCamps.status, status));
  if (upcomingOnly) conditions.push(gte(bloodCamps.startDate, new Date()));
  if (search) conditions.push(or(like(bloodCamps.name, `%${search}%`), like(bloodCamps.location, `%${search}%`))!);

  const rows = await db.select({
    camp: bloodCamps,
    organizerName: organizations.name,
  })
    .from(bloodCamps)
    .leftJoin(organizations, eq(bloodCamps.organizerId, organizations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(bloodCamps.startDate))
    .limit(200);

  return json({ data: rows, total: rows.length });
}

// POST /api/v1/camps — create a blood camp (staff) or register a donor (donor).
// Body: { camp: {...} } to create, or { register: { campId, donorId } } to register.
export async function POST(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const body = await parseBody(req);

  // Donor self-registration for a camp.
  if (body.register) {
    const campId = Number((body.register as Record<string, unknown>).campId);
    const donorId = auth.donorId ?? Number((body.register as Record<string, unknown>).donorId);
    if (!Number.isInteger(campId) || !Number.isInteger(donorId)) throw new ApiError(400, "campId and donorId are required");
    await db.insert(campRegistrations).ignore().values({ campId, donorId, status: "REGISTERED" });
    const [reg] = await db.select().from(campRegistrations).where(and(eq(campRegistrations.campId, campId), eq(campRegistrations.donorId, donorId))).limit(1);
    await db.update(bloodCamps).set({ registeredDonors: sql`${bloodCamps.registeredDonors} + 1` }).where(eq(bloodCamps.id, campId));
    return json({ message: "Registered for the blood camp", registration: reg ?? null }, 201);
  }

  // Staff: create a camp.
  requireStaff(auth);
  const camp = body.camp as Record<string, unknown> | undefined;
  if (!camp || !camp.name || !camp.startDate) throw new ApiError(400, "camp.name and camp.startDate are required");
  await db.insert(bloodCamps).values({
    name: String(camp.name),
    organizerId: camp.organizerId ? Number(camp.organizerId) : null,
    location: camp.location ? String(camp.location) : null,
    address: camp.address ? String(camp.address) : null,
    city: camp.city ? String(camp.city) : null,
    district: camp.district ? String(camp.district) : null,
    latitude: camp.latitude ? String(camp.latitude) : null,
    longitude: camp.longitude ? String(camp.longitude) : null,
    startDate: new Date(String(camp.startDate) + "T00:00:00Z"),
    endDate: camp.endDate ? new Date(String(camp.endDate) + "T00:00:00Z") : null,
    startTime: camp.startTime ? String(camp.startTime) : null,
    endTime: camp.endTime ? String(camp.endTime) : null,
    status: "UPCOMING",
    targetDonors: camp.targetDonors ? Number(camp.targetDonors) : 0,
    contact: camp.contact ? String(camp.contact) : null,
  });
  // MySQL doesn't support returning(), fetch the inserted camp
  const [row] = await db.select().from(bloodCamps).where(eq(bloodCamps.name, String(camp.name))).limit(1);

  await writeAuditLog({
    userId: auth.userId, action: "CAMP_CREATED", entityType: "blood_camps",
    entityId: row.id, details: { name: row.name, city: row.city }, ipAddress: getClientIp(req),
  });

  return json({ message: "Blood camp created", camp: row }, 201);
}

// GET registrations for a camp (staff).
export async function PUT(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const campId = Number(req.nextUrl.searchParams.get("campId"));
  const rows = await db.select({
    registration: campRegistrations,
    donorName: donors.fullName,
    donorBloodGroup: donors.bloodGroup,
  })
    .from(campRegistrations)
    .leftJoin(donors, eq(campRegistrations.donorId, donors.id))
    .where(eq(campRegistrations.campId, campId))
    .orderBy(desc(campRegistrations.registeredAt));
  return json({ data: rows });
}
