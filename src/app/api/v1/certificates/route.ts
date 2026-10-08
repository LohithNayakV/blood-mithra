import { NextRequest } from "next/server";
import { db } from "@/db";
import { donationCertificates, donations, donors } from "@/db/schema";
import { eq, desc, like, or, and, sql } from "drizzle-orm";
import { json, ApiError, parseBody, requireAuth, requireStaff, getAuthContext, writeAuditLog, getClientIp } from "@/lib/api";

export const dynamic = "force-dynamic";

const CERT_STATUSES = ["PENDING", "GENERATED", "ISSUED", "RECEIVED", "VERIFIED"];

// GET /api/v1/certificates?donorId=&status=&search= — certificate tracking.
// Donors see only their own certificates; staff see all.
export async function GET(req: NextRequest) {
  const auth = requireAuth(await getAuthContext(req));
  const sp = req.nextUrl.searchParams;
  const isStaff = (() => { try { requireStaff(auth); return true; } catch { return false; } })();

  const donorIdParam = sp.get("donorId") ? Number(sp.get("donorId")) : null;
  const status = sp.get("status")?.toUpperCase() || null;
  const search = sp.get("search")?.trim() || null;

  if (!isStaff) {
    if (!auth.donorId) throw new ApiError(403, "No donor profile linked to this account");
    const rows = await db.select().from(donationCertificates)
      .where(eq(donationCertificates.donorId, auth.donorId))
      .orderBy(desc(donationCertificates.createdAt));
    return json({ data: rows, total: rows.length });
  }

  const conditions = [];
  if (donorIdParam) conditions.push(eq(donationCertificates.donorId, donorIdParam));
  if (status) {
    if (!CERT_STATUSES.includes(status)) throw new ApiError(400, "Invalid certificate status");
    conditions.push(eq(donationCertificates.status, status));
  }
  if (search) {
    conditions.push(or(
      like(donationCertificates.certificateNumber, `%${search}%`),
      like(donors.fullName, `%${search}%`),
    )!);
  }

  const rows = await db.select({
    certificate: donationCertificates,
    donorName: donors.fullName,
    donorBloodGroup: donors.bloodGroup,
    donationDate: donations.donationDate,
  })
    .from(donationCertificates)
    .leftJoin(donors, eq(donationCertificates.donorId, donors.id))
    .leftJoin(donations, eq(donationCertificates.donationId, donations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(donationCertificates.createdAt))
    .limit(200);

  const totals = await db.select({
    status: donationCertificates.status,
    count: sql<number>`count(*)`,
  })
    .from(donationCertificates)
    .groupBy(donationCertificates.status);

  return json({ data: rows, total: rows.length, totals });
}

// PATCH /api/v1/certificates — advance certificate lifecycle:
// PENDING → GENERATED → ISSUED → RECEIVED → VERIFIED.
export async function PATCH(req: NextRequest) {
  const auth = requireStaff(await getAuthContext(req));
  const body = await parseBody(req);
  const id = Number(body.id);
  const status = String(body.status ?? "").toUpperCase();
  if (!Number.isInteger(id) || !CERT_STATUSES.includes(status)) {
    throw new ApiError(400, "id and a valid status (PENDING|GENERATED|ISSUED|RECEIVED|VERIFIED) are required");
  }

  const updates: Record<string, unknown> = { status, updatedAt: new Date() };
  const today = new Date().toISOString().slice(0, 10);
  if (status === "GENERATED" || status === "ISSUED") updates.issuedDate = today;
  if (status === "RECEIVED") updates.receivedDate = today;
  if (status === "VERIFIED") updates.verifiedDate = today;
  if (status === "ISSUED" || status === "GENERATED") updates.issuedBy = auth.userId;

  await db.update(donationCertificates).set(updates).where(eq(donationCertificates.id, id));
  // MySQL doesn't support returning(), fetch the updated certificate
  const [updated] = await db.select().from(donationCertificates).where(eq(donationCertificates.id, id)).limit(1);
  if (!updated) throw new ApiError(404, "Certificate not found");

  await writeAuditLog({
    userId: auth.userId, action: "CERTIFICATE_STATUS_CHANGED", entityType: "donation_certificates",
    entityId: id, details: { status }, ipAddress: getClientIp(req),
  });

  return json({ message: `Certificate marked as ${status}`, certificate: updated });
}
