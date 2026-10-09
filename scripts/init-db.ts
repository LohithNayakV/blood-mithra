import "dotenv/config";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import mysql from "mysql2/promise";

// ---------------------------------------------------------------------------
// Safe database setup: creates the database if missing, then applies every
// pending migration from drizzle/ in journal order. Already-applied files
// (or files whose tables already exist) are skipped, so it is idempotent —
// run it on any device without fear.
//
//   node scripts/init-db.ts            # create + migrate (safe, default)
//   node scripts/init-db.ts --fresh    # DROP + recreate from scratch (dev only)
//
// Note: `npm run dev` / `npm start` already run this automatically on server
// start (src/db/init.ts), so you only need this script for manual control.
// ---------------------------------------------------------------------------

function credentials() {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname || "127.0.0.1",
        port: Number(u.port || "3306"),
        user: decodeURIComponent(u.username || "root"),
        password: decodeURIComponent(u.password || ""),
        database: decodeURIComponent(u.pathname.replace(/^\//, "") || "app_db"),
      };
    } catch {
      // fall through to individual vars
    }
  }
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "app_db",
  };
}

async function initDatabase() {
  const creds = credentials();
  const fresh = process.argv.includes("--fresh");
  const migrationsFolder = join(process.cwd(), "drizzle");

  const server = await mysql.createConnection({
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
    multipleStatements: true,
  });
  try {
    if (fresh) {
      console.log(`Dropping and recreating database \`${creds.database}\`...`);
      await server.query(`DROP DATABASE IF EXISTS \`${creds.database}\``);
    }
    await server.query(`CREATE DATABASE IF NOT EXISTS \`${creds.database}\``);
  } finally {
    await server.end();
  }

  const conn = await mysql.createConnection({
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
    database: creds.database,
    multipleStatements: true,
  });
  try {
    const journalPath = join(migrationsFolder, "meta", "_journal.json");
    if (!existsSync(journalPath)) throw new Error("drizzle/meta/_journal.json not found — run `npm run db:generate` first");
    const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
      entries: { tag: string; when: number }[];
    };

    await conn.query(
      "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (id serial primary key, hash text not null, created_at bigint)",
    );
    const [appliedRows] = (await conn.query("SELECT created_at FROM `__drizzle_migrations`")) as unknown as [
      { created_at: number | string }[],
    ];
    const applied = new Set(appliedRows.map((r) => Number(r.created_at)));

    let appliedCount = 0;
    let skippedCount = 0;

    for (const entry of journal.entries) {
      if (applied.has(entry.when)) {
        console.log(`- skip ${entry.tag} (already applied)`);
        skippedCount++;
        continue;
      }
      const sqlText = readFileSync(join(migrationsFolder, `${entry.tag}.sql`), "utf-8");
      const tables = [
        ...new Set(
          [...sqlText.matchAll(/create table\s+`?([A-Za-z0-9_]+)`?/gi)].map((m) => m[1].toLowerCase()),
        ),
      ];
      if (tables.length > 0) {
        const [existing] = (await conn.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN (?)",
          [creds.database, tables],
        )) as unknown as [{ table_name: string }[]];
        const found = new Set(existing.map((r) => String(r.table_name).toLowerCase()));
        if (tables.every((t) => found.has(t))) {
          const hash = createHash("sha256").update(sqlText).digest("hex");
          await conn.query("INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)", [
            hash,
            entry.when,
          ]);
          console.log(`- baseline ${entry.tag} (tables already exist)`);
          skippedCount++;
          continue;
        }
      }

      const statements = sqlText
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const statement of statements) {
        try {
          await conn.query(statement);
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code === "ER_TABLE_EXISTS_ERROR") {
            console.log(`  (table already exists, continuing)`);
            continue;
          }
          throw err;
        }
      }
      const hash = createHash("sha256").update(sqlText).digest("hex");
      await conn.query("INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)", [
        hash,
        entry.when,
      ]);
      console.log(`+ applied ${entry.tag} (${statements.length} statements)`);
      appliedCount++;
    }

    console.log(`\nDone. Applied: ${appliedCount}, skipped/baselined: ${skippedCount}.`);
    console.log("Start the app to finish seeding demo data automatically (or it is already seeded).");
  } finally {
    await conn.end();
  }
}

initDatabase().catch((err) => {
  console.error("Database initialization failed:", err instanceof Error ? err.message : err);
  console.error("Is MySQL running? Check DATABASE_URL in .env (default: mysql://root:@127.0.0.1:3306/app_db for XAMPP).");
  process.exit(1);
});
