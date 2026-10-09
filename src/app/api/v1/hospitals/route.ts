import { NextRequest } from "next/server";
import { db } from "@/db";
import { hospitals } from "@/db/schema";
import { like, or, and, eq, desc } from "drizzle-orm";
import { json, ApiError, parseBody, requireStaff, getAuthContext } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/v1/hospitals — public list/search (used by request forms too).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const city = sp.get("city") || null;
  const district = sp.get("district") || null;
  const search = sp.get("search")?.trim() || null;

  const conditions = [];
  if (city) conditions.push(like(hospitals.city, `%${city}%`));
  if (district) conditions.push(like(hospitals.district, `%${district}%`));
  if (search) conditions.push(or(like(hospitals.name, `%${search}%`), like(hospitals.city, `%${search}%`))!);

  const rows = await db.select().from(hospitals)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(hospitals.name)
    .limit(200);
  return json({ data: rows, total: rows.length });
}

// POST /api/v1/hospitals — register a hospital (staff only).
export async function POST(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const body = await parseBody(req);
  const name = String(body.name ?? "").trim();
  if (!name) throw new ApiError(400, "Hospital name is required");
  await db.insert(hospitals).values({
    name,
    address: body.address ? String(body.address) : null,
    city: body.city ? String(body.city) : null,
    district: body.district ? String(body.district) : null,
    pincode: body.pincode ? String(body.pincode) : null,
    latitude: body.latitude ? String(body.latitude) : null,
    longitude: body.longitude ? String(body.longitude) : null,
    phone: body.phone ? String(body.phone) : null,
    email: body.email ? String(body.email) : null,
    type: body.type ? String(body.type) : "HOSPITAL",
    status: "ACTIVE",
  });
  // MySQL doesn't support returning(), fetch the inserted hospital
  const [row] = await db.select().from(hospitals).where(eq(hospitals.name, name)).limit(1);
  return json({ message: "Hospital registered", hospital: row }, 201);
}

// PATCH /api/v1/hospitals — full edit (staff only).
export async function PATCH(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const body = await parseBody(req);
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new ApiError(400, "id is required");
  const [existing] = await db.select().from(hospitals).where(eq(hospitals.id, id)).limit(1);
  if (!existing) throw new ApiError(404, "Hospital not found");
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const strOrNull = (v: unknown) => (v === undefined ? undefined : v === null || v === "" ? null : String(v));
  if (body.name !== undefined) {
    const v = String(body.name ?? "").trim();
    if (!v) throw new ApiError(400, "Hospital name cannot be empty");
    updates.name = v;
  }
  for (const k of ["address", "city", "district", "pincode", "latitude", "longitude", "phone", "email", "type"] as const) {
    const v = strOrNull((body as Record<string, unknown>)[k]);
    if (v !== undefined) updates[k] = v;
  }
  if (body.status !== undefined) {
    const s = String(body.status).toUpperCase();
    if (!["ACTIVE", "INACTIVE"].includes(s)) throw new ApiError(400, "Status must be ACTIVE or INACTIVE");
    updates.status = s;
  }
  await db.update(hospitals).set(updates).where(eq(hospitals.id, id));
  const [row] = await db.select().from(hospitals).where(eq(hospitals.id, id)).limit(1);
  return json({ message: "Hospital updated", hospital: row });
}

// DELETE /api/v1/hospitals — remove a hospital (staff only).
export async function DELETE(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  let id: number | null = null;
  try {
    const body = await parseBody(req);
    if (body.id !== undefined) id = Number(body.id);
  } catch { /* query param fallback */ }
  if (id === null || !Number.isInteger(id)) {
    const qp = req.nextUrl.searchParams.get("id");
    if (qp) id = Number(qp);
  }
  if (id === null || !Number.isInteger(id)) throw new ApiError(400, "Hospital id is required");
  const [existing] = await db.select().from(hospitals).where(eq(hospitals.id, id)).limit(1);
  if (!existing) throw new ApiError(404, "Hospital not found");
  await db.delete(hospitals).where(eq(hospitals.id, id));
  return json({ message: "Hospital deleted", hospital: { id: existing.id } });
}
