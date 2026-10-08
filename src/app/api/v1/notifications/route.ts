import { NextRequest } from "next/server";
import { db } from "@/db";
import { notifications, requestNotifications } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { json, ApiError, requireAuth, requireStaff, getAuthContext, parseBody } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/v1/notifications — list notifications.
// Donors see their own; staff can query by donorId/userId.
export async function GET(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const sp = req.nextUrl.searchParams;
  const isStaff = (() => { try { requireStaff(auth); return true; } catch { return false; } })();

  let rows;
  if (isStaff && sp.get("donorId")) {
    rows = await db.select().from(notifications)
      .where(eq(notifications.donorId, Number(sp.get("donorId"))))
      .orderBy(desc(notifications.sentAt)).limit(100);
  } else if (auth.donorId) {
    rows = await db.select().from(notifications)
      .where(eq(notifications.donorId, auth.donorId))
      .orderBy(desc(notifications.sentAt)).limit(100);
  } else {
    rows = await db.select().from(notifications)
      .where(eq(notifications.userId, auth.userId))
      .orderBy(desc(notifications.sentAt)).limit(100);
  }

  const unread = rows.filter((r) => !r.readAt).length;
  return json({ data: rows, total: rows.length, unread });
}

// PATCH /api/v1/notifications — mark notifications as read.
export async function PATCH(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const body = await parseBody(req);
  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(Number) : [];
  if (ids.length === 0) throw new ApiError(400, "ids array is required");

  await db.update(notifications).set({ readAt: new Date() }).where(
    auth.donorId
      ? eq(notifications.donorId, auth.donorId)
      : eq(notifications.userId, auth.userId),
  );
  return json({ message: "Notifications marked as read" });
}

// GET /api/v1/notifications/requests — emergency request notifications sent to
// the current donor, with per-notification tracking (sent/viewed/accepted/...).
export async function POST(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  if (!auth.donorId) throw new ApiError(403, "No donor profile linked to this account");
  const rows = await db.select().from(requestNotifications)
    .where(eq(requestNotifications.donorId, auth.donorId))
    .orderBy(desc(requestNotifications.sentAt))
    .limit(50);
  const summary = await db.select({
    status: requestNotifications.status,
    count: sql<number>`count(*)`,
  }).from(requestNotifications).where(eq(requestNotifications.donorId, auth.donorId)).groupBy(requestNotifications.status);
  return json({ data: rows, summary });
}
