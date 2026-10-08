import { NextRequest } from "next/server";
import { db } from "@/db";
import { followUps, donors } from "@/db/schema";
import { eq, desc, and, lte, sql } from "drizzle-orm";
import { json, ApiError, parseBody, requireAuth, requireStaff, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";
import { scheduleBucket } from "@/lib/eligibility";

export const dynamic = "force-dynamic";

const FOLLOW_UP_TYPES = ["HEALTH", "AVAILABILITY", "CERTIFICATE", "DONATION", "GENERAL"];

// GET /api/v1/follow-ups — follow-up tracking (staff: all; donors: their own).
export async function GET(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const sp = req.nextUrl.searchParams;
  const isStaff = (() => { try { requireStaff(auth); return true; } catch { return false; } })();

  const conditions = [];
  if (!isStaff && auth.donorId) conditions.push(eq(followUps.donorId, auth.donorId));
  if (isStaff && sp.get("donorId")) conditions.push(eq(followUps.donorId, Number(sp.get("donorId"))));
  if (sp.get("status")) conditions.push(eq(followUps.status, sp.get("status")!.toUpperCase()));

  const rows = await db.select({
    followUp: followUps,
    donorName: donors.fullName,
    donorBloodGroup: donors.bloodGroup,
    donorCity: donors.addressCity,
  })
    .from(followUps)
    .leftJoin(donors, eq(followUps.donorId, donors.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(followUps.dueDate))
    .limit(200);

  const withBuckets = rows.map((r) => ({ ...r, bucket: scheduleBucket(r.followUp.dueDate, r.followUp.status) }));

  const overdue = await db.select({ count: sql<number>`count(*)` }).from(followUps)
    .where(and(eq(followUps.status, "PENDING"), lte(followUps.dueDate, new Date())));

  return json({ data: withBuckets, total: rows.length, overdue: overdue[0]?.count ?? 0 });
}

// POST /api/v1/follow-ups — schedule a follow-up (staff).
export async function POST(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  const body = await parseBody(req);

  const donorId = body.donorId ? Number(body.donorId) : null;
  const type = String(body.type ?? "GENERAL").toUpperCase();
  if (!FOLLOW_UP_TYPES.includes(type)) throw new ApiError(400, "Invalid follow-up type");
  const dueDate = String(body.dueDate ?? "");
  if (!dueDate) throw new ApiError(400, "dueDate is required");

  await db.insert(followUps).values({
    donorId,
    volunteerId: body.volunteerId ? Number(body.volunteerId) : null,
    assignedTo: body.assignedTo ? Number(body.assignedTo) : null,
    type,
    dueDate: new Date(dueDate),
    notes: body.notes ? String(body.notes) : null,
    createdBy: auth.userId,
  });
  // MySQL doesn't support returning(), fetch the inserted follow-up
  const [row] = await db.select().from(followUps).orderBy(desc(followUps.id)).limit(1);

  await writeAuditLog({
    userId: auth.userId, action: "FOLLOW_UP_CREATED", entityType: "follow_ups",
    entityId: row.id, details: { donorId, type, dueDate }, ipAddress: getClientIp(req),
  });

  return json({ message: "Follow-up scheduled", followUp: row }, 201);
}

// PATCH /api/v1/follow-ups — complete or update a follow-up.
export async function PATCH(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const body = await parseBody(req);
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new ApiError(400, "id is required");

  const updates: Record<string, unknown> = {};
  if (body.status) {
    const status = String(body.status).toUpperCase();
    if (!["PENDING", "COMPLETED", "CANCELLED"].includes(status)) throw new ApiError(400, "Invalid status");
    updates.status = status;
    if (status === "COMPLETED") updates.completedAt = new Date();
  }
  if (body.notes !== undefined) updates.notes = String(body.notes) || null;
  if (body.dueDate) updates.dueDate = new Date(String(body.dueDate));

  await db.update(followUps).set(updates).where(eq(followUps.id, id));
  // MySQL doesn't support returning(), fetch the updated follow-up
  const [row] = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1);
  if (!row) throw new ApiError(404, "Follow-up not found");

  const isStaff = (() => { try { requireStaff(auth); return true; } catch { return false; } })();
  if (isStaff) {
    await writeAuditLog({
      userId: auth.userId, action: "FOLLOW_UP_UPDATED", entityType: "follow_ups",
      entityId: id, details: { changes: Object.keys(updates) }, ipAddress: getClientIp(req),
    });
  }

  return json({ message: "Follow-up updated", followUp: row });
}
