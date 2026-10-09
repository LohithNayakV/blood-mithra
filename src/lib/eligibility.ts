import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseJsonField } from "@/lib/api";

// ---------------------------------------------------------------------------
// Blood donation eligibility engine.
// Rules are configurable from the admin dashboard via system_settings
// (category "eligibility"). Defaults follow common medical guidelines:
//   Whole Blood (Male): 90 days, Whole Blood (Female): 120 days,
//   Platelets: 14 days, Plasma: 14 days, Double Red Cells: 180 days.
// ---------------------------------------------------------------------------

export interface EligibilityRules {
  whole_blood_male_days: number;
  whole_blood_female_days: number;
  platelets_days: number;
  plasma_days: number;
  double_red_cells_days: number;
  min_weight_kg: number;
  min_age: number;
  max_age: number;
  availability_confirmation_days: number;
}

export const DEFAULT_ELIGIBILITY_RULES: EligibilityRules = {
  whole_blood_male_days: 90,
  whole_blood_female_days: 120,
  platelets_days: 14,
  plasma_days: 14,
  double_red_cells_days: 180,
  min_weight_kg: 50,
  min_age: 18,
  max_age: 65,
  availability_confirmation_days: 30,
};

export async function getEligibilityRules(): Promise<EligibilityRules> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "eligibility_rules"))
      .limit(1);
    if (row?.value) {
      // MySQL returns JSON columns as strings — parse before spreading.
      const stored = parseJsonField<Partial<EligibilityRules> | null>(row.value, null);
      if (stored) return { ...DEFAULT_ELIGIBILITY_RULES, ...stored };
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_ELIGIBILITY_RULES;
}

export function getDonationIntervalDays(
  donationType: string | null | undefined,
  gender: string | null | undefined,
  rules: EligibilityRules = DEFAULT_ELIGIBILITY_RULES,
): number {
  const type = (donationType ?? "WHOLE_BLOOD").toUpperCase();
  if (type === "PLATELETS") return rules.platelets_days;
  if (type === "PLASMA") return rules.plasma_days;
  if (type === "DOUBLE_RED" || type === "DOUBLE_RED_CELLS") return rules.double_red_cells_days;
  return gender?.toUpperCase() === "FEMALE"
    ? rules.whole_blood_female_days
    : rules.whole_blood_male_days;
}

export function computeNextEligibleDate(
  lastDonationDate: Date | string | null,
  donationType: string | null | undefined,
  gender: string | null | undefined,
  rules?: EligibilityRules,
): Date | null {
  if (!lastDonationDate) return null;
  const interval = getDonationIntervalDays(donationType, gender, rules);
  const base = new Date(lastDonationDate);
  const next = new Date(base.getTime() + interval * 24 * 60 * 60 * 1000);
  return next;
}

export function computeAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export type DonorStatus =
  | "ACTIVE"
  | "RECENTLY_DONATED"
  | "VERIFIED"
  | "REGULAR_DONOR"
  | "INACTIVE"
  | "TEMPORARILY_DEFERRED"
  | "UNDER_REVIEW";

interface StatusInput {
  isProfileVerified: boolean;
  totalDonations: number;
  daysSinceRegistration: number;
  lastDonationDate: Date | string | null;
  nextEligibleDate: Date | string | null;
  healthStatus: string;
  availabilityStatus: string;
  donationType?: string | null;
  gender?: string | null;
  rules?: EligibilityRules;
}

/** Derive the donor status category from backend rules. */
export function computeDonorStatus(input: StatusInput): DonorStatus {
  if (input.healthStatus === "INELIGIBLE" || input.healthStatus === "TEMPORARY_DEFERRAL") {
    return "TEMPORARILY_DEFERRED";
  }
  if (input.healthStatus === "UNDER_REVIEW") return "UNDER_REVIEW";
  if (input.daysSinceRegistration > 180 && input.totalDonations === 0) return "INACTIVE";

  const now = new Date();
  if (input.lastDonationDate) {
    const next = input.nextEligibleDate
      ? new Date(input.nextEligibleDate)
      : computeNextEligibleDate(input.lastDonationDate, input.donationType, input.gender, input.rules);
    if (next && next.getTime() > now.getTime()) return "RECENTLY_DONATED";
  }
  if (input.totalDonations >= 10) return "REGULAR_DONOR";
  if (input.isProfileVerified && input.availabilityStatus === "AVAILABLE") return "VERIFIED";
  if (input.availabilityStatus !== "AVAILABLE") return "INACTIVE";
  return "ACTIVE";
}

/** Compute the schedule bucket shown on dashboards. */
export function scheduleBucket(
  date: Date | string,
  status: string,
  now = new Date(),
): "TODAY" | "TOMORROW" | "THIS_WEEK" | "UPCOMING" | "OVERDUE" | "COMPLETED" {
  if (status === "COMPLETED") return "COMPLETED";
  const d = new Date(date);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((d.getTime() - startOfToday.getTime()) / dayMs);
  if (diffDays < 0) return "OVERDUE";
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "TOMORROW";
  if (diffDays <= 7) return "THIS_WEEK";
  return "UPCOMING";
}
