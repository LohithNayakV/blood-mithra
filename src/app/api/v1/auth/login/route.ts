import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, roles, donors, otpVerifications } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { comparePassword, signToken, generateOtp } from "@/lib/auth";
import { json, errorResponse, parseBody, checkRateLimit, getClientIp } from "@/lib/api";

export const dynamic = "force-dynamic";

// POST /api/v1/auth/login — password login by mobile or email.
// Unverified accounts are issued an OTP and must verify before getting a token.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`login:${ip}`, 20, 60_000)) {
    return errorResponse("Too many login attempts. Please try again later.", 429);
  }

  const body = await parseBody(req);
  const identifier = String(body.identifier ?? body.mobile ?? body.email ?? "").trim();
  const password = String(body.password ?? "");

  if (!identifier || !password) {
    return errorResponse("Mobile/email and password are required", 400);
  }

  const [row] = await db
    .select({
      user: users,
      roleName: roles.name,
    })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(or(eq(users.mobile, identifier), eq(users.email, identifier.toLowerCase())))
    .limit(1);

  // Use a generic error to avoid account enumeration.
  if (!row) return errorResponse("Invalid credentials", 401);
  const ok = await comparePassword(password, row.user.passwordHash);
  if (!ok) return errorResponse("Invalid credentials", 401);
  if (row.user.status !== "ACTIVE") return errorResponse("Your account has been deactivated. Contact support.", 403);

  const [donor] = row.user.id
    ? await db.select({ id: donors.id }).from(donors).where(eq(donors.userId, row.user.id)).limit(1)
    : [];

  if (!row.user.isVerified) {
    const otp = generateOtp();
    const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES ?? 10);
    await db.insert(otpVerifications).values({
      identifier: row.user.mobile ?? row.user.email ?? identifier,
      otp,
      purpose: "LOGIN",
      expiresAt: new Date(Date.now() + otpExpiryMinutes * 60_000),
    });
    return json({
      needsVerification: true,
      message: "Account not verified. An OTP has been sent to your mobile.",
      identifier: row.user.mobile ?? row.user.email,
      demoOtp: process.env.NODE_ENV === "production" ? undefined : otp,
    });
  }

  await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, row.user.id));

  const roleName = row.roleName ?? "DONOR";
  const token = await signToken({
    userId: row.user.id,
    role: roleName,
    donorId: donor?.id ?? null,
    mobile: row.user.mobile,
  });

  return json({
    message: "Login successful",
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
