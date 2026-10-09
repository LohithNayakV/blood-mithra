import "dotenv/config";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  roles,
  users,
  userRoles,
  districts,
  cities,
  donors,
  donorProfiles,
  donorHealthRecords,
  donorHealthHistory,
  donorAvailability,
  donorSchedules,
  hospitals,
  bloodBanks,
  organizations,
  donations,
  donationCertificates,
  bloodRequests,
  requestNotifications,
  volunteers,
  volunteerAssignments,
  bloodCamps,
  notifications,
  consents,
  systemSettings,
  migrations,
} from "@/db/schema";
import { hashPassword, generateCertificateNumber } from "@/lib/auth";
import {
  computeNextEligibleDate,
  computeDonorStatus,
  DEFAULT_ELIGIBILITY_RULES,
} from "@/lib/eligibility";
import { computeActivityScore } from "@/lib/activity";
import { desc, eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Self-initialization: verifies the connection, keeps a `migrations` table to
// track completed setup steps, and runs each pending migration exactly once.
// Safe to run on every server start (idempotent).
// ---------------------------------------------------------------------------

const MIGRATIONS_FOLDER = join(process.cwd(), "drizzle");
const DRIZZLE_JOURNAL_TABLE = "__drizzle_migrations";

function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname || "127.0.0.1",
    port: Number(u.port || "3306"),
    user: decodeURIComponent(u.username || "root"),
    password: decodeURIComponent(u.password || ""),
    database: decodeURIComponent(u.pathname.replace(/^\//, "") || "blood_mithra"),
  };
}

interface JournalMigration {
  tag: string;
  when: number;
  hash: string;
  sql: string;
  tables: string[];
}

/** Read drizzle/meta/_journal.json + each .sql file (same hash format the
 * official migrator uses: sha256 of the raw file content). */
function readJournalMigrations(migrationsFolder: string): JournalMigration[] {
  const journalPath = join(migrationsFolder, "meta", "_journal.json");
  if (!existsSync(journalPath)) return [];
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: { tag: string; when: number }[];
  };
  return journal.entries.map((e) => {
    const sqlText = readFileSync(join(migrationsFolder, `${e.tag}.sql`), "utf-8");
    const tables = [...sqlText.matchAll(/create table\s+`?([A-Za-z0-9_]+)`?/gi)].map((m) =>
      m[1].toLowerCase(),
    );
    return {
      tag: e.tag,
      when: e.when,
      hash: createHash("sha256").update(sqlText).digest("hex"),
      sql: sqlText,
      tables: [...new Set(tables)],
    };
  });
}

/** Error codes that mean "this object already exists" — safe to skip when
 * repairing a half-built database (e.g. a previous migration run died
 * midway). Anything else aborts with a clear message. */
const TOLERATED_SQL_CODES = new Set([
  "ER_TABLE_EXISTS_ERROR", // 1050 CREATE TABLE on existing table
  "ER_DUP_FIELDNAME", // 1060 ADD COLUMN that already exists
  "ER_MULTIPLE_PRI_KEY", // 1068 duplicate primary key
  "ER_DUP_KEYNAME", // 1061 duplicate index/key name
  "ER_FK_DUP_NAME", // 1826 duplicate foreign-key constraint name
]);

function sqlErrorDetails(err: unknown): string {
  const e = err as { code?: string; errno?: number; sqlMessage?: string; message?: string };
  return `${e.code ?? "UNKNOWN"}${e.errno ? ` (${e.errno})` : ""}: ${e.sqlMessage ?? e.message ?? String(err)}`;
}

/**
 * Ensure the database and all Drizzle tables exist.
 *
 * 1. `CREATE DATABASE IF NOT EXISTS` — a brand-new device only needs MySQL
 *    running; no manual setup.
 * 2. Each journal migration is applied statement-by-statement:
 *    - fully applied → skipped;
 *    - all tables already present → recorded as applied (baseline, for DBs
 *      created before the `__drizzle_migrations` journal existed);
 *    - otherwise statements run one by one, tolerating "already exists"
 *      leftovers from an interrupted earlier run — this also repairs a
 *      half-built database instead of failing on the first CREATE TABLE.
 */
