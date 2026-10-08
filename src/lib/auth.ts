import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Authentication helpers: JWT (jose) + password hashing (bcryptjs).
// Secrets are always read from the environment — never hardcoded.
// ---------------------------------------------------------------------------

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(secret);
};

export const TOKEN_TTL = "7d";

export interface AuthTokenPayload {
  userId: number;
  role: string;
  donorId?: number | null;
  mobile?: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateCertificateNumber(donationId: number): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `BM-CERT-${stamp}-${String(donationId).padStart(5, "0")}`;
}
