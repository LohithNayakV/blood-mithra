import { NextRequest } from "next/server";
import { db } from "@/db";
import {
  donors, volunteers, bloodRequests, donations, donationCertificates,
  bloodCamps, donorSchedules, followUps, hospitals, organizations, users, auditLogs,
} from "@/db/schema";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";
import { json, requireStaff, getAuthContext } from "@/lib/api";

export const dynamic = "force-dynamic";

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const startOfWeek = () => { const d = startOfToday(); d.setDate(d.getDate() - d.getDay()); return d; };
const startOfMonth = () => { const d = startOfToday(); d.setDate(1); return d; };

async function count(q: Promise<{ c: number }[]>) {
  const rows = await q;
  return rows[0]?.c ?? 0;
}

// GET /api/v1/admin — Project Control Dashboard summary.
// Answers from one place: donors, volunteers, requests, donations,
// certificates, schedules and camps.
export async function GET(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const sp = req.nextUrl.searchParams;
  const section = sp.get("section") || "all";

  const today = startOfToday();
  const week = startOfWeek();
  const month = startOfMonth();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const result: Record<string, unknown> = {};

  if (section === "all" || section === "donors") {
    result.donors = {
      total: await count(db.select({ c: sql<number>`count(*)` }).from(donors)),
      active: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(eq(donors.status, "ACTIVE"))),
      verified: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(eq(donors.isProfileVerified, true))),
      eligible: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(eq(donors.eligibilityStatus, "ELIGIBLE"))),
      temporarilyDeferred: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(eq(donors.eligibilityStatus, "TEMPORARILY_DEFERRED"))),
      healthReviewPending: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(eq(donors.healthStatus, "UNDER_REVIEW"))),
      inactive: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(eq(donors.status, "INACTIVE"))),
      newToday: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(gte(donors.registrationDate, today))),
      newThisWeek: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(gte(donors.registrationDate, week))),
      newThisMonth: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(gte(donors.registrationDate, month))),
      pendingVerification: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(eq(donors.isProfileVerified, false))),
      availableNow: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(eq(donors.availabilityStatus, "AVAILABLE"))),
      overdueConfirmation: await count(db.select({ c: sql<number>`count(*)` }).from(donors).where(and(eq(donors.availabilityStatus, "AVAILABLE"), lte(donors.updatedAt, thirtyDaysAgo)))),
      byBloodGroup: await db.select({ bloodGroup: donors.bloodGroup, count: sql<number>`count(*)` }).from(donors).groupBy(donors.bloodGroup),
      byDistrict: await db.select({ district: donors.addressDistrict, count: sql<number>`count(*)` }).from(donors).groupBy(donors.addressDistrict),
      recentlyDonated: await db.select({ id: donors.id, fullName: donors.fullName, bloodGroup: donors.bloodGroup, lastDonationDate: donors.lastDonationDate, nextEligibleDate: donors.nextEligibleDate, addressCity: donors.addressCity })
        .from(donors).where(eq(donors.status, "RECENTLY_DONATED")).orderBy(desc(donors.lastDonationDate)).limit(10),
      needAvailabilityConfirmation: await db.select({ id: donors.id, fullName: donors.fullName, bloodGroup: donors.bloodGroup, availabilityStatus: donors.availabilityStatus, updatedAt: donors.updatedAt, addressCity: donors.addressCity })
        .from(donors).where(and(eq(donors.availabilityStatus, "AVAILABLE"), lte(donors.updatedAt, thirtyDaysAgo))).limit(10),
    };
  }

  if (section === "all" || section === "volunteers") {
    result.volunteers = {
      total: await count(db.select({ c: sql<number>`count(*)` }).from(volunteers)),
      active: await count(db.select({ c: sql<number>`count(*)` }).from(volunteers).where(eq(volunteers.status, "ACTIVE"))),
      byDistrict: await db.select({ district: volunteers.district, count: sql<number>`count(*)` }).from(volunteers).groupBy(volunteers.district),
    };
  }

  if (section === "all" || section === "requests") {
    result.requests = {
      total: await count(db.select({ c: sql<number>`count(*)` }).from(bloodRequests)),
      emergency: await count(db.select({ c: sql<number>`count(*)` }).from(bloodRequests).where(eq(bloodRequests.urgency, "CRITICAL"))),
      high: await count(db.select({ c: sql<number>`count(*)` }).from(bloodRequests).where(eq(bloodRequests.urgency, "HIGH"))),
      pending: await count(db.select({ c: sql<number>`count(*)` }).from(bloodRequests).where(sql`status IN ('CREATED','VERIFICATION','DONORS_NOTIFIED','RESPONSES_CONFIRMED','CONFIRMED','COLLECTED')`)),
      fulfilled: await count(db.select({ c: sql<number>`count(*)` }).from(bloodRequests).where(eq(bloodRequests.status, "FULFILLED"))),
      open: await db.select().from(bloodRequests).where(sql`status NOT IN ('FULFILLED','CANCELLED')`).orderBy(desc(bloodRequests.createdAt)).limit(10),
    };
  }

  if (section === "all" || section === "donations") {
    result.donations = {
      total: await count(db.select({ c: sql<number>`count(*)` }).from(donations)),
      thisMonth: await count(db.select({ c: sql<number>`count(*)` }).from(donations).where(gte(donations.donationDate, month))),
      verified: await count(db.select({ c: sql<number>`count(*)` }).from(donations).where(eq(donations.verified, true))),
    };
    result.certificates = {
      total: await count(db.select({ c: sql<number>`count(*)` }).from(donationCertificates)),
      pending: await count(db.select({ c: sql<number>`count(*)` }).from(donationCertificates).where(eq(donationCertificates.status, "PENDING"))),
      generated: await count(db.select({ c: sql<number>`count(*)` }).from(donationCertificates).where(eq(donationCertificates.status, "GENERATED"))),
      issued: await count(db.select({ c: sql<number>`count(*)` }).from(donationCertificates).where(eq(donationCertificates.status, "ISSUED"))),
      received: await count(db.select({ c: sql<number>`count(*)` }).from(donationCertificates).where(eq(donationCertificates.status, "RECEIVED"))),
      verified: await count(db.select({ c: sql<number>`count(*)` }).from(donationCertificates).where(eq(donationCertificates.status, "VERIFIED"))),
    };
  }

  if (section === "all" || section === "schedule") {
    const now = new Date();
    const in7 = new Date(Date.now() + 7 * 86400000);
    result.schedule = {
      upcomingDonations: await db.select({ c: sql<number>`count(*)` }).from(donorSchedules).where(and(eq(donorSchedules.type, "DONATION"), eq(donorSchedules.status, "SCHEDULED"), lte(donorSchedules.scheduledDate, in7))),
      upcomingCamps: await db.select().from(bloodCamps).where(and(eq(bloodCamps.status, "UPCOMING"), gte(bloodCamps.startDate, now))).orderBy(bloodCamps.startDate).limit(10),
      overdueFollowUps: await count(db.select({ c: sql<number>`count(*)` }).from(followUps).where(and(eq(followUps.status, "PENDING"), lte(followUps.dueDate, now)))),
      pendingFollowUps: await count(db.select({ c: sql<number>`count(*)` }).from(followUps).where(eq(followUps.status, "PENDING"))),
    };
  }

  if (section === "all" || section === "ecosystem") {
    result.ecosystem = {
      hospitals: await count(db.select({ c: sql<number>`count(*)` }).from(hospitals)),
      organizations: await count(db.select({ c: sql<number>`count(*)` }).from(organizations)),
      staffUsers: await count(db.select({ c: sql<number>`count(*)` }).from(users).where(sql`role_id IS NOT NULL`)),
    };
  }

  if (section === "all" || section === "audit") {
    result.recentAudit = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(20);
  }

  return json(result);
}
