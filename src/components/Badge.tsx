import type { ReactNode } from "react";

// Maps platform statuses to premium badge styles.
const MAP: Record<string, string> = {
  // donor status
  ACTIVE: "bm-badge-green",
  VERIFIED: "bm-badge-blue",
  REGULAR_DONOR: "bm-badge-green",
  RECENTLY_DONATED: "bm-badge-amber",
  INACTIVE: "bm-badge-gray",
  TEMPORARILY_DEFERRED: "bm-badge-amber",
  UNDER_REVIEW: "bm-badge-red",
  // availability
  AVAILABLE: "bm-badge-green",
  UNAVAILABLE: "bm-badge-gray",
  // eligibility
  ELIGIBLE: "bm-badge-green",
  // health
  HEALTHY: "bm-badge-green",
  TEMPORARY_DEFERRAL: "bm-badge-amber",
  INELIGIBLE: "bm-badge-red",
  // requests
  CREATED: "bm-badge-gray",
  VERIFICATION: "bm-badge-blue",
  DONORS_NOTIFIED: "bm-badge-blue",
  RESPONSES_CONFIRMED: "bm-badge-blue",
  CONFIRMED: "bm-badge-amber",
  COLLECTED: "bm-badge-amber",
  FULFILLED: "bm-badge-green",
  CANCELLED: "bm-badge-red",
  // urgency
  LOW: "bm-badge-gray",
  MEDIUM: "bm-badge-blue",
  HIGH: "bm-badge-amber",
  CRITICAL: "bm-badge-red",
  // notifications
  SENT: "bm-badge-blue",
  VIEWED: "bm-badge-gray",
  ACCEPTED: "bm-badge-green",
  REJECTED: "bm-badge-red",
  NO_RESPONSE: "bm-badge-gray",
  // certificates
  PENDING: "bm-badge-amber",
  GENERATED: "bm-badge-blue",
  ISSUED: "bm-badge-blue",
  RECEIVED: "bm-badge-green",
  // volunteers
  ON_LEAVE: "bm-badge-amber",
  // schedules
  TODAY: "bm-badge-red",
  TOMORROW: "bm-badge-amber",
  THIS_WEEK: "bm-badge-blue",
  UPCOMING: "bm-badge-gray",
  OVERDUE: "bm-badge-red",
  COMPLETED: "bm-badge-green",
  SCHEDULED: "bm-badge-blue",
  // camps
  UPCOMING_CAMP: "bm-badge-blue",
  ONGOING: "bm-badge-green",
  // misc
  CLEARED: "bm-badge-green",
  DEFERRED: "bm-badge-amber",
  REGISTERED: "bm-badge-blue",
  true: "bm-badge-green",
  false: "bm-badge-red",
};

export function Badge({ value, children }: { value?: string | number | boolean | null; children?: ReactNode }) {
  const key = String(value ?? "").toUpperCase().replace(/\s+/g, "_");
  const cls = MAP[key] ?? "bm-badge-gray";
  const label = children ?? String(value ?? "—");
  return <span className={`bm-badge ${cls}`}>{label}</span>;
}
