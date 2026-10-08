import { NextRequest } from "next/server";
import { db } from "@/db";
import { donors, donations, bloodRequests, volunteers, bloodCamps, users, systemSettings } from "@/db/schema";
import { sql, eq, gte, and, desc } from "drizzle-orm";
import { json, requireStaff, getAuthContext } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/v1/reports?type=... — Project Overview Analytics.
// Types: growth | bloodGroups | districts | activity | donations | overview
export async function GET(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const type = req.nextUrl.searchParams.get("type") ?? "overview";

  switch (type) {
    case "growth": {
      // Donor growth: daily (30d), weekly (12w), monthly (12m), yearly.
      const daily = await db.select({
        bucket: sql<string>`DATE(registration_date)`,
        count: sql<number>`count(*)`,
      }).from(donors).where(gte(donors.registrationDate, new Date(Date.now() - 30 * 86400000))).groupBy(sql`DATE(registration_date)`).orderBy(sql`DATE(registration_date)`);
      const weekly = await db.select({
        bucket: sql<string>`DATE(registration_date)`,
        count: sql<number>`count(*)`,
      }).from(donors).where(gte(donors.registrationDate, new Date(Date.now() - 12 * 7 * 86400000))).groupBy(sql`DATE(registration_date)`).orderBy(sql`DATE(registration_date)`);
      const monthly = await db.select({
        bucket: sql<string>`DATE_FORMAT(registration_date, '%Y-%m-01')`,
        count: sql<number>`count(*)`,
      }).from(donors).where(gte(donors.registrationDate, new Date(Date.now() - 12 * 30 * 86400000))).groupBy(sql`DATE_FORMAT(registration_date, '%Y-%m-01')`);
      const yearly = await db.select({
        bucket: sql<string>`YEAR(registration_date)`,
        count: sql<number>`count(*)`,
      }).from(donors).groupBy(sql`YEAR(registration_date)`);
      return json({ daily, weekly, monthly, yearly });
    }

    case "bloodGroups": {
      const rows = await db.select({
        bloodGroup: donors.bloodGroup,
        total: sql<number>`count(*)`,
        active: sql<number>`count(case when status in ('ACTIVE','VERIFIED','REGULAR_DONOR') then 1 end)`,
        eligible: sql<number>`count(case when eligibility_status = 'ELIGIBLE' then 1 end)`,
      }).from(donors).groupBy(donors.bloodGroup);
      const order = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
      rows.sort((a, b) => order.indexOf(a.bloodGroup) - order.indexOf(b.bloodGroup));
      return json({ data: rows });
    }

    case "districts": {
      const donorRows = await db.select({
        district: donors.addressDistrict,
        donors: sql<number>`count(*)`,
        active: sql<number>`count(case when status in ('ACTIVE','VERIFIED','REGULAR_DONOR') then 1 end)`,
      }).from(donors).groupBy(donors.addressDistrict);
      const volunteerRows = await db.select({
        district: volunteers.district,
        volunteers: sql<number>`count(*)`,
      }).from(volunteers).groupBy(volunteers.district);
      const vMap = new Map(volunteerRows.map((r) => [r.district, r.volunteers]));
      const data = donorRows
        .filter((r) => r.district)
        .map((r) => ({ district: r.district, donors: r.donors, active: r.active, volunteers: vMap.get(r.district) ?? 0 }))
        .sort((a, b) => b.donors - a.donors);
      return json({ data });
    }

    case "activity": {
      const byStatus = await db.select({
        status: donors.status,
        count: sql<number>`count(*)`,
      }).from(donors).groupBy(donors.status);
      const byEligibility = await db.select({
        status: donors.eligibilityStatus,
        count: sql<number>`count(*)`,
      }).from(donors).groupBy(donors.eligibilityStatus);
      const byHealth = await db.select({
        status: donors.healthStatus,
        count: sql<number>`count(*)`,
      }).from(donors).groupBy(donors.healthStatus);
      const total = byStatus.reduce((s, r) => s + r.count, 0) || 1;
      const activePct = Math.round(
        (byStatus.filter((r) => ["ACTIVE", "VERIFIED", "REGULAR_DONOR"].includes(r.status)).reduce((s, r) => s + r.count, 0) / total) * 100,
      );
      return json({ byStatus, byEligibility, byHealth, total, activePct });
    }

    case "donations": {
      const total = await db.select({ c: sql<number>`count(*)` }).from(donations);
      const monthly = await db.select({
        bucket: sql<string>`DATE_FORMAT(donation_date, '%Y-%m-01')`,
        count: sql<number>`count(*)`,
      }).from(donations).where(gte(donations.donationDate, new Date(Date.now() - 12 * 30 * 86400000))).groupBy(sql`DATE_FORMAT(donation_date, '%Y-%m-01')`);
      const byCamp = await db.select({
        campId: donations.campId,
        campName: bloodCamps.name,
        count: sql<number>`count(*)`,
      }).from(donations).leftJoin(bloodCamps, eq(donations.campId, bloodCamps.id)).groupBy(donations.campId, bloodCamps.name);
      const recent = await db.select().from(donations).orderBy(desc(donations.donationDate)).limit(10);
      return json({ total: total[0]?.c ?? 0, monthly, byCamp, recent });
    }

    case "requests": {
      const byStatus = await db.select({
        status: bloodRequests.status,
        count: sql<number>`count(*)`,
      }).from(bloodRequests).groupBy(bloodRequests.status);
      const byUrgency = await db.select({
        urgency: bloodRequests.urgency,
        count: sql<number>`count(*)`,
      }).from(bloodRequests).groupBy(bloodRequests.urgency);
      const byBloodGroup = await db.select({
        bloodGroup: bloodRequests.bloodGroup,
        count: sql<number>`count(*)`,
      }).from(bloodRequests).groupBy(bloodRequests.bloodGroup);
      return json({ byStatus, byUrgency, byBloodGroup });
    }

    case "overview":
    default: {
      const [donorTotal] = await db.select({ c: sql<number>`count(*)` }).from(donors);
      const [donationTotal] = await db.select({ c: sql<number>`count(*)` }).from(donations);
      const [requestTotal] = await db.select({ c: sql<number>`count(*)` }).from(bloodRequests);
      const [fulfilled] = await db.select({ c: sql<number>`count(*)` }).from(bloodRequests).where(eq(bloodRequests.status, "FULFILLED"));
      const [volunteerTotal] = await db.select({ c: sql<number>`count(*)` }).from(volunteers);
      const settings = await db.select().from(systemSettings);
      const kpis = [
        { label: "Registered Donors", value: donorTotal.c, icon: "🩸" },
        { label: "Total Donations", value: donationTotal.c, icon: "💉" },
        { label: "Blood Requests", value: requestTotal.c, icon: "🚨" },
        { label: "Fulfilled Requests", value: fulfilled.c, icon: "✅" },
        { label: "Active Volunteers", value: volunteerTotal.c, icon: "🙋" },
      ];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const growth = await db.select({
        bucket: sql<string>`DATE(registration_date)`,
        count: sql<number>`count(*)`,
      }).from(donors).where(gte(donors.registrationDate, thirtyDaysAgo)).groupBy(sql`DATE(registration_date)`);
      return json({ kpis, growth, settings: settings.length });
    }
  }
}
