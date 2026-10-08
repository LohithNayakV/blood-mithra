import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, roles, userRoles, donors } from "@/db/schema";
import { eq, like, or, and, desc, sql } from "drizzle-orm";
import { json, ApiError, parseBody, requireAdmin, requireStaff, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/v1/users — user management (admin sees all; staff sees donors' users).
export async function GET(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const sp = req.nextUrl.searchParams;
  const search = sp.get("search")?.trim() || null;
  const role = sp.get("role") || null;

  const conditions = [];
  if (search) {
    conditions.push(or(
      like(users.fullName, `%${search}%`),
      like(users.mobile, `%${search}%`),
      like(users.email, `%${search}%`),
    )!);
  }
  if (role) conditions.push(eq(roles.name, role.toUpperCase()));

  const rows = await db.select({
    user: users,
    roleName: roles.name,
    donorId: donors.id,
  })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(donors, eq(donors.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(200);

  const total = await db.select({ c: sql<number>`count(*)` }).from(users);
  return json({ data: rows.map((r) => ({ ...r.user, passwordHash: undefined, roleName: r.roleName, donorId: r.donorId ?? null })), total: total[0]?.c ?? 0 });
}

// POST /api/v1/users — create a staff user (admin only).
export async function POST(req: NextRequest) {
  const auth = requireAdmin(await getAuthContext(req));
  const body = await parseBody(req);
  const fullName = String(body.fullName ?? "").trim();
  const mobile = String(body.mobile ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  const password = String(body.password ?? "");
  const roleName = String(body.role ?? "SUPPORT_AGENT").toUpperCase();

  if (!fullName || !/^[6-9]\d{9}$/.test(mobile) || password.length < 6) {
    throw new ApiError(400, "fullName, a valid mobile and a 6+ character password are required");
  }
  const [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
  if (!role) throw new ApiError(400, "Invalid role");

  await db.insert(users).values({
    fullName, mobile, email,
    passwordHash: await hashPassword(password),
    roleId: role.id,
    status: "ACTIVE",
    isVerified: true,
  });
  // MySQL doesn't support returning(), fetch the inserted user
  const [user] = await db.select().from(users).where(eq(users.mobile, mobile)).limit(1);
  await db.insert(userRoles).ignore().values({ userId: user.id, roleId: role.id });

  await writeAuditLog({
    userId: auth.userId, action: "USER_CREATED", entityType: "users",
    entityId: user.id, details: { fullName, role: roleName }, ipAddress: getClientIp(req),
  });

  return json({ message: "User created", user: { ...user, passwordHash: undefined } }, 201);
}

// PATCH /api/v1/users — update status / role (admin only).
export async function PATCH(req: NextRequest) {
  const auth = requireAdmin(await getAuthContext(req));
  const body = await parseBody(req);
  const id = Number(body.id);
  if (!Number.isInteger(id)) throw new ApiError(400, "id is required");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.status) updates.status = String(body.status).toUpperCase();
  if (body.role) {
    const roleName = String(body.role).toUpperCase();
    const [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
    if (!role) throw new ApiError(400, "Invalid role");
    updates.roleId = role.id;
  }

  await db.update(users).set(updates).where(eq(users.id, id));
  // MySQL doesn't support returning(), fetch the updated user
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new ApiError(404, "User not found");

  await writeAuditLog({
    userId: auth.userId, action: "USER_UPDATED", entityType: "users",
    entityId: id, details: { changes: Object.keys(updates) }, ipAddress: getClientIp(req),
  });

  return json({ message: "User updated", user: { ...user, passwordHash: undefined } });
}
