import { NextRequest } from "next/server";
import { db } from "@/db";
import { requestNotifications, bloodRequests, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { json, ApiError, parseBody, requireAuth, getAuthContext } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/notifications/:id/respond — donor responds to an emergency
// request notification: ACCEPTED or REJECTED (VIEWED is set automatically).
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = requireAuth(await getAuthContext(req));
  if (!auth.donorId) throw new ApiError(403, "No donor profile linked to this account");

  const { id } = await ctx.params;
  const notificationId = Number(id);
  if (!Number.isInteger(notificationId)) throw new ApiError(400, "Invalid notification id");

  const body = await parseBody(req);
  const response = String(body.response ?? "").toUpperCase();
  if (!["ACCEPTED", "REJECTED", "VIEWED"].includes(response)) {
    throw new ApiError(400, "response must be ACCEPTED, REJECTED or VIEWED");
  }

  const [row] = await db.select().from(requestNotifications).where(eq(requestNotifications.id, notificationId)).limit(1);
  if (!row) throw new ApiError(404, "Notification not found");
  if (row.donorId !== auth.donorId) throw new ApiError(403, "Not authorized");

  const now = new Date();
  const updates: Record<string, unknown> = {
    status: response,
    ...(response === "VIEWED" ? { viewedAt: row.viewedAt ?? now } : { respondedAt: now }),
  };
  await db.update(requestNotifications).set(updates).where(eq(requestNotifications.id, notificationId));
  // MySQL doesn't support returning(), fetch the updated notification
  const [updated] = await db.select().from(requestNotifications).where(eq(requestNotifications.id, notificationId)).limit(1);

  // Keep the request's response counter in sync.
  if (response === "ACCEPTED" || response === "REJECTED") {
    const [request] = await db.select().from(bloodRequests).where(eq(bloodRequests.id, row.requestId)).limit(1);
    if (request) {
      const newStatus = request.status === "DONORS_NOTIFIED" ? "RESPONSES_CONFIRMED" : request.status;
      await db.update(bloodRequests).set({
        responsesReceived: request.responsesReceived + 1,
        status: newStatus,
        updatedAt: now,
      }).where(eq(bloodRequests.id, row.requestId));
    }
  }

  await db.insert(notifications).values({
    donorId: auth.donorId,
    type: "GENERAL",
    title: response === "ACCEPTED" ? "✅ Thank you for accepting the request" : response === "REJECTED" ? "Request response recorded" : "Request viewed",
    message: response === "ACCEPTED"
      ? "You accepted a blood request. The hospital coordinator will contact you with next steps."
      : response === "REJECTED"
        ? "You declined the blood request. No further action is needed."
        : "You viewed a blood request notification.",
  });

  return json({ message: `Response recorded: ${response}`, notification: updated });
}
