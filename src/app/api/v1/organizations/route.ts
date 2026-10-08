import { NextRequest } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { like, or, and, eq, desc, sql } from "drizzle-orm";
import { json, ApiError, parseBody, requireStaff, getAuthContext } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/v1/organizations — public directory of partner organizations.
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
  requireStaff(await getAuthContext(req));
  const body = await parseBody(req);
  const name = String(body.name ?? "").trim();
  if (!name) throw new ApiError(400, "Organization name is required");
  await db.insert(organizations).values({
    name,
    type: String(body.type ?? "NGO").toUpperCase(),
    address: body.address ? String(body.address) : null,
    city: body.city ? String(body.city) : null,
    district: body.district ? String(body.district) : null,
    contactPerson: body.contactPerson ? String(body.contactPerson) : null,
    phone: body.phone ? String(body.phone) : null,
    email: body.email ? String(body.email) : null,
    status: "ACTIVE",
  });
  // MySQL doesn't support returning(), fetch the inserted organization
  const [row] = await db.select().from(organizations).where(eq(organizations.name, name)).limit(1);
  return json({ message: "Organization registered", organization: row }, 201);
}
