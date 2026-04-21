import app from "./app";
import { logger } from "./lib/logger";
import { syncDefaultPermissionMatrix } from "./lib/rbac/syncMatrix";

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

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Mirror the in-code default permission matrix into the DB so admins can
  // override it via the toggle panel without redeploys. Existing rows are
  // never overwritten; only missing (role, section) pairs are inserted.
  try {
    await syncDefaultPermissionMatrix();
  } catch (err) {
    logger.error({ err }, "Failed to sync default permission matrix on boot");
  }
});
