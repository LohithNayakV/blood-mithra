import { NextRequest } from "next/server";
import { db } from "@/db";
import { donors, donorSchedules } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { json, ApiError, requireAuth, getAuthContext } from "@/lib/api";
import { scheduleBucket } from "@/lib/eligibility";

export const dynamic = "force-dynamic";

// GET /api/v1/donors/schedules?donorId= — schedule & follow-up list.
// Each item is bucketed: Today | Tomorrow | This Week | Upcoming | Overdue | Completed.
export async function GET(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const donorId = Number(req.nextUrl.searchParams.get("donorId"));
  if (!Number.isInteger(donorId)) throw new ApiError(400, "donorId is required");

  const [donor] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);
  if (!donor) throw new ApiError(404, "Donor not found");
  if (donor.userId !== auth.userId) throw new ApiError(403, "Not authorized");

  const rows = await db.select().from(donorSchedules).where(eq(donorSchedules.donorId, donorId)).orderBy(asc(donorSchedules.scheduledDate));

  const items = rows.map((r) => ({
    ...r,
    bucket: scheduleBucket(r.scheduledDate, r.status),
  }));

  const summary = {
    today: items.filter((i) => i.bucket === "TODAY").length,
    tomorrow: items.filter((i) => i.bucket === "TOMORROW").length,
    thisWeek: items.filter((i) => i.bucket === "THIS_WEEK").length,
    upcoming: items.filter((i) => i.bucket === "UPCOMING").length,
    overdue: items.filter((i) => i.bucket === "OVERDUE").length,
    completed: items.filter((i) => i.bucket === "COMPLETED").length,
  };

  return json({ items, summary, nextEligibleDate: donor.nextEligibleDate, lastDonationDate: donor.lastDonationDate });
}

// PATCH /api/v1/donors/schedules — mark a schedule item completed/cancelled.
export async function PATCH(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const body = await req.json().catch(() => ({}));
  const scheduleId = Number(body.id);
  const status = String(body.status ?? "").toUpperCase();
  if (!Number.isInteger(scheduleId) || !["COMPLETED", "CANCELLED", "SCHEDULED"].includes(status)) {
    throw new ApiError(400, "id and a valid status are required");
  }
  const [row] = await db.select().from(donorSchedules).where(eq(donorSchedules.id, scheduleId)).limit(1);
  if (!row) throw new ApiError(404, "Schedule not found");
  const [donor] = await db.select().from(donors).where(eq(donors.id, row.donorId)).limit(1);
  if (donor?.userId !== auth.userId) throw new ApiError(403, "Not authorized");

  await db.update(donorSchedules).set({ status, updatedAt: new Date() }).where(eq(donorSchedules.id, scheduleId));
  // MySQL doesn't support returning(), fetch the updated schedule
  const [updated] = await db.select().from(donorSchedules).where(eq(donorSchedules.id, scheduleId)).limit(1);
  return json({ message: "Schedule updated", item: updated });
}
