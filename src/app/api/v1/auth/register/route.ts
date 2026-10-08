import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, roles, userRoles, donors, donorProfiles, donorHealthRecords, donorHealthHistory, donorSchedules, consents, otpVerifications } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { hashPassword, signToken, generateOtp } from "@/lib/auth";
import { json, errorResponse, parseBody, ApiError, checkRateLimit, getClientIp } from "@/lib/api";
import { computeNextEligibleDate } from "@/lib/eligibility";

export const dynamic = "force-dynamic";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

// POST /api/v1/auth/register — donor self-registration.
// Creates the user account, donor record, profile, baseline health record,
// consent record and a mobile OTP. Returns a session token immediately;
// the OTP must still be verified to unlock full verification status.
export async function POST(req: NextRequest) {
  try {
    return await registerHandler(req);
  } catch (err) {
    // Validation errors must reach the frontend as JSON (not a bare 500),
    // so the form can show exactly what needs fixing.
    if (err instanceof ApiError) return errorResponse(err.message, err.status);
    console.error("[api] register failed:", err);
    return errorResponse("Registration failed. Please try again.", 500);
  }
}

async function registerHandler(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`register:${ip}`, 10, 60_000)) {
    return errorResponse("Too many registration attempts. Please try again later.", 429);
  }

  const body = await parseBody(req);
  const fullName = String(body.fullName ?? "").trim();
  const mobile = String(body.mobile ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  const password = String(body.password ?? "");
  const bloodGroup = String(body.bloodGroup ?? "").trim().toUpperCase();
  const dateOfBirth = String(body.dateOfBirth ?? "") || null;
  const gender = String(body.gender ?? "").trim().toUpperCase() || null;
  const city = String(body.city ?? "").trim() || null;
  const district = String(body.district ?? "").trim() || null;
  const state = String(body.state ?? "").trim() || null;
  const pincode = String(body.pincode ?? "").trim() || null;
  const consentGiven = body.consentGiven === true || body.consentGiven === "true";

  if (!fullName || fullName.length < 3) throw new ApiError(400, "Full name is required (min 3 characters)");
  if (!MOBILE_RE.test(mobile)) throw new ApiError(400, "A valid 10-digit Indian mobile number is required");
  if (email && !EMAIL_RE.test(email)) throw new ApiError(400, "Invalid email address");
  if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
  if (!BLOOD_GROUPS.includes(bloodGroup)) throw new ApiError(400, "Invalid blood group");
  if (!consentGiven) throw new ApiError(400, "Consent to data processing is required to register");

  const duplicate = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.mobile, mobile), email ? eq(users.email, email) : undefined))
    .limit(1);
  if (duplicate.length > 0) {
    return errorResponse("An account with this mobile number or email already exists. Please login.", 409);
  }

  const [donorRole] = await db.select().from(roles).where(eq(roles.name, "DONOR")).limit(1);

  const insertUser = await db.insert(users).values({
    fullName,
    email,
    mobile,
    passwordHash: await hashPassword(password),
    roleId: donorRole.id,
    status: "ACTIVE",
    isVerified: false,
  });
  // MySQL doesn't support returning(), fetch the inserted user
  const [user] = await db.select().from(users).where(eq(users.mobile, mobile)).limit(1);
  await db.insert(userRoles).ignore().values({ userId: user.id, roleId: donorRole.id });

  const insertDonor = await db.insert(donors).values({
    userId: user.id,
    fullName,
    mobile,
    email,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth + "T00:00:00Z") : null,
    gender,
    bloodGroup,
    weight: body.weight ? String(body.weight) : null,
    addressCity: city,
    addressDistrict: district,
    addressState: state,
    pincode,
    latitude: body.latitude ? String(body.latitude) : null,
    longitude: body.longitude ? String(body.longitude) : null,
    preferredRadiusKm: body.preferredRadiusKm ? Number(body.preferredRadiusKm) : 10,
    preferredContact: String(body.preferredContact ?? "PHONE").toUpperCase(),
    emergencyNotifications: body.emergencyNotifications !== false && body.emergencyNotifications !== "false",
    consentGiven: true,
    isMobileVerified: false,
    isProfileVerified: false,
    registrationDate: new Date(),
  });
  // MySQL doesn't support returning(), fetch the inserted donor
  const [donor] = await db.select().from(donors).where(eq(donors.mobile, mobile)).limit(1);

  await db.insert(donorProfiles).ignore().values({ donorId: donor.id });
  await db.insert(donorHealthRecords).ignore().values({ donorId: donor.id });
  await db.insert(consents).ignore().values({
    donorId: donor.id,
    consentType: "DATA_PROCESSING",
    given: true,
    givenAt: new Date(),
    ipAddress: ip,
    version: "1.0",
  });

  // Issue a mobile OTP (demo mode returns it in the response; production
  // would dispatch it over SMS).
  const otp = generateOtp();
  const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES ?? 10);
  await db.insert(otpVerifications).values({
    identifier: mobile,
    otp,
    purpose: "REGISTRATION",
    expiresAt: new Date(Date.now() + otpExpiryMinutes * 60_000),
  });

  const token = await signToken({ userId: user.id, role: "DONOR", donorId: donor.id, mobile });

  return json({
    message: "Registration successful. Please verify the OTP sent to your mobile.",
    token,
    user: { id: user.id, fullName: user.fullName, mobile: user.mobile, email: user.email, role: "DONOR" },
    donorId: donor.id,
    nextEligibleDate: donor.nextEligibleDate ?? computeNextEligibleDate(null, null, null),
    // Demo only — a real SMS gateway would deliver this instead.
    demoOtp: process.env.NODE_ENV === "production" ? undefined : otp,
  }, 201);
}
