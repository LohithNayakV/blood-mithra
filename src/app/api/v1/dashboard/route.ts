import { NextRequest } from "next/server";
import { db } from "@/db";
import {
  donors, donorProfiles, donorHealthRecords, donorSchedules, donorAvailability,
  donations, donationCertificates, requestNotifications, bloodRequests, notifications,
} from "@/db/schema";
import { eq, desc, sql, and, or } from "drizzle-orm";
import { json, ApiError, requireAuth, getAuthContext, parseJsonArray } from "@/lib/api";
import { computeAge, scheduleBucket } from "@/lib/eligibility";

export const dynamic = "force-dynamic";

// GET /api/v1/dashboard — the personal Donor Dashboard payload:
// profile completion, availability, eligibility, activity score, badges,
// emergency requests, donation history, certificates, health, notifications,
// schedules with Today/Tomorrow/This Week/Upcoming/Overdue/Completed buckets.
export async function GET(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  if (!auth.donorId) throw new ApiError(403, "No donor profile linked to this account");

  const donorId = auth.donorId;
  const [donor] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);
  if (!donor) throw new ApiError(404, "Donor not found");

  const [profile] = await db.select().from(donorProfiles).where(eq(donorProfiles.donorId, donorId)).limit(1);
  const [health] = await db.select().from(donorHealthRecords).where(eq(donorHealthRecords.donorId, donorId)).limit(1);
  const donationHistory = await db.select().from(donations).where(eq(donations.donorId, donorId)).orderBy(desc(donations.donationDate));
  const certificates = await db.select().from(donationCertificates).where(eq(donationCertificates.donorId, donorId)).orderBy(desc(donationCertificates.createdAt));
  const schedules = await db.select().from(donorSchedules).where(eq(donorSchedules.donorId, donorId)).orderBy(donorSchedules.scheduledDate);
  const availabilityHistory = await db.select().from(donorAvailability).where(eq(donorAvailability.donorId, donorId)).orderBy(desc(donorAvailability.confirmedAt)).limit(5);

  // Emergency request notifications addressed to this donor, joined with request info.
  const emergencyRows = await db.select({
    notification: requestNotifications,
    request: bloodRequests,
  })
    .from(requestNotifications)
    .leftJoin(bloodRequests, eq(requestNotifications.requestId, bloodRequests.id))
    .where(eq(requestNotifications.donorId, donorId))
    .orderBy(desc(requestNotifications.sentAt))
    .limit(20);

  const myNotifications = await db.select().from(notifications)
    .where(or(eq(notifications.donorId, donorId), eq(notifications.userId, auth.userId)))
    .orderBy(desc(notifications.sentAt)).limit(20);

  const unreadNotifications = myNotifications.filter((n) => !n.readAt).length;

  const scheduleItems = schedules.map((s) => ({ ...s, bucket: scheduleBucket(s.scheduledDate, s.status) }));
  const scheduleSummary = {
    today: scheduleItems.filter((s) => s.bucket === "TODAY").length,
    tomorrow: scheduleItems.filter((s) => s.bucket === "TOMORROW").length,
    thisWeek: scheduleItems.filter((s) => s.bucket === "THIS_WEEK").length,
    upcoming: scheduleItems.filter((s) => s.bucket === "UPCOMING").length,
    overdue: scheduleItems.filter((s) => s.bucket === "OVERDUE").length,
    completed: scheduleItems.filter((s) => s.bucket === "COMPLETED").length,
  };

  const certificateSummary = {
    total: certificates.length,
    pending: certificates.filter((c) => c.status === "PENDING").length,
    issued: certificates.filter((c) => c.status === "ISSUED" || c.status === "GENERATED").length,
    received: certificates.filter((c) => c.status === "RECEIVED").length,
    verified: certificates.filter((c) => c.status === "VERIFIED").length,
  };

  // Response stats feed the activity score narrative.
  const responseStats = await db.select({
    status: requestNotifications.status,
    count: sql<number>`count(*)`,
  }).from(requestNotifications).where(eq(requestNotifications.donorId, donorId)).groupBy(requestNotifications.status);

  return json({
    donor: {
      ...donor,
      age: computeAge(donor.dateOfBirth),
    },
    // MySQL returns JSON columns as strings — normalize arrays before sending.
    profile: profile
      ? {
        ...profile,
        badges: parseJsonArray<string>(profile.badges),
        milestones: parseJsonArray(profile.milestones),
        recognitionHistory: parseJsonArray(profile.recognitionHistory),
      }
      : null,
    health: health ?? null,
    stats: {
      profileCompletion: donor.profileCompletion,
      totalDonations: donor.totalDonations,
      activityScore: donor.activityScore,
      badges: parseJsonArray<string>(profile?.badges),
      unreadNotifications,
      pendingCertificates: certificateSummary.pending,
      receivedCertificates: certificateSummary.received,
    },
    eligibility: {
      status: donor.eligibilityStatus,
      nextEligibleDate: donor.nextEligibleDate,
      lastDonationDate: donor.lastDonationDate,
      donationType: donor.donationType,
    },
    availability: {
      status: donor.availabilityStatus,
      lastConfirmation: profile?.lastAvailabilityConfirmation ?? null,
      nextConfirmation: profile?.nextAvailabilityConfirmation ?? null,
      history: availabilityHistory,
    },
    donationHistory,
    certificates,
    certificateSummary,
    emergencyRequests: emergencyRows,
    notifications: myNotifications,
    schedules: scheduleItems,
    scheduleSummary,
    responseStats,
  });
}
