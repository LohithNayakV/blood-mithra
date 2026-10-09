import { NextRequest } from "next/server";
import { db } from "@/db";
import { donors, volunteers, donationCertificates, donations, donorProfiles } from "@/db/schema";
import { and, eq, like, or, desc, asc, sql, gte, lte } from "drizzle-orm";
import { json, ApiError, parseBody, requireAdmin, requireStaff, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";
import { computeAge, computeDonorStatus } from "@/lib/eligibility";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/donors — Donor Management Dashboard table data.
// Searchable, filterable, sortable. Includes certificate status and
// assigned volunteer per donor.
export async function GET(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const sp = req.nextUrl.searchParams;

  const search = sp.get("search")?.trim() || null;
  const bloodGroup = sp.get("bloodGroup") || null;
  const city = sp.get("city") || null;
  const district = sp.get("district") || null;
  const status = sp.get("status") || null;
  const eligibility = sp.get("eligibility") || null;
  const health = sp.get("health") || null;
  const verification = sp.get("verification") || null;
  const registeredFrom = sp.get("registeredFrom") || null;
  const registeredTo = sp.get("registeredTo") || null;
  const sort = sp.get("sort") || "registrationDate";
  const order = sp.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 20)));

  const conditions = [];
  if (search) {
    conditions.push(or(
      like(donors.fullName, `%${search}%`),
      like(donors.mobile, `%${search}%`),
      like(donors.email, `%${search}%`),
      like(donors.addressCity, `%${search}%`),
    )!);
  }
  if (bloodGroup) conditions.push(eq(donors.bloodGroup, bloodGroup));
  if (city) conditions.push(like(donors.addressCity, `%${city}%`));
  if (district) conditions.push(like(donors.addressDistrict, `%${district}%`));
  if (status) conditions.push(eq(donors.status, status));
  if (eligibility) conditions.push(eq(donors.eligibilityStatus, eligibility));
  if (health) conditions.push(eq(donors.healthStatus, health));
  if (verification === "verified") conditions.push(eq(donors.isProfileVerified, true));
  if (verification === "unverified") conditions.push(eq(donors.isProfileVerified, false));
  if (registeredFrom) conditions.push(gte(donors.registrationDate, new Date(registeredFrom)));
  if (registeredTo) conditions.push(lte(donors.registrationDate, new Date(registeredTo)));

  const where = conditions.length ? and(...conditions) : undefined;

  const sortColumn = {
    name: donors.fullName,
    registrationDate: donors.registrationDate,
    lastDonation: donors.lastDonationDate,
    nextEligible: donors.nextEligibleDate,
    totalDonations: donors.totalDonations,
    activity: donors.activityScore,
    city: donors.addressCity,
  }[sort] ?? donors.registrationDate;
  const orderBy = order === "asc" ? asc(sortColumn) : desc(sortColumn);

  const totalRow = await db.select({ c: sql<number>`count(*)` }).from(donors).where(where);
  const total = totalRow[0]?.c ?? 0;

  const rows = await db.select({
    donor: donors,
    volunteerName: volunteers.name,
    lastCertificateStatus: donationCertificates.status,
  })
    .from(donors)
    .leftJoin(volunteers, eq(donors.assignedVolunteerId, volunteers.id))
    .leftJoin(donationCertificates, eq(donationCertificates.donorId, donors.id))
    .where(where)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Latest certificate status per donor (the join above may produce multiple rows).
  const latestCert = new Map<number, string>();
  for (const r of rows) {
    if (r.lastCertificateStatus && !latestCert.has(r.donor.id)) {
      latestCert.set(r.donor.id, r.lastCertificateStatus);
    }
  }

  const data = rows.map((r) => ({
    id: r.donor.id,
    fullName: r.donor.fullName,
    mobile: r.donor.mobile,
    email: r.donor.email,
    bloodGroup: r.donor.bloodGroup,
    age: computeAge(r.donor.dateOfBirth),
    city: r.donor.addressCity,
    district: r.donor.addressDistrict,
    registrationDate: r.donor.registrationDate,
    isProfileVerified: r.donor.isProfileVerified,
    isMobileVerified: r.donor.isMobileVerified,
    healthStatus: r.donor.healthStatus,
    eligibilityStatus: r.donor.eligibilityStatus,
    status: r.donor.status,
    availabilityStatus: r.donor.availabilityStatus,
    lastDonationDate: r.donor.lastDonationDate,
    nextEligibleDate: r.donor.nextEligibleDate,
    totalDonations: r.donor.totalDonations,
    activityScore: r.donor.activityScore,
    certificateStatus: latestCert.get(r.donor.id) ?? null,
    assignedVolunteer: r.volunteerName ?? null,
  }));

  return json({ data, total, page, pageSize });
}

