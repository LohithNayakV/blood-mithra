// ---------------------------------------------------------------------------
// Donor activity score (0–100).
// Weighted blend of: profile completeness, verification, donation history,
// response rate to requests, availability confirmations and recency.
// Used for donor matching and analytics.
// ---------------------------------------------------------------------------

export interface ActivityInput {
  profileCompletion: number; // 0–100
  isProfileVerified: boolean;
  isMobileVerified: boolean;
  totalDonations: number;
  daysSinceRegistration: number;
  daysSinceLastDonation: number | null;
  acceptedResponses: number;
  sentNotifications: number;
  availabilityConfirmations: number;
  lastAvailabilityConfirmationDays: number | null;
}

export function computeActivityScore(input: ActivityInput): number {
  let score = 0;

  // Profile completeness (25)
  score += Math.min(25, (input.profileCompletion / 100) * 25);

  // Verification (15)
  if (input.isMobileVerified) score += 7;
  if (input.isProfileVerified) score += 8;

  // Donation history (20) — log scale, capped
  score += Math.min(20, Math.log10(1 + input.totalDonations) * 6);

  // Response rate (20)
  if (input.sentNotifications > 0) {
    const rate = input.acceptedResponses / input.sentNotifications;
    score += Math.min(20, rate * 20);
  } else if (input.totalDonations > 0) {
    score += 10; // no requests yet but a proven donor
  }

  // Availability confirmation frequency (10)
  score += Math.min(10, input.availabilityConfirmations * 2);

  // Recency (10) — active in the last 90 days scores full
  const lastActivity =
    input.daysSinceLastDonation ??
    input.lastAvailabilityConfirmationDays ??
    input.daysSinceRegistration;
  if (lastActivity <= 30) score += 10;
  else if (lastActivity <= 90) score += 6;
  else if (lastActivity <= 180) score += 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}
