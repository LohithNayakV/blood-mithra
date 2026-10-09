import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  datetime,
  decimal,
  date,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// NOTE: optional event times use `datetime` (not `timestamp`) with an explicit
// `.default(sql`NULL`)`. A bare `timestamp` column gets an implicit
// zero-date/CURRENT_TIMESTAMP default from MariaDB/MySQL, which strict
// sql_modes reject with ER_INVALID_DEFAULT (1067) — or silently store wrong
// defaults. (`datetime` is nullable by default, so `DEFAULT NULL` is valid.)
// Required timestamps that are always provided on insert keep `timestamp`.

// ---------------------------------------------------------------------------
// Blood Mithra — database schema (MySQL via Drizzle ORM)
// Every table has primary keys, created_at/updated_at timestamps, and indexes
// on the columns used by dashboard queries and donor search.
// ---------------------------------------------------------------------------

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

// --- Auth & access control -------------------------------------------------

export const roles = mysqlTable("roles", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  permissions: json("permissions").$type<string[]>().default([]),
  ...timestamps,
}, (t) => [uniqueIndex("roles_name_idx").on(t.name)]);

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 190 }),
  mobile: varchar("mobile", { length: 20 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  roleId: int("role_id").references(() => roles.id),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  lastLogin: datetime("last_login", { mode: "date" }).default(sql`NULL`),
  ...timestamps,
}, (t) => [index("users_role_idx").on(t.roleId), index("users_status_idx").on(t.status)]);

export const userRoles = mysqlTable("user_roles", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: int("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
}, (t) => [uniqueIndex("user_roles_unique_idx").on(t.userId, t.roleId)]);

// --- Geography -------------------------------------------------------------

export const districts = mysqlTable("districts", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 120 }).notNull(),
  state: varchar("state", { length: 120 }).notNull(),
  code: varchar("code", { length: 16 }),
  ...timestamps,
}, (t) => [uniqueIndex("districts_name_state_idx").on(t.name, t.state)]);

