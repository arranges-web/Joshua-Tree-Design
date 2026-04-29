import app from "./app";
import { logger } from "./lib/logger";
import { syncDefaultPermissionMatrix } from "./lib/rbac/syncMatrix";
import { seedIfEmpty, backfillFleetData } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run startup tasks that must complete before the server accepts requests.
// Auto-seed first (fail-fast on error), then sync the permissions matrix.
async function startup() {
  // Auto-seed demo data when the database is empty (production first boot).
  // Checks if the users table is empty; inserts all demo data if so.
  // Safe to call every restart — it is a no-op when data already exists.
  const seeded = await seedIfEmpty();
  if (seeded) {
    logger.info("Database was empty — seed data inserted on first boot.");
  }

  // Mirror the in-code default permission matrix into the DB so admins can
  // override it via the toggle panel without redeploys. Existing rows are
  // never overwritten; only missing (role, section) pairs are inserted.
  try {
    await syncDefaultPermissionMatrix();
  } catch (err) {
    logger.error({ err }, "Failed to sync default permission matrix on boot");
  }

  // Enrich existing fleet rows with the new asset-registry fields. Idempotent.
  try {
    await backfillFleetData();
  } catch (err) {
    logger.error({ err }, "Failed to backfill fleet data on boot");
  }
}

startup()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Startup failed — server will not start");
    process.exit(1);
  });
