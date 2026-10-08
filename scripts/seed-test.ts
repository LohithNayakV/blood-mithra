import "dotenv/config";
import { initDatabase } from "@/db/init";
import { db } from "@/db";
import { donors, users, bloodRequests, volunteers, bloodCamps, donations, donationCertificates } from "@/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const result = await initDatabase();
  console.log("init:", result);
  // Run twice to prove idempotency
  const again = await initDatabase();
  console.log("init (2nd run):", again);
  console.log("donors:", await db.select({ c: sql<number>`count(*)` }).from(donors));
  console.log("users:", await db.select({ c: sql<number>`count(*)` }).from(users));
  console.log("requests:", await db.select({ c: sql<number>`count(*)` }).from(bloodRequests));
  console.log("volunteers:", await db.select({ c: sql<number>`count(*)` }).from(volunteers));
  console.log("camps:", await db.select({ c: sql<number>`count(*)` }).from(bloodCamps));
  console.log("donations:", await db.select({ c: sql<number>`count(*)` }).from(donations));
  console.log("certificates:", await db.select({ c: sql<number>`count(*)` }).from(donationCertificates));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