async function ensureSchema(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const creds = parseDatabaseUrl(databaseUrl);

  const server = await mysql.createConnection({
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
  });
  try {
    await server.query(`CREATE DATABASE IF NOT EXISTS \`${creds.database.replace(/`/g, "``")}\``);
  } finally {
    await server.end();
  }

  const conn = await mysql.createConnection({
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
    database: creds.database,
  });
  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS \`${DRIZZLE_JOURNAL_TABLE}\` (id serial primary key, hash text not null, created_at bigint)`,
    );
    const [appliedRows] = (await conn.query(
      `SELECT hash, created_at FROM \`${DRIZZLE_JOURNAL_TABLE}\``,
    )) as unknown as [{ hash: string; created_at: number | string }[]];
    const applied = new Set(appliedRows.map((r) => Number(r.created_at)));

    for (const m of readJournalMigrations(MIGRATIONS_FOLDER)) {
      if (applied.has(m.when)) {
        continue;
      }
      const statements = m.sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Fast path: every table this migration creates already exists.
      let needsApply = true;
      if (m.tables.length > 0) {
        const [existing] = (await conn.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN (?)",
          [creds.database, m.tables],
        )) as unknown as [{ table_name: string }[]];
        const found = new Set(existing.map((r) => String(r.table_name).toLowerCase()));
        needsApply = !m.tables.every((t) => found.has(t));
      }
      if (!needsApply) {
        await conn.query(
          `INSERT INTO \`${DRIZZLE_JOURNAL_TABLE}\` (hash, created_at) VALUES (?, ?)`,
          [m.hash, m.when],
        );
        console.log(`[db] baselined migration ${m.tag} (tables already exist)`);
        applied.add(m.when);
        continue;
      }

      for (const statement of statements) {
        try {
          await conn.query(statement);
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code && TOLERATED_SQL_CODES.has(code)) {
            console.log(`[db] ${m.tag}: already exists, continuing (${code})`);
            continue;
          }
          throw new Error(
            `Migration ${m.tag} failed on: ${statement.split("\n")[0].slice(0, 90)}… → ${sqlErrorDetails(err)}`,
          );
        }
      }
      await conn.query(
        `INSERT INTO \`${DRIZZLE_JOURNAL_TABLE}\` (hash, created_at) VALUES (?, ?)`,
        [m.hash, m.when],
      );
      console.log(`[db] applied migration ${m.tag} (${statements.length} statements)`);
      applied.add(m.when);
    }
    console.log("[db] schema is up to date");
  } finally {
    await conn.end();
  }
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  REGIONAL_ADMIN: [
    "donors.read", "donors.write", "donors.verify", "donors.health.read", "donors.health.write",
    "volunteers.read", "volunteers.write", "requests.read", "requests.write",
    "donations.read", "donations.write", "certificates.read", "certificates.write",
    "camps.read", "camps.write", "reports.read", "settings.read", "settings.write", "audit.read",
  ],
  HOSPITAL_COORDINATOR: [
    "donors.read", "donors.health.read", "requests.read", "requests.write",
    "donations.read", "donations.write", "certificates.read", "reports.read",
  ],
  BLOOD_BANK_OPERATOR: [
    "donors.read", "donors.health.read", "donations.read", "donations.write",
    "certificates.read", "certificates.write", "requests.read",
  ],
  NGO_ORGANIZER: ["camps.read", "camps.write", "donors.read", "volunteers.read", "reports.read"],
  SUPPORT_AGENT: ["donors.read", "donors.write", "donors.health.read", "followups.read", "followups.write", "notifications.read"],
  VOLUNTEER: ["donors.read", "followups.read", "followups.write", "camps.read"],
  AUDITOR: ["audit.read", "reports.read", "donors.read"],
  DONOR: ["profile.read", "profile.write", "availability.write", "health.write", "certificates.read"],
};

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

type MigrationFn = () => Promise<void>;

