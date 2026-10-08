// Next.js instrumentation hook — runs once when the server runtime starts.
// Performs self-initialization: verifies the MySQL connection, tracks
// migrations in the `migrations` table, and seeds default roles, settings,
// geography and demo data exactly once.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { initDatabase } = await import("@/db/init");
    const result = await initDatabase();
    if (result.ok) {
      console.log("[blood-mithra] database initialized and verified");
    } else {
      console.error("[blood-mithra] database initialization error:", result.error);
    }
  } catch (err) {
    // Never block server startup on initialization errors.
    console.error("[blood-mithra] initialization hook failed:", err);
  }
}
