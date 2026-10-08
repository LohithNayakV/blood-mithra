import { NextRequest } from "next/server";
import { db } from "@/db";
import { donors, donorProfiles, donorAvailability, donorSchedules } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { json, ApiError, parseBody, requireAuth, getAuthContext } from "@/lib/api";
import { getEligibilityRules } from "@/lib/eligibility";

export const dynamic = "force-dynamic";

const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// GET /api/v1/donors/availability?donorId= — current availability + reminder history.
export async function GET(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const donorId = Number(req.nextUrl.searchParams.get("donorId"));
  if (!Number.isInteger(donorId)) throw new ApiError(400, "donorId is required");

  const [donor] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);
  if (!donor) throw new ApiError(404, "Donor not found");
  if (donor.userId !== auth.userId) throw new ApiError(403, "Not authorized");

  const [profile] = await db.select().from(donorProfiles).where(eq(donorProfiles.donorId, donorId)).limit(1);
  const history = await db.select().from(donorAvailability).where(eq(donorAvailability.donorId, donorId)).orderBy(desc(donorAvailability.confirmedAt)).limit(20);

  return json({
    availabilityStatus: donor.availabilityStatus,
    lastConfirmation: profile?.lastAvailabilityConfirmation ?? null,
    nextConfirmation: profile?.nextAvailabilityConfirmation ?? null,
    history,
  });
}

// POST /api/v1/donors/availability — donor answers:
// "Are you currently available to help with a blood request?" (YES / NO)
export async function POST(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const body = await parseBody(req);
  const donorId = Number(body.donorId);
  if (!Number.isInteger(donorId)) throw new ApiError(400, "donorId is required");

  const answer = String(body.available ?? "").toUpperCase();
  if (!["YES", "NO", "true", "false"].includes(answer)) {
    throw new ApiError(400, "available must be YES or NO");
  }
  const available = answer === "YES" || answer === "true";

  const [donor] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);
  if (!donor) throw new ApiError(404, "Donor not found");
  if (donor.userId !== auth.userId) throw new ApiError(403, "Not authorized");

  const rules = await getEligibilityRules();
  const nextConfirmation = daysAhead(rules.availability_confirmation_days);
  const availabilityStatus = available ? "AVAILABLE" : "UNAVAILABLE";

  // Track the confirmation + reminder history.
  await db.insert(donorAvailability).values({
    donorId,
    available,
    confirmedAt: new Date(),
    nextConfirmationDate: nextConfirmation,
    source: "SELF",
  });

  await db.update(donors).set({ availabilityStatus, updatedAt: new Date() }).where(eq(donors.id, donorId));
  await db.update(donorProfiles).set({
    lastAvailabilityConfirmation: new Date(),
    nextAvailabilityConfirmation: nextConfirmation,
    emergencyAvailability: available,
    updatedAt: new Date(),
  }).where(eq(donorProfiles.donorId, donorId));

  // Schedule the next availability confirmation follow-up.
  await db.insert(donorSchedules).values({
    donorId,
    type: "AVAILABILITY",
    scheduledDate: nextConfirmation,
    status: "SCHEDULED",
    notes: "Availability confirmation due",
  });

  return json({
    message: available
      ? "Thank you! You are marked as available for blood requests."
      : "You are marked as unavailable. We will remind you later.",
    availabilityStatus,
    nextConfirmationDate: nextConfirmation,
  });
}