async function runSeedMigrations() {
  // 1. Roles ---------------------------------------------------------------
  for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    await db.insert(roles).ignore().values({
      name,
      description: `${name.replace(/_/g, " ")} role`,
      permissions,
    });
  }

  // 2. Default super admin ---------------------------------------------------
  const adminEmail = "admin@bloodmithra.org";
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  let adminId: number;
  if (existingAdmin.length > 0) {
    adminId = existingAdmin[0].id;
  } else {
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, "SUPER_ADMIN")).limit(1);
    await db.insert(users).values({
      fullName: "System Administrator",
      email: adminEmail,
      mobile: "9999999999",
      passwordHash: await hashPassword("admin123"),
      roleId: adminRole.id,
      status: "ACTIVE",
      isVerified: true,
    });
    const [admin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
    adminId = admin.id;
    await db.insert(userRoles).ignore().values({ userId: admin.id, roleId: adminRole.id });
  }

  // 3. System settings (incl. configurable eligibility rules) -----------------
  for (const setting of [
    {
      key: "eligibility_rules",
      value: DEFAULT_ELIGIBILITY_RULES,
      description: "Donation interval rules (days) configurable from the admin dashboard",
      category: "eligibility",
    },
    {
      key: "app",
      value: {
        name: "Blood Mithra",
        tagline: "Every drop counts. Every donor is a hero.",
        logoUrl: "",
        contactEmail: "help@bloodmithra.org",
        contactPhone: "1800-000-0000",
        address: "Bengaluru, Karnataka, India",
      },
      description: "Public site configuration",
      category: "general",
    },
    {
      key: "otp_expiry_minutes",
      value: 10,
      description: "OTP validity window",
      category: "security",
    },
  ]) {
    await db.insert(systemSettings).ignore().values(setting);
  }

  // 4. Geography -------------------------------------------------------------
  const geoRows = [
    { name: "Bengaluru Urban", state: "Karnataka", code: "KA-BLR", cities: [
      { name: "Bengaluru", pincode: "560001", lat: "12.9716", lng: "77.5946" },
      { name: "Whitefield", pincode: "560066", lat: "12.9698", lng: "77.7500" },
      { name: "Koramangala", pincode: "560034", lat: "12.9352", lng: "77.6245" },
    ]},
    { name: "Mysuru", state: "Karnataka", code: "KA-MYS", cities: [
      { name: "Mysuru", pincode: "570001", lat: "12.2958", lng: "76.6394" },
    ]},
    { name: "Dakshina Kannada", state: "Karnataka", code: "KA-DK", cities: [
      { name: "Mangaluru", pincode: "575001", lat: "12.9141", lng: "74.8560" },
    ]},
    { name: "Mumbai", state: "Maharashtra", code: "MH-MUM", cities: [
      { name: "Mumbai", pincode: "400001", lat: "19.0760", lng: "72.8777" },
    ]},
    { name: "Pune", state: "Maharashtra", code: "MH-PUN", cities: [
      { name: "Pune", pincode: "411001", lat: "18.5204", lng: "73.8567" },
    ]},
  ];
  for (const g of geoRows) {
    await db.insert(districts).ignore().values({ name: g.name, state: g.state, code: g.code });
    const [districtRow] = await db.select().from(districts).where(eq(districts.name, g.name)).limit(1);
    if (!districtRow) continue;
    for (const c of g.cities) {
      await db.insert(cities).ignore().values({
        districtId: districtRow.id, name: c.name, pincode: c.pincode,
        latitude: c.lat, longitude: c.lng,
      });
    }
  }

  // 5. Hospitals, blood banks, organizations ---------------------------------
  await db.insert(hospitals).ignore().values([
    { name: "City Care Hospital", address: "MG Road", city: "Bengaluru", district: "Bengaluru Urban", pincode: "560001", latitude: "12.9758", longitude: "77.6030", phone: "08025550101", email: "contact@citycare.example", type: "HOSPITAL" },
    { name: "Apollo Clinic Mysuru", address: "Kuvempunagar", city: "Mysuru", district: "Mysuru", pincode: "570001", latitude: "12.3100", longitude: "76.6500", phone: "08212550202", email: "info@apollo-mys.example", type: "HOSPITAL" },
    { name: "Kasturba Medical Centre", address: "Balmatta", city: "Mangaluru", district: "Dakshina Kannada", pincode: "575001", latitude: "12.8700", longitude: "74.8400", phone: "08242550303", email: "info@kmc.example", type: "HOSPITAL" },
    { name: "Lilavati Hospital", address: "Bandra West", city: "Mumbai", district: "Mumbai", pincode: "400050", latitude: "19.0596", longitude: "72.8295", phone: "02226750000", email: "info@lilavati.example", type: "HOSPITAL" },
    { name: "Ruby Hall Clinic", address: "Sassoon Road", city: "Pune", district: "Pune", pincode: "411001", latitude: "18.5314", longitude: "73.8446", phone: "02026680000", email: "info@rubyhall.example", type: "HOSPITAL" },
  ]);

  await db.insert(bloodBanks).ignore().values([
    { name: "Red Cross Blood Bank Bengaluru", address: "Sheshadri Road", city: "Bengaluru", district: "Bengaluru Urban", phone: "08022210000", email: "blr@redcrossblood.example", licenseNumber: "RCB-BLR-001" },
    { name: "Rotary Blood Bank Mysuru", address: "Sayyaji Rao Road", city: "Mysuru", district: "Mysuru", phone: "08212210000", email: "mys@rotaryblood.example", licenseNumber: "RCB-MYS-002" },
  ]);

  await db.insert(organizations).ignore().values([
    { name: "Blood Mithra Foundation", type: "NGO", address: "Jayanagar 4th Block", city: "Bengaluru", district: "Bengaluru Urban", contactPerson: "Anita Rao", phone: "08026610000", email: "ngo@bloodmithra.org" },
    { name: "Red Cross Society Karnataka", type: "NGO", address: "Cubbon Road", city: "Bengaluru", district: "Bengaluru Urban", contactPerson: "Dr. Kumar", phone: "08022260000", email: "karnataka@redcross.example" },
    { name: "Rotary Club Mysuru Brindavan", type: "COMMUNITY", address: "KRS Road", city: "Mysuru", district: "Mysuru", contactPerson: "Ravi Shankar", phone: "08214460000", email: "brindavan@rotary.example" },
    { name: "TechForLife CSR Wing", type: "CORPORATE", address: "Whitefield", city: "Bengaluru", district: "Bengaluru Urban", contactPerson: "Priya Menon", phone: "08028450000", email: "csr@techforlife.example" },
  ]);

  // 6. Blood camps -------------------------------------------------------------
  await db.insert(bloodCamps).ignore().values([
    {
      name: "Mega Blood Donation Camp — Jayanagar",
      organizerId: 1,
      location: "Jayanagar 4th Block Shopping Complex",
      address: "Jayanagar, Bengaluru",
      city: "Bengaluru",
      district: "Bengaluru Urban",
      latitude: "12.9250",
      longitude: "77.5938",
      startDate: daysAhead(5),
      endDate: daysAhead(5),
      startTime: "09:00",
      endTime: "17:00",
      status: "UPCOMING",
      targetDonors: 200,
      contact: "080-2666-0000",
    },
    {
      name: "Corporate Donation Drive — Whitefield",
      organizerId: 4,
      location: "TechForLife Campus",
      address: "Whitefield, Bengaluru",
      city: "Bengaluru",
      district: "Bengaluru Urban",
      latitude: "12.9698",
      longitude: "77.7500",
      startDate: daysAhead(12),
      endDate: daysAhead(13),
      startTime: "10:00",
      endTime: "16:00",
      status: "UPCOMING",
      targetDonors: 120,
      contact: "080-2845-0100",
    },
    {
      name: "Mysuru District Donation Camp",
      organizerId: 3,
      location: "Dasara Exhibition Grounds",
      address: "Mysuru Palace Road",
      city: "Mysuru",
      district: "Mysuru",
      latitude: "12.3052",
      longitude: "76.6542",
      startDate: daysAhead(21),
      endDate: daysAhead(21),
      startTime: "08:00",
      endTime: "18:00",
      status: "UPCOMING",
      targetDonors: 300,
      contact: "0821-246-0200",
    },
  ]);

  // 7. Volunteers --------------------------------------------------------------
  const volunteerRows = [
    { name: "Suresh Gowda", mobile: "9880000001", email: "suresh.g@bloodmithra.org", district: "Bengaluru Urban", city: "Bengaluru", assignedArea: "Jayanagar / BTM", status: "ACTIVE", responsibility: "Donor onboarding & verification follow-ups", coordinator: "Anita Rao" },
    { name: "Lakshmi Nair", mobile: "9880000002", email: "lakshmi.n@bloodmithra.org", district: "Mysuru", city: "Mysuru", assignedArea: "Mysuru City", status: "ACTIVE", responsibility: "Camp coordination & donor follow-ups", coordinator: "Ravi Shankar" },
    { name: "Arjun Shetty", mobile: "9880000003", email: "arjun.s@bloodmithra.org", district: "Dakshina Kannada", city: "Mangaluru", assignedArea: "Mangaluru taluk", status: "ON_LEAVE", responsibility: "Certificate follow-ups", coordinator: "Dr. Kumar" },
  ];
  for (const v of volunteerRows) {
    await db.insert(volunteers).ignore().values({
      name: v.name, mobile: v.mobile, email: v.email, district: v.district, city: v.city,
      assignedArea: v.assignedArea, availability: "FLEXIBLE", status: v.status,
      joiningDate: daysAgo(400), responsibility: v.responsibility, coordinator: v.coordinator,
    });
  }

  // 8. Demo donors (each with user account, profile, health, availability) -----
  const donorSeed = [
    { name: "Rahul Verma", mobile: "9811111111", email: "rahul.v@example.com", dob: "1990-05-12", gender: "MALE", bg: "O+", weight: "74", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", pin: "560034", lat: "12.9352", lng: "77.6245", lastDonationDaysAgo: null, total: 6, verified: true, health: "HEALTHY", avail: "AVAILABLE", radius: 15 },
    { name: "Priya Sharma", mobile: "9811111112", email: "priya.s@example.com", dob: "1988-09-03", gender: "FEMALE", bg: "B+", weight: "58", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", pin: "560066", lat: "12.9698", lng: "77.7500", lastDonationDaysAgo: 20, total: 3, verified: true, health: "HEALTHY", avail: "AVAILABLE", radius: 10 },
    { name: "Amit Patel", mobile: "9811111113", email: "amit.p@example.com", dob: "1995-01-22", gender: "MALE", bg: "A+", weight: "81", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", pin: "560001", lat: "12.9716", lng: "77.5946", lastDonationDaysAgo: 100, total: 8, verified: true, health: "HEALTHY", avail: "AVAILABLE", radius: 20 },
    { name: "Sneha Reddy", mobile: "9811111114", email: "sneha.r@example.com", dob: "1993-11-30", gender: "FEMALE", bg: "O-", weight: "55", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", pin: "560034", lat: "12.9279", lng: "77.6271", lastDonationDaysAgo: null, total: 1, verified: true, health: "HEALTHY", avail: "AVAILABLE", radius: 12 },
    { name: "Vikram Singh", mobile: "9811111115", email: "vikram.s@example.com", dob: "1985-07-19", gender: "MALE", bg: "AB+", weight: "77", city: "Mysuru", district: "Mysuru", state: "Karnataka", pin: "570001", lat: "12.2958", lng: "76.6394", lastDonationDaysAgo: 45, total: 4, verified: true, health: "HEALTHY", avail: "AVAILABLE", radius: 25 },
    { name: "Divya Menon", mobile: "9811111116", email: "divya.m@example.com", dob: "1997-03-08", gender: "FEMALE", bg: "A-", weight: "52", city: "Mysuru", district: "Mysuru", state: "Karnataka", pin: "570001", lat: "12.3100", lng: "76.6500", lastDonationDaysAgo: null, total: 0, verified: false, health: "HEALTHY", avail: "AVAILABLE", radius: 10 },
    { name: "Karthik Rao", mobile: "9811111117", email: "karthik.r@example.com", dob: "1991-12-01", gender: "MALE", bg: "B-", weight: "69", city: "Mangaluru", district: "Dakshina Kannada", state: "Karnataka", pin: "575001", lat: "12.9141", lng: "74.8560", lastDonationDaysAgo: 200, total: 5, verified: true, health: "TEMPORARY_DEFERRAL", avail: "UNAVAILABLE", radius: 10, deferral: "Recent surgery — under temporary deferral" },
    { name: "Meena Iyer", mobile: "9811111118", email: "meena.i@example.com", dob: "1986-04-17", gender: "FEMALE", bg: "O+", weight: "61", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", pin: "560001", lat: "12.9758", lng: "77.6030", lastDonationDaysAgo: 400, total: 12, verified: true, health: "HEALTHY", avail: "AVAILABLE", radius: 30 },
    { name: "John D'Souza", mobile: "9811111119", email: "john.d@example.com", dob: "1999-08-25", gender: "MALE", bg: "B+", weight: "72", city: "Mumbai", district: "Mumbai", state: "Maharashtra", pin: "400050", lat: "19.0596", lng: "72.8295", lastDonationDaysAgo: null, total: 2, verified: true, health: "HEALTHY", avail: "AVAILABLE", radius: 15 },
    { name: "Ananya Gupta", mobile: "9811111120", email: "ananya.g@example.com", dob: "1994-06-14", gender: "FEMALE", bg: "AB-", weight: "57", city: "Pune", district: "Pune", state: "Maharashtra", pin: "411001", lat: "18.5204", lng: "73.8567", lastDonationDaysAgo: 60, total: 7, verified: true, health: "UNDER_REVIEW", avail: "AVAILABLE", radius: 10 },
    { name: "Mohammed Imran", mobile: "9811111121", email: "imran.m@example.com", dob: "1992-02-11", gender: "MALE", bg: "O+", weight: "80", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", pin: "560066", lat: "12.9750", lng: "77.7100", lastDonationDaysAgo: 10, total: 9, verified: true, health: "HEALTHY", avail: "AVAILABLE", radius: 8 },
    { name: "Deepa Kulkarni", mobile: "9811111122", email: "deepa.k@example.com", dob: "1989-10-05", gender: "FEMALE", bg: "A+", weight: "60", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", pin: "560001", lat: "12.9850", lng: "77.5900", lastDonationDaysAgo: 150, total: 2, verified: false, health: "HEALTHY", avail: "AVAILABLE", radius: 10 },
  ];

  const [donorRole] = await db.select().from(roles).where(eq(roles.name, "DONOR")).limit(1);
  const insertedDonorIds: number[] = [];

  for (const s of donorSeed) {
    const existing = await db.select().from(donors).where(eq(donors.mobile, s.mobile)).limit(1);
    if (existing.length > 0) {
      insertedDonorIds.push(existing[0].id);
      continue;
    }
    await db.insert(users).values({
      fullName: s.name,
      email: s.email,
      mobile: s.mobile,
      passwordHash: await hashPassword("donor123"),
      roleId: donorRole.id,
      status: "ACTIVE",
      isVerified: s.verified,
    });
    // MySQL has no RETURNING — fetch the row we just inserted.
    const [user] = await db.select().from(users).where(eq(users.mobile, s.mobile)).limit(1);
    await db.insert(userRoles).ignore().values({ userId: user.id, roleId: donorRole.id });

    const lastDonation = s.lastDonationDaysAgo !== null ? dateOnly(daysAgo(s.lastDonationDaysAgo)) : null;
    const nextEligible = lastDonation
      ? dateOnly(computeNextEligibleDate(lastDonation, "WHOLE_BLOOD", s.gender)!)
      : null;

    const registrationDate = daysAgo(120 + Math.floor(Math.random() * 300));
    const profileCompletion = s.verified ? 95 : 70;
    const status = computeDonorStatus({
      isProfileVerified: s.verified,
      totalDonations: s.total,
      daysSinceRegistration: Math.floor((Date.now() - registrationDate.getTime()) / 86400000),
      lastDonationDate: lastDonation,
      nextEligibleDate: nextEligible,
      healthStatus: s.health,
      availabilityStatus: s.avail,
    });

    const score = computeActivityScore({
      profileCompletion,
      isProfileVerified: s.verified,
      isMobileVerified: true,
      totalDonations: s.total,
      daysSinceRegistration: 200,
      daysSinceLastDonation: s.lastDonationDaysAgo,
      acceptedResponses: Math.min(s.total, 2),
      sentNotifications: Math.min(s.total + 1, 5),
      availabilityConfirmations: 3,
      lastAvailabilityConfirmationDays: 12,
    });

    await db.insert(donors).values({
      userId: user.id,
      fullName: s.name,
      mobile: s.mobile,
      email: s.email,
      dateOfBirth: new Date(s.dob + "T00:00:00Z"),
      gender: s.gender,
      bloodGroup: s.bg,
      weight: s.weight,
      addressCity: s.city,
      addressDistrict: s.district,
      addressState: s.state,
      pincode: s.pin,
      latitude: s.lat,
      longitude: s.lng,
      preferredRadiusKm: s.radius,
      lastDonationDate: lastDonation ? new Date(lastDonation + "T00:00:00Z") : null,
      donationType: "WHOLE_BLOOD",
      totalDonations: s.total,
      nextEligibleDate: nextEligible ? new Date(nextEligible + "T00:00:00Z") : null,
      availabilityStatus: s.avail,
      emergencyNotifications: true,
      preferredContact: "PHONE",
      isMobileVerified: true,
      isProfileVerified: s.verified,
      consentGiven: true,
      registrationDate,
      status,
      eligibilityStatus: s.health === "TEMPORARY_DEFERRAL" ? "TEMPORARILY_DEFERRED" : "ELIGIBLE",
      healthStatus: s.health,
      activityScore: score,
      profileCompletion,
    });
    // MySQL has no RETURNING — fetch the donor we just inserted.
    const [donor] = await db.select().from(donors).where(eq(donors.mobile, s.mobile)).limit(1);
    insertedDonorIds.push(donor.id);

    await db.insert(donorProfiles).ignore().values({
      donorId: donor.id,
      badges: s.total >= 10 ? ["REGULAR_DONOR", "LIFE_SAVER"] : s.total >= 5 ? ["REGULAR_DONOR"] : ["FIRST_DROP"],
      emergencyAvailability: s.avail === "AVAILABLE",
      lastAvailabilityConfirmation: daysAgo(12),
      nextAvailabilityConfirmation: daysAhead(18),
    });

    await db.insert(donorHealthRecords).values({
      donorId: donor.id,
      healthStatus: s.health,
      weight: s.weight,
      lastHealthConfirmation: daysAgo(30),
      healthDeclaration: true,
      screeningStatus: s.health === "HEALTHY" ? "CLEARED" : "UNDER_REVIEW",
      eligibilityRemarks: s.deferral ?? null,
      nextReviewDate: daysAhead(60),
    });
    // MySQL has no RETURNING — fetch the health record we just inserted.
    const [health] = await db.select().from(donorHealthRecords).where(eq(donorHealthRecords.donorId, donor.id)).limit(1);
    await db.insert(donorHealthHistory).ignore().values({
      donorId: donor.id,
      healthRecordId: health.id,
      status: s.health,
      remarks: "Initial health declaration recorded at registration",
      recordedBy: adminId,
    });

    await db.insert(donorAvailability).ignore().values({
      donorId: donor.id,
      available: s.avail === "AVAILABLE",
      confirmedAt: daysAgo(12),
      nextConfirmationDate: daysAhead(18),
      source: "SEED",
    });

    await db.insert(donorSchedules).ignore().values([
      ...(nextEligible
        ? [{ donorId: donor.id, type: "DONATION", scheduledDate: new Date(nextEligible + "T09:00:00Z"), status: "SCHEDULED", notes: "Next eligible donation date" }]
        : []),
      { donorId: donor.id, type: "AVAILABILITY", scheduledDate: daysAhead(18), status: "SCHEDULED", notes: "Availability confirmation due" },
      { donorId: donor.id, type: "HEALTH_REVIEW", scheduledDate: daysAhead(60), status: "SCHEDULED", notes: "Periodic health confirmation" },
    ]);

    await db.insert(consents).ignore().values({
      donorId: donor.id,
      consentType: "DATA_PROCESSING",
      given: true,
      givenAt: registrationDate,
      version: "1.0",
    });

    // Donation history + certificates for experienced donors
    if (s.total > 0) {
      for (let i = 0; i < Math.min(s.total, 3); i++) {
        const donationDate = dateOnly(daysAgo(s.lastDonationDaysAgo !== null ? s.lastDonationDaysAgo + i * 120 : 120 + i * 120));
        await db.insert(donations).values({
          donorId: donor.id,
          donationDate: new Date(donationDate + "T00:00:00Z"),
          donationType: "WHOLE_BLOOD",
          hospitalId: 1,
          units: "0.45",
          verified: true,
          status: "COMPLETED",
        });
        // MySQL has no RETURNING — fetch the donation we just inserted.
        const [donation] = await db.select().from(donations).where(eq(donations.donorId, donor.id)).orderBy(desc(donations.id)).limit(1);
        const certStatus = i === 0 ? (s.total > 2 ? "RECEIVED" : "ISSUED") : "VERIFIED";
        await db.insert(donationCertificates).ignore().values({
          donationId: donation.id,
          donorId: donor.id,
          certificateNumber: generateCertificateNumber(donation.id),
          status: certStatus,
          issuedDate: daysAgo(100 + i * 120),
          receivedDate: certStatus === "RECEIVED" || certStatus === "VERIFIED" ? daysAgo(90 + i * 120) : null,
          verifiedDate: certStatus === "VERIFIED" ? daysAgo(80 + i * 120) : null,
        });
      }
    }
  }

  // 9. Volunteer assignments ---------------------------------------------------
  const allVolunteers = await db.select().from(volunteers);
  for (const v of allVolunteers) {
    if (!v.district) continue;
    const districtDonors = await db.select().from(donors).where(eq(donors.addressDistrict, v.district)).limit(3);
    for (const d of districtDonors) {
      await db.insert(volunteerAssignments).ignore().values({
        volunteerId: v.id, donorId: d.id, assignmentType: "DONOR_SUPPORT", status: "PENDING",
      });
      await db.update(donors).set({ assignedVolunteerId: v.id }).where(eq(donors.id, d.id));
    }
  }

  // 10. Demo blood requests + notification waves -------------------------------
  const oPosDonors = await db.select().from(donors).where(eq(donors.bloodGroup, "O+")).limit(5);
  if (oPosDonors.length > 0) {
    await db.insert(bloodRequests).values({
      requesterName: "City Care Hospital — Blood Bank Desk",
      requesterPhone: "08025550101",
      bloodGroup: "O+",
      unitsRequired: 3,
      hospitalId: 1,
      hospitalName: "City Care Hospital",
      hospitalLocation: "MG Road, Bengaluru",
      city: "Bengaluru",
      district: "Bengaluru Urban",
      latitude: "12.9758",
      longitude: "77.6030",
      requiredAt: daysAhead(1),
      urgency: "CRITICAL",
      contactInfo: "08025550101",
      details: "Thalassemia patient needs 3 units of O+ within 24 hours.",
      status: "DONORS_NOTIFIED",
      currentWave: 1,
      donorsNotified: oPosDonors.length,
    });
    // MySQL has no RETURNING — fetch the request we just inserted.
    const [req] = await db.select().from(bloodRequests).orderBy(desc(bloodRequests.id)).limit(1);
    for (const d of oPosDonors) {
      await db.insert(requestNotifications).ignore().values({
        requestId: req.id, donorId: d.id, wave: 1, status: "SENT", distanceKm: "5.20",
      });
      await db.insert(notifications).ignore().values({
        donorId: d.id,
        type: "EMERGENCY_REQUEST",
        title: "🩸 Emergency: O+ blood needed in Bengaluru",
        message: "3 units of O+ needed at City Care Hospital, Bengaluru within 24 hours. Urgency: CRITICAL.",
      });
    }
  }
}

interface Migration {
  name: string;
  run: MigrationFn;
}

const MIGRATIONS: Migration[] = [
  { name: "001_seed_roles_admin_settings", run: runSeedMigrations },
];

export async function initDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    // 0. Create the database + apply pending Drizzle migrations first, so a
    // fresh device ends up with all tables automatically.
    try {
      await ensureSchema();
    } catch (err) {
      throw new Error(
        `Schema setup failed: ${err instanceof Error ? err.message : String(err)} ` +
          `(is MySQL running? check DATABASE_URL in .env)`,
      );
    }

    // Verify the database connection first.
    await db.execute(sql`select 1`);

    // Migrations bookkeeping table (created with raw SQL so it works even
    // before the Drizzle schema push has run).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(190) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migration of MIGRATIONS) {
      const [done] = await db.select().from(migrations).where(eq(migrations.name, migration.name)).limit(1);
      if (done) continue;
      console.log(`[db] running migration: ${migration.name}`);
      await migration.run();
      await db.insert(migrations).ignore().values({ name: migration.name });
      console.log(`[db] migration completed: ${migration.name}`);
    }

    return { ok: true };
  } catch (err) {
    console.error("[db] initialization failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
