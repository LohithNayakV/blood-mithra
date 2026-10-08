import { NextRequest } from "next/server";
import { db } from "@/db";
import { donors, donorProfiles, donorHealthRecords, donations, donationCertificates, donorAvailability, donorSchedules, requestNotifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { json, ApiError, requireAuth, requireStaff, maskPhone, canViewFullContact, parseBody, writeAuditLog, getClientIp, getAuthContext } from "@/lib/api";
import { computeAge, computeDonorStatus } from "@/lib/eligibility";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadDonor(id: number) {
  const [donor] = await db.select().from(donors).where(eq(donors.id, id)).limit(1);
  return donor ?? null;
}

// GET /api/v1/donors/:id — full donor profile (contact masked for public viewers).
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const donorId = Number(id);
  if (!Number.isInteger(donorId)) throw new ApiError(400, "Invalid donor id");

  const auth = requireAuth(await getAuthContext(req));
  const donor = await loadDonor(donorId);
  if (!donor) throw new ApiError(404, "Donor not found");

  const [profile] = await db.select().from(donorProfiles).where(eq(donorProfiles.donorId, donorId)).limit(1);
  const [health] = await db.select().from(donorHealthRecords).where(eq(donorHealthRecords.donorId, donorId)).limit(1);
  const donationHistory = await db.select().from(donations).where(eq(donations.donorId, donorId)).orderBy(desc(donations.donationDate));
  const certificates = await db.select().from(donationCertificates).where(eq(donationCertificates.donorId, donorId)).orderBy(desc(donationCertificates.createdAt));
  const availabilityHistory = await db.select().from(donorAvailability).where(eq(donorAvailability.donorId, donorId)).orderBy(desc(donorAvailability.confirmedAt)).limit(10);
  const schedules = await db.select().from(donorSchedules).where(eq(donorSchedules.donorId, donorId)).orderBy(donorSchedules.scheduledDate);
  const requestResponses = await db.select().from(requestNotifications).where(eq(requestNotifications.donorId, donorId)).orderBy(desc(requestNotifications.sentAt)).limit(20);

  const showContact = canViewFullContact(auth, donor.userId);
  const isStaff = (() => { try { requireStaff(auth); return true; } catch { return false; } })();

  return json({
    donor: {
      ...donor,
      age: computeAge(donor.dateOfBirth),
      mobile: showContact ? donor.mobile : maskPhone(donor.mobile),
      email: showContact ? donor.email : null,
    },
    profile: profile ?? null,
    // Health information is private — only authorized roles may view it.
    health: isStaff ? health ?? null : null,
    donationHistory,
    certificates,
    availabilityHistory,
    schedules,
    requestResponses,
  });
}

// PATCH /api/v1/donors/:id — update donor profile fields.
// Donors can update their own profile; staff can update any donor.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const donorId = Number(id);
  if (!Number.isInteger(donorId)) throw new ApiError(400, "Invalid donor id");

  const auth = requireAuth(await getAuthContext(req));
  const donor = await loadDonor(donorId);
  if (!donor) throw new ApiError(404, "Donor not found");

  const isOwner = donor.userId === auth.userId;
  const isStaff = (() => { try { requireStaff(auth); return true; } catch { return false; } })();
  if (!isOwner && !isStaff) throw new ApiError(403, "You can only update your own profile");

  const body = await parseBody(req);
  const allowed: Record<string, string> = {
    fullName: "fullName", email: "email", dateOfBirth: "dateOfBirth", gender: "gender",
    weight: "weight", addressCity: "addressCity", addressDistrict: "addressDistrict",
    addressState: "addressState", pincode: "pincode", latitude: "latitude", longitude: "longitude",
    preferredRadiusKm: "preferredRadiusKm", preferredContact: "preferredContact",
    emergencyNotifications: "emergencyNotifications", donationType: "donationType",
  };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [bodyKey, col] of Object.entries(allowed)) {
    if (body[bodyKey] !== undefined) updates[col] = body[bodyKey];
  }

  // Staff-only administrative fields.
  if (isStaff) {
    for (const col of ["status", "eligibilityStatus", "healthStatus", "isProfileVerified", "isMobileVerified", "assignedVolunteerId"]) {
      if (body[col] !== undefined) updates[col] = body[col];
    }
  }

  // Recompute derived fields when relevant inputs change.
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

  // Profile completion percentage.
  const fields = [merged.fullName, merged.mobile, merged.email, merged.dateOfBirth, merged.gender, merged.bloodGroup, merged.weight, merged.addressCity, merged.addressDistrict, merged.pincode, merged.latitude, merged.longitude];
  updates.profileCompletion = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  await db.update(donors).set(updates).where(eq(donors.id, donorId));
  // MySQL doesn't support returning(), fetch the updated donor
  const [updated] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);

  if (isStaff && !isOwner) {
    await writeAuditLog({
      userId: auth.userId, action: "DONOR_UPDATED", entityType: "donors", entityId: donorId,
      details: { changes: Object.keys(updates) }, ipAddress: getClientIp(req),
    });
  }

  return json({ message: "Donor profile updated", donor: updated });
}
