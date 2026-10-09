import { NextRequest } from "next/server";
import { db } from "@/db";
import { bloodCamps, campRegistrations, organizations, donors } from "@/db/schema";
import { like, or, and, eq, desc, asc, sql, gte } from "drizzle-orm";
import { json, ApiError, parseBody, requireAuth, requireStaff, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";

export const dynamic = "force-dynamic";

const CAMP_STATUSES = ["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"];

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
  const values = {
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
  };
  await db.insert(bloodCamps).values(values);
  const [row] = await db.select().from(bloodCamps).where(eq(bloodCamps.name, String(camp.name))).limit(1);

  await writeAuditLog({
    userId: auth.userId, action: "CAMP_CREATED", entityType: "blood_camps",
    entityId: row.id, details: { name: row.name, city: row.city }, ipAddress: getClientIp(req),
  });

  return json({ message: "Blood camp created", camp: row }, 201);
}

// PUT /api/v1/camps — read registrations for a camp (staff).
export async function PUT(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const campId = Number(req.nextUrl.searchParams.get("campId"));
  if (!Number.isInteger(campId)) throw new ApiError(400, "campId is required (?campId=)");
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

// PATCH /api/v1/camps — update a blood camp (staff only).
// Body: { id, ...fields } or ?id=<id> with JSON fields.
export async function PATCH(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  let id: number | null = null;

  try {
    const body = await parseBody(req);
    if (body.id !== undefined) id = Number(body.id);
  } catch {
    // not JSON — fall through to query param
  }
  if (id === null || !Number.isInteger(id)) {
    const qp = req.nextUrl.searchParams.get("id");
    if (qp) id = Number(qp);
  }
  if (id === null || !Number.isInteger(id)) throw new ApiError(400, "Camp id is required (body.id or ?id=)");

  let body: Record<string, unknown>;
  try {
    body = await parseBody(req);
  } catch {
    throw new ApiError(400, "Request body must be JSON");
  }

  const [existing] = await db.select().from(bloodCamps).where(eq(bloodCamps.id, id)).limit(1);
  if (!existing) throw new ApiError(404, `Blood camp #${id} not found`);

  const updated: Record<string, unknown> = {};

  const name = fieldString(body.name);
  if (name !== undefined && name !== existing.name) updated.name = name;

  if (body.organizerId !== undefined) {
    const organizerId = body.organizerId === null || body.organizerId === "" ? null : Number(body.organizerId);
    if (Number.isNaN(organizerId)) throw new ApiError(400, "organizerId must be a valid organization id or empty/null");
    if (!Number.isInteger(organizerId) && organizerId !== null) throw new ApiError(400, "organizerId must be an integer");
    if (organizerId !== existing.organizerId) updated.organizerId = organizerId;
  }

  const location = fieldString(body.location);
  if (location !== undefined && location !== existing.location) updated.location = location;

  const address = fieldStringNullable(body.address);
  if (address !== undefined && address !== existing.address) updated.address = address;

  const city = fieldString(body.city);
  if (city !== undefined && city !== existing.city) updated.city = city;

  const district = fieldString(body.district);
  if (district !== undefined && district !== existing.district) updated.district = district;

  const latitude = fieldString(body.latitude);
  if (latitude !== undefined && latitude !== existing.latitude) updated.latitude = latitude;

  const longitude = fieldString(body.longitude);
  if (longitude !== undefined && longitude !== existing.longitude) updated.longitude = longitude;

  const startDate = fieldDate(body.startDate);
  if (startDate !== undefined) {
    if (!startDate) throw new ApiError(400, "camp.startDate cannot be empty");
    if (startDate.getTime() !== existing.startDate.getTime()) updated.startDate = startDate;
  }

  const endDate = fieldDateNullable(body.endDate);
  if (endDate !== undefined && endDate !== existing.endDate) updated.endDate = endDate;

  const startTime = fieldString(body.startTime);
  if (startTime !== undefined && startTime !== existing.startTime) updated.startTime = startTime;

  const endTime = fieldString(body.endTime);
  if (endTime !== undefined && endTime !== existing.endTime) updated.endTime = endTime;

  const status = body.status !== undefined ? String(body.status).trim().toUpperCase() : undefined;
  if (status !== undefined) {
    if (!CAMP_STATUSES.includes(status)) throw new ApiError(400, `Camp status must be one of: ${CAMP_STATUSES.join(", ")}`);
    if (status !== existing.status) updated.status = status;
  }

  if (body.targetDonors !== undefined) {
    const targetDonors = body.targetDonors === null || body.targetDonors === "" ? 0 : Number(body.targetDonors);
    if (Number.isNaN(targetDonors) || !Number.isInteger(targetDonors) || targetDonors < 0) {
      throw new ApiError(400, "camp.targetDonors must be a non-negative integer");
    }
    if (targetDonors !== existing.targetDonors) updated.targetDonors = targetDonors;
  }

  const contact = fieldString(body.contact);
  if (contact !== undefined && contact !== existing.contact) updated.contact = contact;

  if (Object.keys(updated).length === 0) {
    return json({ message: "No changes", camp: existing });
  }

  await db.update(bloodCamps).set(updated).where(eq(bloodCamps.id, id));
  const [row] = await db.select().from(bloodCamps).where(eq(bloodCamps.id, id)).limit(1);

  await writeAuditLog({
    userId: auth.userId, action: "CAMP_UPDATED", entityType: "blood_camps",
    entityId: id, details: { changes: Object.keys(updated) }, ipAddress: getClientIp(req),
  });

  return json({ message: "Blood camp updated", camp: row });
}

// DELETE /api/v1/camps — remove a blood camp (staff only).
// Body: { id } or ?id=<id>.
export async function DELETE(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  let id: number | null = null;

  try {
    const body = await parseBody(req);
    if (body.id !== undefined) id = Number(body.id);
  } catch {
    // not JSON — fall through to query param
  }
  if (id === null || !Number.isInteger(id)) {
    const qp = req.nextUrl.searchParams.get("id");
    if (qp) id = Number(qp);
  }
  if (id === null || !Number.isInteger(id)) throw new ApiError(400, "Camp id is required (body.id or ?id=)");

  const [existing] = await db.select().from(bloodCamps).where(eq(bloodCamps.id, id)).limit(1);
  if (!existing) throw new ApiError(404, `Blood camp #${id} not found`);

  await db.delete(bloodCamps).where(eq(bloodCamps.id, id));

  await writeAuditLog({
    userId: auth.userId, action: "CAMP_DELETED", entityType: "blood_camps",
    entityId: id, details: { name: existing.name, city: existing.city }, ipAddress: getClientIp(req),
  });

  return json({ message: "Blood camp deleted", camp: { id: existing.id, name: existing.name, city: existing.city, status: existing.status } });
}

// --- small helpers for partial camp field parsing ---

function fieldString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return String(value);
}

function fieldStringNullable(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return String(value);
}

function fieldDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `Invalid date: ${value}`);
  return d;
}

function fieldDateNullable(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return fieldDate(value);
}
