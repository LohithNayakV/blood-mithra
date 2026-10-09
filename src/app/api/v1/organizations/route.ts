import { NextRequest } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { like, or, and, eq, desc, sql } from "drizzle-orm";
import { json, ApiError, parseBody, requireStaff, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";

export const dynamic = "force-dynamic";

const ORG_TYPES = ["NGO", "HOSPITAL", "BLOOD_BANK", "CORPORATE", "COMMUNITY"];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || null;
  const district = sp.get("district") || null;
  const search = sp.get("search")?.trim() || null;

  const conditions = [];
  if (type) conditions.push(eq(organizations.type, type.toUpperCase()));
  if (district) conditions.push(like(organizations.district, `%${district}%`));
  if (search) conditions.push(or(like(organizations.name, `%${search}%`), like(organizations.city, `%${search}%`))!);

  const rows = await db.select().from(organizations)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(organizations.createdAt))
    .limit(200);

  const byType = await db.select({
    type: organizations.type,
    count: sql<number>`count(*)`,
  }).from(organizations).groupBy(organizations.type);

  return json({ data: rows, total: rows.length, byType });
}

// POST /api/v1/organizations — register an organization (staff only).
export async function POST(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  const body = await parseBody(req);
  const name = String(body.name ?? "").trim();
  if (!name) throw new ApiError(400, "Organization name is required");
  const type = String(body.type ?? "NGO").toUpperCase();
  if (!ORG_TYPES.includes(type)) throw new ApiError(400, `Organization type must be one of: ${ORG_TYPES.join(", ")}`);

  const values = {
    name,
    type,
    address: body.address ? String(body.address) : null,
    city: body.city ? String(body.city) : null,
    district: body.district ? String(body.district) : null,
    contactPerson: body.contactPerson ? String(body.contactPerson) : null,
    phone: body.phone ? String(body.phone) : null,
    email: body.email ? String(body.email) : null,
    status: "ACTIVE",
  };

  await db.insert(organizations).values(values);
  const [row] = await db.select().from(organizations).where(eq(organizations.name, name)).limit(1);

  await writeAuditLog({
    userId: auth.userId, action: "ORGANIZATION_CREATED", entityType: "organizations",
    entityId: row.id, details: { name: row.name, type: row.type }, ipAddress: getClientIp(req),
  });

  return json({ message: "Organization registered", organization: row }, 201);
}  // PATCH /api/v1/organizations — update an organization (staff only).
// Body: { id, ...fields }. Unknown fields are ignored.
export async function PATCH(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  const body = await parseBody(req);
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new ApiError(400, "Organization id is required (body.id)");

  const [existing] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!existing) throw new ApiError(404, `Organization #${id} not found`);

  const updated: Record<string, unknown> = {};

  const name = body.name !== undefined ? String(body.name ?? "").trim() : undefined;
  if (name !== undefined) {
    if (!name) throw new ApiError(400, "Organization name cannot be empty");
    if (name !== existing.name) updated.name = name;
  }

  const type = body.type !== undefined ? String(body.type).trim().toUpperCase() : undefined;
  if (type !== undefined) {
    if (!ORG_TYPES.includes(type)) throw new ApiError(400, `Organization type must be one of: ${ORG_TYPES.join(" , ")}`);
    if (type !== existing.type) updated.type = type;
  }

  const address = body.address !== undefined ? (body.address === null || body.address === "" ? null : String(body.address)) : undefined;
  if (address !== undefined && address !== existing.address) updated.address = address;

  const city = field(body.city);
  if (city !== undefined && city !== existing.city) updated.city = city;

  const district = field(body.district);
  if (district !== undefined && district !== existing.district) updated.district = district;

  const contactPerson = field(body.contactPerson);
  if (contactPerson !== undefined && contactPerson !== existing.contactPerson) updated.contactPerson = contactPerson;

  const phone = field(body.phone);
  if (phone !== undefined && phone !== existing.phone) updated.phone = phone;

  const email = field(body.email);
  if (email !== undefined && email !== existing.email) updated.email = email;

  const status = body.status !== undefined ? String(body.status ?? "").trim().toUpperCase() : undefined;
  if (status !== undefined) {
    if (!["ACTIVE", "INACTIVE"].includes(status)) throw new ApiError(400, "Organization status must be ACTIVE or INACTIVE");
    if (status !== existing.status) updated.status = status;
  }

  if (Object.keys(updated).length === 0) {
    return json({ message: "No changes", organization: existing });
  }

  await db.update(organizations).set(updated).where(eq(organizations.id, id));
  const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);

  await writeAuditLog({
    userId: auth.userId, action: "ORGANIZATION_UPDATED", entityType: "organizations",
    entityId: id, details: { changes: Object.keys(updated) }, ipAddress: getClientIp(req),
  });

  return json({ message: "Organization updated", organization: row });
}

// DELETE /api/v1/organizations — remove an organization (staff only).
// Id is taken from the JSON body { id } or from ?id=.
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
  if (id === null || !Number.isInteger(id)) throw new ApiError(400, "Organization id is required (body.id or ?id=)");

  const [existing] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!existing) throw new ApiError(404, `Organization #${id} not found`);

  await db.delete(organizations).where(eq(organizations.id, id));

  await writeAuditLog({
    userId: auth.userId, action: "ORGANIZATION_DELETED", entityType: "organizations",
    entityId: id, details: { name: existing.name, type: existing.type }, ipAddress: getClientIp(req),
  });

  return json({ message: "Organization deleted", organization: { id: existing.id, name: existing.name, type: existing.type } });
}

function field(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}
