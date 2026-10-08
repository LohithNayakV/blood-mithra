import { NextRequest } from "next/server";
import { db } from "@/db";
import { donors, donorHealthRecords, donorHealthHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { json, ApiError, parseBody, requireAuth, requireHealthAccess, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";

export const dynamic = "force-dynamic";

const HEALTH_STATUSES = ["HEALTHY", "TEMPORARY_DEFERRAL", "UNDER_REVIEW", "INELIGIBLE"];
const SCREENING_STATUSES = ["PENDING", "UNDER_REVIEW", "CLEARED", "DEFERRED"];

function getDonorIdFromBody(body: Record<string, unknown>): number {
  const donorId = Number(body.donorId);
  if (!Number.isInteger(donorId)) throw new ApiError(400, "donorId is required");
  return donorId;
}

// GET /api/v1/donors/health?donorId= — private health record.
// Restricted to authorized roles (health information is never public).
export async function GET(req: NextRequest) {
  requireHealthAccess(await getAuthContext(req));
  const donorId = Number(req.nextUrl.searchParams.get("donorId"));
  if (!Number.isInteger(donorId)) throw new ApiError(400, "donorId is required");

  const [record] = await db.select().from(donorHealthRecords).where(eq(donorHealthRecords.donorId, donorId)).limit(1);
  const history = await db.select().from(donorHealthHistory).where(eq(donorHealthHistory.donorId, donorId)).orderBy(desc(donorHealthHistory.createdAt));
  return json({ record: record ?? null, history });
}

// POST /api/v1/donors/health — donor submits/updates their health declaration.
// Upsert semantics: creates the record on first submission.
export async function POST(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const body = await parseBody(req);
  const donorId = getDonorIdFromBody(body);

  // Donors may only update their own health record; authorized staff may update any.
  const [donor] = await db.select().from(donors).where(eq(donors.id, donorId)).limit(1);
  if (!donor) throw new ApiError(404, "Donor not found");
  const isOwner = donor.userId === auth.userId;
  const isStaff = (() => { try { requireHealthAccess(auth); return true; } catch { return false; } })();
  if (!isOwner && !isStaff) throw new ApiError(403, "Not authorized to update this health record");

  const healthStatus = String(body.healthStatus ?? "HEALTHY").toUpperCase();
  if (!HEALTH_STATUSES.includes(healthStatus)) throw new ApiError(400, "Invalid health status");

  const values = {
    donorId,
    healthStatus,
    recentIllness: body.recentIllness ? String(body.recentIllness) : null,
    currentMedications: body.currentMedications ? String(body.currentMedications) : null,
    surgeries: body.surgeries ? String(body.surgeries) : null,
    hospitalizations: body.hospitalizations ? String(body.hospitalizations) : null,
    existingConditions: body.existingConditions ? String(body.existingConditions) : null,
    recentFever: Boolean(body.recentFever),
    recentVaccination: Boolean(body.recentVaccination),
    pregnancyRelated: body.pregnancyRelated ? String(body.pregnancyRelated) : null,
    weight: body.weight ? String(body.weight) : null,
    lastHealthConfirmation: new Date(),
    healthDeclaration: body.healthDeclaration === true || body.healthDeclaration === "true",
    screeningStatus: String(body.screeningStatus ?? "PENDING").toUpperCase(),
    eligibilityRemarks: body.eligibilityRemarks ? String(body.eligibilityRemarks) : null,
    nextReviewDate: body.nextReviewDate ? String(body.nextReviewDate) : null,
    updatedAt: new Date(),
  };
  if (!SCREENING_STATUSES.includes(values.screeningStatus)) throw new ApiError(400, "Invalid screening status");

  const [existing] = await db.select().from(donorHealthRecords).where(eq(donorHealthRecords.donorId, donorId)).limit(1);

  let record;
  if (existing) {
    await db.update(donorHealthRecords).set({
      ...values,
      nextReviewDate: values.nextReviewDate ? new Date(values.nextReviewDate) : null,
    }).where(eq(donorHealthRecords.id, existing.id));
    const [r] = await db.select().from(donorHealthRecords).where(eq(donorHealthRecords.id, existing.id)).limit(1);
    record = r;
  } else {
    await db.insert(donorHealthRecords).values({
      ...values,
      nextReviewDate: values.nextReviewDate ? new Date(values.nextReviewDate) : null,
    });
    const [r] = await db.select().from(donorHealthRecords).where(eq(donorHealthRecords.donorId, donorId)).limit(1);
    record = r;
  }

  // Maintain the health declaration history.
  await db.insert(donorHealthHistory).values({
    donorId,
    healthRecordId: record.id,
    status: healthStatus,
    remarks: String(body.eligibilityRemarks ?? "Health declaration submitted"),
    recordedBy: auth.userId,
  });

  // Mirror health status onto the donor row and derive eligibility.
  const eligibilityStatus = healthStatus === "INELIGIBLE" || healthStatus === "TEMPORARY_DEFERRAL"
    ? "TEMPORARILY_DEFERRED"
    : healthStatus === "UNDER_REVIEW"
      ? "UNDER_REVIEW"
      : "ELIGIBLE";
  await db.update(donors).set({
    healthStatus,
    eligibilityStatus,
    updatedAt: new Date(),
  }).where(eq(donors.id, donorId));

  if (isStaff && !isOwner) {
    await writeAuditLog({
      userId: auth.userId, action: "HEALTH_RECORD_UPDATED", entityType: "donor_health_records",
      entityId: record.id, details: { healthStatus, screeningStatus: values.screeningStatus },
      ipAddress: getClientIp(req),
    });
  }

  return json({ message: "Health record saved", record, eligibilityStatus });
}
