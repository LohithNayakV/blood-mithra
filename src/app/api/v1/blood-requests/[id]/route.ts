import { NextRequest } from "next/server";
import { db } from "@/db";
import { bloodRequests, requestNotifications, donors, notifications } from "@/db/schema";
import { eq, desc, sql, and, or, inArray } from "drizzle-orm";
import { json, ApiError, requireAuth, requireStaff, getAuthContext, parseBody, writeAuditLog, getClientIp } from "@/lib/api";
import { haversineKm } from "@/lib/geo";

export const dynamic = "force-dynamic";

const LIFECYCLE = ["CREATED", "VERIFICATION", "DONORS_NOTIFIED", "RESPONSES_CONFIRMED", "CONFIRMED", "COLLECTED", "FULFILLED", "CANCELLED"];

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/blood-requests/:id — full request tracking through its lifecycle:
// Created → Verification → Donors Notified → Donor Responses → Confirmed →
// Blood Collected → Certificate/Donation Record → Fulfilled.
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId)) throw new ApiError(400, "Invalid request id");

  const [request] = await db.select().from(bloodRequests).where(eq(bloodRequests.id, requestId)).limit(1);
  if (!request) throw new ApiError(404, "Blood request not found");

  const waves = await db.select().from(requestNotifications).where(eq(requestNotifications.requestId, requestId)).orderBy(desc(requestNotifications.sentAt));
  const summary = await db.select({
    status: requestNotifications.status,
    count: sql<number>`count(*)`,
  }).from(requestNotifications).where(eq(requestNotifications.requestId, requestId)).groupBy(requestNotifications.status);

  return json({ request, waves, summary });
}

// PATCH /api/v1/blood-requests/:id — advance lifecycle status or trigger the
// next notification wave (?action=next-wave).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = requireStaff(await getAuthContext(req));
  const { id } = await ctx.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId)) throw new ApiError(400, "Invalid request id");

  const [request] = await db.select().from(bloodRequests).where(eq(bloodRequests.id, requestId)).limit(1);
  if (!request) throw new ApiError(404, "Blood request not found");

  const sp = req.nextUrl.searchParams;
  const action = sp.get("action");

  // --- Trigger the next notification wave -----------------------------------
  if (action === "next-wave") {
    const nextWave = request.currentWave + 1;
    if (nextWave > 3) throw new ApiError(400, "All notification waves have already been sent");

    const alreadyNotified = new Set(
      (await db.select({ donorId: requestNotifications.donorId }).from(requestNotifications).where(eq(requestNotifications.requestId, requestId)))
        .map((r) => r.donorId),
    );

    const compatible = [request.bloodGroup]; // later waves relax to same-group only pool expansion by district
    const pool = await db.select().from(donors).where(
      and(
        inArray(donors.bloodGroup, compatible),
        eq(donors.eligibilityStatus, "ELIGIBLE"),
        or(eq(donors.status, "ACTIVE"), eq(donors.status, "VERIFIED"), eq(donors.status, "REGULAR_DONOR"), eq(donors.status, "RECENTLY_DONATED")),
      ),
    );

    const waveSize = nextWave === 2 ? 50 : 200;
    const targets = pool
      .filter((d) => !alreadyNotified.has(d.id))
      .sort((a, b) => (b.activityScore ?? 0) - (a.activityScore ?? 0))
      .slice(0, waveSize);

    for (const d of targets) {
      await db.insert(requestNotifications).values({
        requestId,
        donorId: d.id,
        wave: nextWave,
        status: "SENT",
        distanceKm: haversineKm(request.latitude, request.longitude, d.latitude, d.longitude)?.toFixed(2) ?? null,
      });
      await db.insert(notifications).values({
        donorId: d.id,
        type: "EMERGENCY_REQUEST",
        title: `🩸 Wave ${nextWave}: ${request.bloodGroup} blood needed${request.city ? ` in ${request.city}` : ""}`,
        message: `${request.unitsRequired} unit(s) of ${request.bloodGroup} needed at ${request.hospitalName ?? "a hospital"}. Urgency: ${request.urgency}.`,
      });
    }

    await db.update(bloodRequests).set({
      status: "DONORS_NOTIFIED",
      currentWave: nextWave,
      donorsNotified: request.donorsNotified + targets.length,
      updatedAt: new Date(),
    }).where(eq(bloodRequests.id, requestId));
    // MySQL doesn't support returning(), fetch the updated request
    const [updated] = await db.select().from(bloodRequests).where(eq(bloodRequests.id, requestId)).limit(1);

    await writeAuditLog({
      userId: auth.userId, action: "REQUEST_WAVE_SENT", entityType: "blood_requests",
      entityId: requestId, details: { wave: nextWave, notified: targets.length }, ipAddress: getClientIp(req),
    });

    return json({ message: `Wave ${nextWave} sent to ${targets.length} donor(s)`, request: updated });
  }

  // --- Advance lifecycle status ----------------------------------------------
  const body = await parseBody(req);
  const status = String(body.status ?? "").toUpperCase();
  if (!LIFECYCLE.includes(status)) {
    throw new ApiError(400, `Invalid status. Lifecycle: ${LIFECYCLE.join(" → ")}`);
  }

  await db.update(bloodRequests).set({ status, updatedAt: new Date() }).where(eq(bloodRequests.id, requestId));
  // MySQL doesn't support returning(), fetch the updated request
  const [updated] = await db.select().from(bloodRequests).where(eq(bloodRequests.id, requestId)).limit(1);

  await writeAuditLog({
    userId: auth.userId, action: "REQUEST_STATUS_CHANGED", entityType: "blood_requests",
    entityId: requestId, details: { from: request.status, to: status }, ipAddress: getClientIp(req),
  });

  return json({ message: `Request status updated to ${status}`, request: updated });
}