export const cities = mysqlTable("cities", {
  id: int("id").primaryKey().autoincrement(),
  districtId: int("district_id").references(() => districts.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  pincode: varchar("pincode", { length: 10 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  ...timestamps,
}, (t) => [index("cities_district_idx").on(t.districtId), index("cities_pincode_idx").on(t.pincode)]);

// --- Donors ----------------------------------------------------------------

export const donors = mysqlTable("donors", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  mobile: varchar("mobile", { length: 20 }).notNull(),
  email: varchar("email", { length: 190 }),
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender", { length: 16 }),
  bloodGroup: varchar("blood_group", { length: 8 }).notNull(),
  weight: decimal("weight", { precision: 5, scale: 2 }),
  addressCity: varchar("address_city", { length: 120 }),
  addressDistrict: varchar("address_district", { length: 120 }),
  addressState: varchar("address_state", { length: 120 }),
  pincode: varchar("pincode", { length: 10 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  preferredRadiusKm: int("preferred_radius_km").default(10),
  lastDonationDate: date("last_donation_date"),
  donationType: varchar("donation_type", { length: 32 }).default("WHOLE_BLOOD"),
  totalDonations: int("total_donations").default(0).notNull(),
  nextEligibleDate: date("next_eligible_date"),
  availabilityStatus: varchar("availability_status", { length: 32 }).default("AVAILABLE").notNull(),
  emergencyNotifications: boolean("emergency_notifications").default(true).notNull(),
  preferredContact: varchar("preferred_contact", { length: 16 }).default("PHONE"),
  isMobileVerified: boolean("is_mobile_verified").default(false).notNull(),
  isProfileVerified: boolean("is_profile_verified").default(false).notNull(),
  consentGiven: boolean("consent_given").default(false).notNull(),
  registrationDate: timestamp("registration_date").defaultNow().notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  eligibilityStatus: varchar("eligibility_status", { length: 32 }).default("ELIGIBLE").notNull(),
  healthStatus: varchar("health_status", { length: 32 }).default("HEALTHY").notNull(),
  activityScore: int("activity_score").default(0).notNull(),
  profileCompletion: int("profile_completion").default(0).notNull(),
  assignedVolunteerId: int("assigned_volunteer_id"),
  ...timestamps,
}, (t) => [
  index("donors_blood_group_idx").on(t.bloodGroup),
  index("donors_city_idx").on(t.addressCity),
  index("donors_district_idx").on(t.addressDistrict),
  index("donors_pincode_idx").on(t.pincode),
  index("donors_status_idx").on(t.status),
  index("donors_availability_idx").on(t.availabilityStatus),
  index("donors_eligibility_idx").on(t.eligibilityStatus),
  index("donors_next_eligible_idx").on(t.nextEligibleDate),
  index("donors_geo_idx").on(t.latitude, t.longitude),
]);

export const donorProfiles = mysqlTable("donor_profiles", {
  id: int("id").primaryKey().autoincrement(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).unique().notNull(),
  photoUrl: text("photo_url"),
  bio: text("bio"),
  badges: json("badges").$type<string[]>().default([]),
  milestones: json("milestones").$type<Record<string, unknown>[]>().default([]),
  recognitionHistory: json("recognition_history").$type<Record<string, unknown>[]>().default([]),
  emergencyAvailability: boolean("emergency_availability").default(true).notNull(),
  lastAvailabilityConfirmation: datetime("last_availability_confirmation", { mode: "date" }).default(sql`NULL`),
  nextAvailabilityConfirmation: datetime("next_availability_confirmation", { mode: "date" }).default(sql`NULL`),
  ...timestamps,
}, (t) => [index("donor_profiles_donor_idx").on(t.donorId)]);

// --- Donor health (private — restricted to authorized roles) ---------------

export const donorHealthRecords = mysqlTable("donor_health_records", {
  id: int("id").primaryKey().autoincrement(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).unique().notNull(),
  healthStatus: varchar("health_status", { length: 32 }).default("HEALTHY").notNull(),
  recentIllness: text("recent_illness"),
  currentMedications: text("current_medications"),
  surgeries: text("surgeries"),
  hospitalizations: text("hospitalizations"),
  existingConditions: text("existing_conditions"),
  recentFever: boolean("recent_fever").default(false),
  recentVaccination: boolean("recent_vaccination").default(false),
  pregnancyRelated: text("pregnancy_related"),
  weight: decimal("weight", { precision: 5, scale: 2 }),
  lastHealthConfirmation: datetime("last_health_confirmation", { mode: "date" }).default(sql`NULL`),
  healthDeclaration: boolean("health_declaration").default(false).notNull(),
  screeningStatus: varchar("screening_status", { length: 32 }).default("PENDING").notNull(),
  eligibilityRemarks: text("eligibility_remarks"),
  nextReviewDate: date("next_review_date"),
  ...timestamps,
}, (t) => [index("donor_health_donor_idx").on(t.donorId), index("donor_health_status_idx").on(t.healthStatus)]);

export const donorHealthHistory = mysqlTable("donor_health_history", {
  id: int("id").primaryKey().autoincrement(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  healthRecordId: int("health_record_id").references(() => donorHealthRecords.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 32 }).notNull(),
  remarks: text("remarks"),
  recordedBy: int("recorded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("donor_health_history_donor_idx").on(t.donorId)]);

// --- Availability & schedules ----------------------------------------------

export const donorAvailability = mysqlTable("donor_availability", {
  id: int("id").primaryKey().autoincrement(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  available: boolean("available").notNull(),
  confirmedAt: timestamp("confirmed_at").defaultNow().notNull(),
  nextConfirmationDate: datetime("next_confirmation_date", { mode: "date" }).default(sql`NULL`),
  source: varchar("source", { length: 32 }).default("SELF"),
  notes: text("notes"),
}, (t) => [index("donor_availability_donor_idx").on(t.donorId)]);

export const donorSchedules = mysqlTable("donor_schedules", {
  id: int("id").primaryKey().autoincrement(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 32 }).notNull(), // DONATION | HEALTH_REVIEW | AVAILABILITY | CAMP | FOLLOW_UP
  scheduledDate: timestamp("scheduled_date").notNull(),
  status: varchar("status", { length: 32 }).default("SCHEDULED").notNull(),
  notes: text("notes"),
  ...timestamps,
}, (t) => [index("donor_schedules_donor_idx").on(t.donorId), index("donor_schedules_date_idx").on(t.scheduledDate)]);

// --- Hospitals / blood banks / organizations -------------------------------

export const hospitals = mysqlTable("hospitals", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 190 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  district: varchar("district", { length: 120 }),
  pincode: varchar("pincode", { length: 10 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 190 }),
  type: varchar("type", { length: 64 }).default("HOSPITAL"),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  ...timestamps,
}, (t) => [index("hospitals_city_idx").on(t.city), index("hospitals_district_idx").on(t.district)]);

export const bloodBanks = mysqlTable("blood_banks", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 190 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  district: varchar("district", { length: 120 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 190 }),
  licenseNumber: varchar("license_number", { length: 64 }),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  ...timestamps,
}, (t) => [index("blood_banks_district_idx").on(t.district)]);

export const organizations = mysqlTable("organizations", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 190 }).notNull(),
  type: varchar("type", { length: 64 }).default("NGO").notNull(), // NGO | HOSPITAL | BLOOD_BANK | CORPORATE | COMMUNITY
  address: text("address"),
  city: varchar("city", { length: 120 }),
  district: varchar("district", { length: 120 }),
  contactPerson: varchar("contact_person", { length: 160 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 190 }),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  ...timestamps,
}, (t) => [index("organizations_district_idx").on(t.district), index("organizations_type_idx").on(t.type)]);

// --- Donations & certificates ----------------------------------------------

export const donations = mysqlTable("donations", {
  id: int("id").primaryKey().autoincrement(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  donationDate: date("donation_date").notNull(),
  donationType: varchar("donation_type", { length: 32 }).default("WHOLE_BLOOD").notNull(),
  hospitalId: int("hospital_id").references(() => hospitals.id),
  bloodBankId: int("blood_bank_id").references(() => bloodBanks.id),
  campId: int("camp_id").references(() => bloodCamps.id),
  units: decimal("units", { precision: 4, scale: 2 }).default("1"),
  hemoglobin: decimal("hemoglobin", { precision: 4, scale: 2 }),
  verified: boolean("verified").default(false).notNull(),
  verifiedBy: int("verified_by").references(() => users.id),
  status: varchar("status", { length: 32 }).default("COMPLETED").notNull(),
  ...timestamps,
}, (t) => [
  index("donations_donor_idx").on(t.donorId),
  index("donations_date_idx").on(t.donationDate),
  index("donations_status_idx").on(t.status),
]);

export const donationCertificates = mysqlTable("donation_certificates", {
  id: int("id").primaryKey().autoincrement(),
  donationId: int("donation_id").references(() => donations.id, { onDelete: "cascade" }).unique().notNull(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  certificateNumber: varchar("certificate_number", { length: 64 }).unique().notNull(),
  status: varchar("status", { length: 32 }).default("PENDING").notNull(), // PENDING | GENERATED | ISSUED | RECEIVED | VERIFIED
  issuedDate: date("issued_date"),
  receivedDate: date("received_date"),
  verifiedDate: date("verified_date"),
  issuedBy: int("issued_by").references(() => users.id),
  ...timestamps,
}, (t) => [index("donation_certificates_donor_idx").on(t.donorId), index("donation_certificates_status_idx").on(t.status)]);

// --- Blood requests & notifications -----------------------------------------

export const bloodRequests = mysqlTable("blood_requests", {
  id: int("id").primaryKey().autoincrement(),
  requesterId: int("requester_id").references(() => users.id),
  requesterName: varchar("requester_name", { length: 160 }),
  requesterPhone: varchar("requester_phone", { length: 20 }),
  bloodGroup: varchar("blood_group", { length: 8 }).notNull(),
  unitsRequired: int("units_required").default(1).notNull(),
  hospitalId: int("hospital_id").references(() => hospitals.id),
  hospitalName: varchar("hospital_name", { length: 190 }),
  hospitalLocation: text("hospital_location"),
  city: varchar("city", { length: 120 }),
  district: varchar("district", { length: 120 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  requiredAt: datetime("required_at", { mode: "date" }).default(sql`NULL`),
  urgency: varchar("urgency", { length: 16 }).default("MEDIUM").notNull(), // LOW | MEDIUM | HIGH | CRITICAL
  contactInfo: varchar("contact_info", { length: 255 }),
  details: text("details"),
  status: varchar("status", { length: 32 }).default("CREATED").notNull(),
  currentWave: int("current_wave").default(0).notNull(),
  donorsNotified: int("donors_notified").default(0).notNull(),
  responsesReceived: int("responses_received").default(0).notNull(),
  ...timestamps,
}, (t) => [
  index("blood_requests_status_idx").on(t.status),
  index("blood_requests_blood_group_idx").on(t.bloodGroup),
  index("blood_requests_city_idx").on(t.city),
  index("blood_requests_urgency_idx").on(t.urgency),
]);

export const requestNotifications = mysqlTable("request_notifications", {
  id: int("id").primaryKey().autoincrement(),
  requestId: int("request_id").references(() => bloodRequests.id, { onDelete: "cascade" }).notNull(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  wave: int("wave").default(1).notNull(),
  status: varchar("status", { length: 32 }).default("SENT").notNull(), // SENT | VIEWED | ACCEPTED | REJECTED | NO_RESPONSE
  distanceKm: decimal("distance_km", { precision: 8, scale: 2 }),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  viewedAt: datetime("viewed_at", { mode: "date" }).default(sql`NULL`),
  respondedAt: datetime("responded_at", { mode: "date" }).default(sql`NULL`),
}, (t) => [
  index("request_notifications_request_idx").on(t.requestId),
  index("request_notifications_donor_idx").on(t.donorId),
  index("request_notifications_status_idx").on(t.status),
]);

// --- Volunteers -------------------------------------------------------------

export const volunteers = mysqlTable("volunteers", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id),
  name: varchar("name", { length: 160 }).notNull(),
  mobile: varchar("mobile", { length: 20 }).notNull(),
  email: varchar("email", { length: 190 }),
  district: varchar("district", { length: 120 }),
  city: varchar("city", { length: 120 }),
  assignedArea: varchar("assigned_area", { length: 190 }),
  availability: varchar("availability", { length: 32 }).default("FLEXIBLE"),
  status: varchar("status", { length: 32 }).default("PENDING").notNull(), // ACTIVE | INACTIVE | ON_LEAVE | PENDING
  joiningDate: timestamp("joining_date").defaultNow().notNull(),
  responsibility: text("responsibility"),
  coordinator: varchar("coordinator", { length: 160 }),
  ...timestamps,
}, (t) => [index("volunteers_district_idx").on(t.district), index("volunteers_status_idx").on(t.status)]);

export const volunteerAssignments = mysqlTable("volunteer_assignments", {
  id: int("id").primaryKey().autoincrement(),
  volunteerId: int("volunteer_id").references(() => volunteers.id, { onDelete: "cascade" }).notNull(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }),
  requestId: int("request_id").references(() => bloodRequests.id, { onDelete: "cascade" }),
  assignmentType: varchar("assignment_type", { length: 32 }).notNull(), // DONOR_SUPPORT | REQUEST_SUPPORT | CAMP_SUPPORT | FOLLOW_UP
  status: varchar("status", { length: 32 }).default("PENDING").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  completedAt: datetime("completed_at", { mode: "date" }).default(sql`NULL`),
}, (t) => [index("volunteer_assignments_volunteer_idx").on(t.volunteerId)]);

// --- Blood camps -------------------------------------------------------------

export const bloodCamps = mysqlTable("blood_camps", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 190 }).notNull(),
  organizerId: int("organizer_id").references(() => organizations.id),
  location: varchar("location", { length: 255 }),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  district: varchar("district", { length: 120 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  startTime: varchar("start_time", { length: 8 }),
  endTime: varchar("end_time", { length: 8 }),
  status: varchar("status", { length: 32 }).default("UPCOMING").notNull(), // UPCOMING | ONGOING | COMPLETED | CANCELLED
  targetDonors: int("target_donors").default(0),
  registeredDonors: int("registered_donors").default(0).notNull(),
  contact: varchar("contact", { length: 64 }),
  ...timestamps,
}, (t) => [index("blood_camps_district_idx").on(t.district), index("blood_camps_start_idx").on(t.startDate), index("blood_camps_status_idx").on(t.status)]);

export const campRegistrations = mysqlTable("camp_registrations", {
  id: int("id").primaryKey().autoincrement(),
  campId: int("camp_id").references(() => bloodCamps.id, { onDelete: "cascade" }).notNull(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  status: varchar("status", { length: 32 }).default("REGISTERED").notNull(),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("camp_registrations_unique_idx").on(t.campId, t.donorId)]);

// --- Notifications, OTP, consents, settings, audit, follow-ups, migrations -

export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id, { onDelete: "cascade" }),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull(), // EMERGENCY_REQUEST | REMINDER | CERTIFICATE | GENERAL
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  channel: varchar("channel", { length: 16 }).default("IN_APP"),
  status: varchar("status", { length: 16 }).default("SENT").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  readAt: datetime("read_at", { mode: "date" }).default(sql`NULL`),
}, (t) => [index("notifications_donor_idx").on(t.donorId), index("notifications_user_idx").on(t.userId)]);

export const otpVerifications = mysqlTable("otp_verifications", {
  id: int("id").primaryKey().autoincrement(),
  identifier: varchar("identifier", { length: 190 }).notNull(), // mobile or email
  otp: varchar("otp", { length: 10 }).notNull(),
  purpose: varchar("purpose", { length: 32 }).default("REGISTRATION").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  attempts: int("attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("otp_verifications_identifier_idx").on(t.identifier)]);

export const consents = mysqlTable("consents", {
  id: int("id").primaryKey().autoincrement(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  consentType: varchar("consent_type", { length: 64 }).notNull(),
  given: boolean("given").default(false).notNull(),
  givenAt: datetime("given_at", { mode: "date" }).default(sql`NULL`),
  ipAddress: varchar("ip_address", { length: 64 }),
  version: varchar("version", { length: 16 }).default("1.0"),
}, (t) => [index("consents_donor_idx").on(t.donorId)]);

export const systemSettings = mysqlTable("system_settings", {
  id: int("id").primaryKey().autoincrement(),
  key: varchar("key", { length: 120 }).notNull(),
  value: json("value").$type<unknown>(),
  description: text("description"),
  category: varchar("category", { length: 64 }).default("GENERAL"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("system_settings_key_idx").on(t.key)]);

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: int("entity_id"),
  details: json("details").$type<Record<string, unknown>>(),
  ipAddress: varchar("ip_address", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("audit_logs_user_idx").on(t.userId), index("audit_logs_created_idx").on(t.createdAt)]);

export const followUps = mysqlTable("follow_ups", {
  id: int("id").primaryKey().autoincrement(),
  donorId: int("donor_id").references(() => donors.id, { onDelete: "cascade" }),
  volunteerId: int("volunteer_id").references(() => volunteers.id),
  assignedTo: int("assigned_to").references(() => users.id),
  type: varchar("type", { length: 32 }).notNull(), // HEALTH | AVAILABILITY | CERTIFICATE | DONATION | GENERAL
  dueDate: timestamp("due_date").notNull(),
  status: varchar("status", { length: 32 }).default("PENDING").notNull(),
  notes: text("notes"),
  completedAt: datetime("completed_at", { mode: "date" }).default(sql`NULL`),
  createdBy: int("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("follow_ups_status_idx").on(t.status), index("follow_ups_due_idx").on(t.dueDate)]);

export const migrations = mysqlTable("migrations", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 190 }).notNull(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("migrations_name_idx").on(t.name)]);

// Type exports for use across the app.
export type Role = typeof roles.$inferSelect;
export type User = typeof users.$inferSelect;
export type Donor = typeof donors.$inferSelect;
export type DonorProfile = typeof donorProfiles.$inferSelect;
export type DonorHealthRecord = typeof donorHealthRecords.$inferSelect;
export type Donation = typeof donations.$inferSelect;
export type DonationCertificate = typeof donationCertificates.$inferSelect;
export type BloodRequest = typeof bloodRequests.$inferSelect;
export type RequestNotification = typeof requestNotifications.$inferSelect;
export type Hospital = typeof hospitals.$inferSelect;
export type BloodBank = typeof bloodBanks.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Volunteer = typeof volunteers.$inferSelect;
export type BloodCamp = typeof bloodCamps.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
