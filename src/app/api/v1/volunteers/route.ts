import { NextRequest } from "next/server";
import { db } from "@/db";
import { volunteers, volunteerAssignments, donors } from "@/db/schema";
import { like, or, and, eq, desc, sql } from "drizzle-orm";
import { json, ApiError, parseBody, requireStaff, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";

export const dynamic = "force-dynamic";

const VOLUNTEER_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE", "PENDING"];

// GET /api/v1/volunteers — volunteer management list + dashboard stats.
export async function GET(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const sp = req.nextUrl.searchParams;
  const district = sp.get("district") || null;
  const status = sp.get("status")?.toUpperCase() || null;
  const search = sp.get("search")?.trim() || null;

  const conditions = [];
  if (district) conditions.push(like(volunteers.district, `%${district}%`));
  if (status) conditions.push(eq(volunteers.status, status));
  if (search) conditions.push(or(like(volunteers.name, `%${search}%`), like(volunteers.city, `%${search}%`))!);

  const rows = await db.select().from(volunteers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(volunteers.createdAt))
    .limit(200);

  const byDistrict = await db.select({
    district: volunteers.district,
    total: sql<number>`count(*)`,
    active: sql<number>`count(case when status = 'ACTIVE' then 1 end)`,
  }).from(volunteers).groupBy(volunteers.district);

  const totals = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(case when status = 'ACTIVE' then 1 end)`,
  }).from(volunteers);

  const assignments = await db.select({
    status: volunteerAssignments.status,
    count: sql<number>`count(*)`,
  }).from(volunteerAssignments).groupBy(volunteerAssignments.status);

  return json({ data: rows, total: rows.length, byDistrict, totals: totals[0], assignments });
}

// POST /api/v1/volunteers — register a volunteer (staff only).
export async function POST(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  const body = await parseBody(req);
  const name = String(body.name ?? "").trim();
  const mobile = String(body.mobile ?? "").trim();
  if (!name || !/^[6-9]\d{9}$/.test(mobile)) {
    throw new ApiError(400, "Volunteer name and a valid 10-digit mobile are required");
  }
  await db.insert(volunteers).values({
    name,
    mobile,
    email: body.email ? String(body.email) : null,
    district: body.district ? String(body.district) : null,
    city: body.city ? String(body.city) : null,
    assignedArea: body.assignedArea ? String(body.assignedArea) : null,
    availability: String(body.availability ?? "FLEXIBLE").toUpperCase(),
    status: "PENDING",
    responsibility: body.responsibility ? String(body.responsibility) : null,
    coordinator: body.coordinator ? String(body.coordinator) : null,
  });
  // MySQL doesn't support returning(), fetch the inserted volunteer
  const [row] = await db.select().from(volunteers).where(eq(volunteers.mobile, mobile)).limit(1);

  await writeAuditLog({
    userId: auth.userId, action: "VOLUNTEER_CREATED", entityType: "volunteers",
    entityId: row.id, details: { name, district: row.district }, ipAddress: getClientIp(req),
  });

  return json({ message: "Volunteer registered", volunteer: row }, 201);
}

// PATCH /api/v1/volunteers — update status / assignment (staff only).
export async function PATCH(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  const body = await parseBody(req);
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new ApiError(400, "id is required");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.status) {
    const status = String(body.status).toUpperCase();
    if (!VOLUNTEER_STATUSES.includes(status)) throw new ApiError(400, "Invalid volunteer status");
    updates.status = status;
  }
  if (body.assignedArea !== undefined) updates.assignedArea = String(body.assignedArea) || null;
  if (body.coordinator !== undefined) updates.coordinator = String(body.coordinator) || null;
  if (body.responsibility !== undefined) updates.responsibility = String(body.responsibility) || null;

  await db.update(volunteers).set(updates).where(eq(volunteers.id, id));
  // MySQL doesn't support returning(), fetch the updated volunteer
  const [row] = await db.select().from(volunteers).where(eq(volunteers.id, id)).limit(1);
  if (!row) throw new ApiError(404, "Volunteer not found");

  // Assign a volunteer to a donor.
  if (body.assignDonorId !== undefined) {
    const donorId = Number(body.assignDonorId);
    await db.update(donors).set({ assignedVolunteerId: id, updatedAt: new Date() }).where(eq(donors.id, donorId));
    await db.insert(volunteerAssignments).values({
      volunteerId: id, donorId, assignmentType: "DONOR_SUPPORT", status: "PENDING",
    });
  }

  await writeAuditLog({
    userId: auth.userId, action: "VOLUNTEER_UPDATED", entityType: "volunteers",
    entityId: id, details: { changes: Object.keys(updates) }, ipAddress: getClientIp(req),
  });

  return json({ message: "Volunteer updated", volunteer: row });
}
