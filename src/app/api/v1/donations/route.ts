import { NextRequest } from "next/server";
import { db } from "@/db";
import { donations, donationCertificates, donors } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { json, ApiError, parseBody, requireStaff, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";
import { generateCertificateNumber } from "@/lib/auth";
import { computeNextEligibleDate, getEligibilityRules } from "@/lib/eligibility";
import { computeActivityScore } from "@/lib/activity";

export const dynamic = "force-dynamic";

const DONATION_TYPES = ["WHOLE_BLOOD", "PLATELETS", "PLASMA", "DOUBLE_RED"];

// GET /api/v1/donations?donorId=&from=&to=&status= — donation tracking list.
export async function GET(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  const sp = req.nextUrl.searchParams;
  const donorId = sp.get("donorId") ? Number(sp.get("donorId")) : null;
  const from = sp.get("from");
  const to = sp.get("to");
  const status = sp.get("status");

  const conditions = [];
  if (donorId) conditions.push(eq(donations.donorId, donorId));
  if (from) conditions.push(gte(donations.donationDate, new Date(from + "T00:00:00Z")));
  if (to) conditions.push(lte(donations.donationDate, new Date(to + "T23:59:59Z")));
  if (status) conditions.push(eq(donations.status, status.toUpperCase()));

  const rows = await db.select().from(donations)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(donations.donationDate))
    .limit(200);

  return json({ data: rows, total: rows.length });
}

// POST /api/v1/donations — record a completed donation.
// Updates donor counters, recomputes eligibility + activity score, and
// creates a pending certificate automatically.
export async function POST(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  const body = await parseBody(req);

  const donorId = Number(body.donorId);
  if (!Number.isInteger(donorId)) throw new ApiError(400, "donorId is required");
  const donationDate = String(body.donationDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(donationDate)) throw new ApiError(400, "donationDate must be YYYY-MM-DD");
  const donationDateObj = new Date(donationDate + "T00:00:00Z");
  const donationType = String(body.donationType ?? "WHOLE_BLOOD").toUpperCase();
  if (!DONATION_TYPES.includes(donationType)) throw new ApiError(400, "Invalid donation type");

  const [donor] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);
  if (!donor) throw new ApiError(404, "Donor not found");

  const insertResult = await db.insert(donations).values({
    donorId,
    donationDate: donationDateObj,
    donationType,
    hospitalId: body.hospitalId ? Number(body.hospitalId) : null,
    bloodBankId: body.bloodBankId ? Number(body.bloodBankId) : null,
    campId: body.campId ? Number(body.campId) : null,
    units: body.units ? String(body.units) : "0.45",
    hemoglobin: body.hemoglobin ? String(body.hemoglobin) : null,
    verified: body.verified === true,
    verifiedBy: body.verified === true ? auth.userId : null,
    status: "COMPLETED",
  });
  // MySQL doesn't support returning(), fetch the inserted donation
  const [donation] = await db.select().from(donations).orderBy(desc(donations.id)).limit(1);
  const donationRecord = donation;

  // Certificate lifecycle starts at PENDING.
  await db.insert(donationCertificates).values({
    donationId: donation.id,
    donorId,
    certificateNumber: generateCertificateNumber(donation.id),
    status: "PENDING",
  });
  // Fetch the inserted certificate
  const [certificateRecord] = await db.select().from(donationCertificates).where(eq(donationCertificates.donationId, donation.id)).limit(1);

  // Update donor counters + eligibility.
  const rules = await getEligibilityRules();
  const nextEligible = computeNextEligibleDate(donationDate, donationType, donor.gender, rules);
  const totalDonations = donor.totalDonations + 1;
  const activityScore = computeActivityScore({
    profileCompletion: donor.profileCompletion,
    isProfileVerified: donor.isProfileVerified,
    isMobileVerified: donor.isMobileVerified,
    totalDonations,
    daysSinceRegistration: Math.floor((Date.now() - new Date(donor.registrationDate).getTime()) / 86400000),
    daysSinceLastDonation: 0,
    acceptedResponses: 0,
    sentNotifications: 0,
    availabilityConfirmations: 0,
    lastAvailabilityConfirmationDays: null,
  });

  await db.update(donors).set({
    lastDonationDate: donationDateObj,
    donationType,
    totalDonations,
    nextEligibleDate: nextEligible ? nextEligible : null,
    status: "RECENTLY_DONATED",
    activityScore,
    updatedAt: new Date(),
  }).where(eq(donors.id, donorId));

  // Schedule the next eligible donation date.
  if (nextEligible) {
    const { donorSchedules } = await import("@/db/schema");
    await db.insert(donorSchedules).values({
      donorId,
      type: "DONATION",
      scheduledDate: nextEligible ? new Date(nextEligible.getTime()) : new Date(),
      status: "SCHEDULED",
      notes: "Next eligible donation date",
    });
  }

  await writeAuditLog({
    userId: auth.userId, action: "DONATION_RECORDED", entityType: "donations",
    entityId: donation.id, details: { donorId, donationType, donationDate }, ipAddress: getClientIp(req),
  });

  return json({ message: "Donation recorded", donation: donationRecord, certificate: certificateRecord }, 201);
}
