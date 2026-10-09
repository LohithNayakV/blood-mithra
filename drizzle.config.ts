import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Credentials come from the environment so the same config works on every
// device (local XAMPP, shared dev DB, production). Falls back to the local
// XAMPP defaults when nothing is set.
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
      // fall through to individual vars below
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

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: credentials(),
});