// PATCH /api/v1/admin/donors — admin actions: verify, change status,
// review health, assign volunteer, schedule follow-up.
export async function PATCH(req: NextRequest) {
  const auth = requireAdmin(await getAuthContext(req));
  const body = await parseBody(req);
  const donorId = Number(body.donorId);
  if (!Number.isInteger(donorId)) throw new ApiError(400, "donorId is required");

  const [donor] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);
  if (!donor) throw new ApiError(404, "Donor not found");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const action = String(body.action ?? "");

  const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
  switch (action) {
    case "verify":
      updates.isProfileVerified = true;
      break;
    case "unverify":
      updates.isProfileVerified = false;
      break;
    case "status":
      updates.status = String(body.status ?? "").toUpperCase();
      break;
    case "health":
      updates.healthStatus = String(body.healthStatus ?? "").toUpperCase();
      updates.eligibilityStatus = String(body.eligibilityStatus ?? donor.eligibilityStatus).toUpperCase();
      break;
    case "assign_volunteer":
      updates.assignedVolunteerId = body.volunteerId ? Number(body.volunteerId) : null;
      break;
    case "edit":
    default:
      if (body.fullName !== undefined) {
        const v = String(body.fullName ?? "").trim();
        if (!v || v.length < 3) throw new ApiError(400, "Donor name must be at least 3 characters");
        updates.fullName = v;
      }
      if (body.mobile !== undefined) {
        const v = String(body.mobile ?? "").trim();
        if (!/^[6-9]\d{9}$/.test(v)) throw new ApiError(400, "Invalid donor mobile number");
        updates.mobile = v;
      }
      if (body.email !== undefined) updates.email = body.email ? String(body.email) : null;
      if (body.bloodGroup !== undefined) {
        const v = String(body.bloodGroup ?? "").toUpperCase();
        if (!BLOOD_GROUPS.includes(v)) throw new ApiError(400, "Invalid blood group");
        updates.bloodGroup = v;
      }
      if (body.city !== undefined) updates.addressCity = body.city ? String(body.city) : null;
      if (body.district !== undefined) updates.addressDistrict = body.district ? String(body.district) : null;
      if (body.availabilityStatus !== undefined) updates.availabilityStatus = String(body.availabilityStatus).toUpperCase();
      if (body.eligibilityStatus !== undefined) updates.eligibilityStatus = String(body.eligibilityStatus).toUpperCase();
      if (body.status) updates.status = String(body.status).toUpperCase();
      if (body.healthStatus) updates.healthStatus = String(body.healthStatus).toUpperCase();
      if (body.isProfileVerified !== undefined) updates.isProfileVerified = Boolean(body.isProfileVerified);
      if (body.volunteerId !== undefined) updates.assignedVolunteerId = body.volunteerId ? Number(body.volunteerId) : null;
  }

  // Recompute derived status after admin changes.
  const merged = { ...donor, ...updates } as typeof donor;
  updates.status = computeDonorStatus({
    isProfileVerified: merged.isProfileVerified,
    totalDonations: merged.totalDonations,
    daysSinceRegistration: Math.floor((Date.now() - new Date(merged.registrationDate).getTime()) / 86400000),
    lastDonationDate: merged.lastDonationDate,
    nextEligibleDate: merged.nextEligibleDate,
    healthStatus: merged.healthStatus,
    availabilityStatus: merged.availabilityStatus,
    donationType: merged.donationType,
    gender: merged.gender,
  });

  await db.update(donors).set(updates).where(eq(donors.id, donorId));
  // MySQL doesn't support returning(), fetch the updated donor
  const [updated] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);

  await writeAuditLog({
    userId: auth.userId, action: `ADMIN_DONOR_${action || "UPDATE"}`, entityType: "donors",
    entityId: donorId, details: { changes: updates }, ipAddress: getClientIp(req),
  });

  return json({ message: "Donor updated", donor: updated });
}

// GET /api/v1/admin/donors/export — CSV export of the donor report.
export async function PUT(req: NextRequest) {
  requireStaff(await getAuthContext(req));
  const rows = await db.select({
    donor: donors,
    profile: donorProfiles,
    latestDonation: donations.donationDate,
  })
    .from(donors)
    .leftJoin(donorProfiles, eq(donorProfiles.donorId, donors.id))
    .leftJoin(donations, eq(donations.donorId, donors.id))
    .orderBy(desc(donors.registrationDate))
    .limit(5000);

  const header = ["Donor ID", "Name", "Mobile", "Blood Group", "Age", "City", "District", "Status", "Eligibility", "Health", "Total Donations", "Last Donation", "Next Eligible", "Registered"];
  const lines = rows.map((r) => [
    r.donor.id, r.donor.fullName, r.donor.mobile, r.donor.bloodGroup,
    computeAge(r.donor.dateOfBirth) ?? "", r.donor.addressCity ?? "", r.donor.addressDistrict ?? "",
    r.donor.status, r.donor.eligibilityStatus, r.donor.healthStatus,
    r.donor.totalDonations, r.donor.lastDonationDate ?? "", r.donor.nextEligibleDate ?? "",
    r.donor.registrationDate.toISOString().slice(0, 10),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

  return new Response([header.join(","), ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=blood-mithra-donors.csv",
    },
  });
}

// DELETE /api/v1/admin/donors — remove a donor (admin only, cascades).
export async function DELETE(req: NextRequest) {
  const auth = requireAdmin(await getAuthContext(req));
  let donorId: number | null = null;
  try {
    const body = await parseBody(req);
    if (body.donorId !== undefined) donorId = Number(body.donorId);
    else if (body.id !== undefined) donorId = Number(body.id);
  } catch {
    // fall through
  }
  if (donorId === null || !Number.isInteger(donorId)) {
    const qp = req.nextUrl.searchParams.get("donorId") ?? req.nextUrl.searchParams.get("id");
    if (qp) donorId = Number(qp);
  }
  if (donorId === null || !Number.isInteger(donorId)) throw new ApiError(400, "donorId is required");
  const [existing] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);
  if (!existing) throw new ApiError(404, "Donor not found");
  await db.delete(donors).where(eq(donors.id, donorId));
  await writeAuditLog({
    userId: auth.userId, action: "ADMIN_DONOR_DELETED", entityType: "donors",
    entityId: donorId, details: { name: existing.fullName }, ipAddress: getClientIp(req),
  });
  return json({ message: "Donor deleted", donor: { id: existing.id } });
}
