import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, roles, donors, otpVerifications } from "@/db/schema";
import { eq, or, and, gt, desc } from "drizzle-orm";
import { signToken } from "@/lib/auth";
import { json, errorResponse, parseBody, ApiError, checkRateLimit, getClientIp } from "@/lib/api";

export const dynamic = "force-dynamic";

// POST /api/v1/auth/verify-otp — verify the OTP sent to a mobile/email.
// On success the account is marked verified and a session token is issued.
export async function POST(req: NextRequest) {
  try {
    return await verifyOtpHandler(req);
  } catch (err) {
    // Surface validation errors as JSON so the form can display them.
    if (err instanceof ApiError) return errorResponse(err.message, err.status);
    console.error("[api] verify-otp failed:", err);
    return errorResponse("Verification failed. Please try again.", 500);
  }
}

async function verifyOtpHandler(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`otp:${ip}`, 20, 60_000)) {
    return errorResponse("Too many attempts. Please try again later.", 429);
  }

  const body = await parseBody(req);
  const identifier = String(body.identifier ?? "").trim();
  const otp = String(body.otp ?? "").trim();
  if (!identifier || !/^[0-9]{6}$/.test(otp)) {
    throw new ApiError(400, "Identifier and a 6-digit OTP are required");
  }

  const [record] = await db
    .select()
    .from(otpVerifications)
    .where(and(
      eq(otpVerifications.identifier, identifier),
      eq(otpVerifications.otp, otp),
      eq(otpVerifications.verified, false),
      gt(otpVerifications.expiresAt, new Date()),
    ))
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  if (!record) {
    // Increment attempts on the latest record for this identifier (anti-bruteforce).
    const [latest] = await db
      .select()
      .from(otpVerifications)
      .where(eq(otpVerifications.identifier, identifier))
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);
    if (latest) {
      await db.update(otpVerifications)
        .set({ attempts: latest.attempts + 1 })
        .where(eq(otpVerifications.id, latest.id));
    }
    return errorResponse("Invalid or expired OTP. Please request a new one.", 400);
  }

  await db.update(otpVerifications).set({ verified: true }).where(eq(otpVerifications.id, record.id));

  const [row] = await db
    .select({ user: users, roleName: roles.name })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(or(eq(users.mobile, identifier), eq(users.email, identifier.toLowerCase())))
    .limit(1);

  if (!row) return errorResponse("No account found for this identifier", 404);

  await db.update(users).set({ isVerified: true, status: "ACTIVE" }).where(eq(users.id, row.user.id));
  const [donor] = await db.select().from(donors).where(eq(donors.userId, row.user.id)).limit(1);
  if (donor) {
    await db.update(donors).set({ isMobileVerified: true }).where(eq(donors.id, donor.id));
  }

  const roleName = row.roleName ?? "DONOR";
  const token = await signToken({
    userId: row.user.id,
    role: roleName,
    donorId: donor?.id ?? null,
    mobile: row.user.mobile,
  });

  return json({
    message: "Mobile number verified successfully",
    token,
    user: {
      id: row.user.id,
      fullName: row.user.fullName,
      mobile: row.user.mobile,
      email: row.user.email,
      role: roleName,
      donorId: donor?.id ?? null,
    },
  });
}
