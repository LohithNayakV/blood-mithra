import { NextRequest } from "next/server";
import { verifyToken, type AuthTokenPayload } from "@/lib/auth";
import { db } from "@/db";
import { auditLogs, users, roles } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Shared API helpers: JSON responses, auth context, RBAC, rate limiting,
// audit logging and consistent error handling.
// ---------------------------------------------------------------------------

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status = 400, details?: unknown): Response {
  return Response.json({ error: message, details }, { status });
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// MySQL JSON handling: unlike Postgres (which returns parsed values), the
// mysql2 driver returns JSON columns as strings and this Drizzle version has
// no mapFromDriverValue for MySqlJson — so every JSON column arrives as a
// string at runtime even though the types claim otherwise. Always normalize
// through these helpers at API boundaries instead of trusting the type.
// ---------------------------------------------------------------------------

/** Parse a MySQL JSON column value that may already be parsed, a JSON string, or null. */
export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

/** Normalize a JSON column into an array (e.g. badges, permissions, milestones). */
export function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  const parsed = parseJsonField<unknown>(value, fallback);
  return Array.isArray(parsed) ? (parsed as T[]) : fallback;
}

/** Wrap a route handler so thrown ApiErrors become clean JSON responses. */
export function withErrorHandling(
  handler: (req: NextRequest, ctx: { params: Promise<Record<string, string>>, user: AuthContext | null }) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const user = await getAuthContext(req);
      return await handler(req, { params: ctx.params, user });
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.message, err.status);
      }
      console.error("[api] unhandled error:", err);
      return errorResponse("Internal server error", 500);
    }
  };
}

export interface AuthContext {
  userId: number;
  role: string;
  donorId: number | null;
  permissions: string[];
}

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "REGIONAL_ADMIN"]);
const STAFF_ROLES = new Set([
  "SUPER_ADMIN",
  "REGIONAL_ADMIN",
  "HOSPITAL_COORDINATOR",
  "BLOOD_BANK_OPERATOR",
  "NGO_ORGANIZER",
  "SUPPORT_AGENT",
  "AUDITOR",
]);
// Roles allowed to read private donor health information.
const HEALTH_ACCESS_ROLES = new Set([
  "SUPER_ADMIN",
  "REGIONAL_ADMIN",
  "HOSPITAL_COORDINATOR",
  "BLOOD_BANK_OPERATOR",
  "SUPPORT_AGENT",
]);

export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const payload = await verifyToken(header.slice(7));
  if (!payload) return null;

  let permissions: string[] = [];
  let roleName = payload.role;
  try {
    const [row] = await db
      .select({ permissions: roles.permissions, name: roles.name })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, payload.userId))
      .limit(1);
    if (row) {
      permissions = parseJsonArray<string>(row.permissions);
      roleName = row.name ?? payload.role;
    }
  } catch {
    // DB unavailable — fall back to token claims.
  }
  return { userId: payload.userId, role: roleName, donorId: payload.donorId ?? null, permissions };
}

export function requireAuth(ctx: AuthContext | null): AuthContext {
  if (!ctx) throw new ApiError(401, "Authentication required");
  return ctx;
}

export function requireRole(ctx: AuthContext | null, allowed: Set<string>): AuthContext {
  const auth = requireAuth(ctx);
  if (!allowed.has(auth.role)) {
    throw new ApiError(403, `Access denied — requires one of: ${[...allowed].join(", ")}`);
  }
  return auth;
}

export const requireAdmin = (ctx: AuthContext | null) => requireRole(ctx, ADMIN_ROLES);
export const requireStaff = (ctx: AuthContext | null) => requireRole(ctx, STAFF_ROLES);
export const requireHealthAccess = (ctx: AuthContext | null) => requireRole(ctx, HEALTH_ACCESS_ROLES);

/** Mask a phone number for contexts where full contact details are restricted. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return "****";
  return `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}

export function canViewFullContact(ctx: AuthContext | null, ownerUserId?: number | null): boolean {
  if (!ctx) return false;
  if (ownerUserId && ctx.userId === ownerUserId) return true;
  return STAFF_ROLES.has(ctx.role);
}

// --- Simple in-memory rate limiter (per-process, per-identifier) ----------

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(identifier);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Record an admin/staff action in the audit log (best-effort). */
export async function writeAuditLog(entry: {
  userId?: number | null;
  action: string;
  entityType?: string;
  entityId?: number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}

/** Parse and validate a JSON request body with a friendly error. */
export async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new Error("Body must be a JSON object");
    }
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Invalid JSON request body");
  }
}
