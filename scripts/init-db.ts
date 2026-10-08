import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { join } from "path";

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "",
    multipleStatements: true,
  });

  // Drop and recreate database
  console.log("Recreating database...");
  await connection.query("DROP DATABASE IF EXISTS app_db");
  await connection.query("CREATE DATABASE app_db");
  await connection.query("USE app_db");

  // Set SQL mode to allow more flexible timestamp handling
  await connection.query("SET sql_mode = ''");

  // Read and execute the migration SQL
  const sqlPath = join(process.cwd(), "drizzle", "0000_stiff_jackal.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  // Split by statement-breakpoint comments and execute each statement
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let createdTables = 0;

  for (const statement of statements) {
    try {
      await connection.query(statement);
      createdTables++;
      console.log(`✓ Created: ${statement.split('\n')[0].substring(0, 60).trim()}...`);
    } catch (err: any) {
      console.error(`✗ Error: ${err.message}`);
    }
  }

  await connection.end();
  console.log(`\n✓ Database initialized! Created ${createdTables} tables/statements.`);
}

initDatabase().catch((err) => {
  console.error("Database initialization failed:", err);
  process.exit(1);
});
