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

// PATCH /api/v1/hospitals — update hospital (staff only).
export async function PATCH(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const body = await parseBody(req);
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new ApiError(400, "id is required");
  await db.update(hospitals).set({
    ...(body.name ? { name: String(body.name) } : {}),
    ...(body.status ? { status: String(body.status) } : {}),
    updatedAt: new Date(),
  }).where(eq(hospitals.id, id));
  // MySQL doesn't support returning(), fetch the updated hospital
  const [row] = await db.select().from(hospitals).where(eq(hospitals.id, id)).limit(1);
  if (!row) throw new ApiError(404, "Hospital not found");
  return json({ message: "Hospital updated", hospital: row });
}
