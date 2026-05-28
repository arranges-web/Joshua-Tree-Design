/**
 * One-time migration: reads the real asset spreadsheet and updates equipment
 * rows with (a) location from the "Site" column and (b) purchasePriceCents
 * from the "Cost" column (only where currently null in the DB).
 *
 * Run from workspace root:
 *   npx tsx scripts/apply-spreadsheet-data.ts
 */

import * as path from "path";
import * as XLSX from "xlsx";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull } from "drizzle-orm";
import { equipmentTable } from "../lib/db/src/schema/fleet";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL env var is required");

const client = postgres(DATABASE_URL);
const db = drizzle(client);

const XLSX_PATH = path.resolve(
  __dirname,
  "../attached_assets/asset-3_1779978906385.xlsx",
);

interface SpreadsheetRow {
  serial: string;
  site: string;
  cost: string | number | undefined;
}

function parseCentValue(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[,$]/g, ""));
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

async function main() {
  console.log("Reading spreadsheet…");
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const spreadsheetRows: SpreadsheetRow[] = rawRows
    .map((r) => ({
      serial: String(r["Serial No"] ?? "").trim(),
      site: String(r["Site"] ?? "").trim(),
      cost: r["Cost"] as string | number | undefined,
    }))
    .filter((r) => r.serial !== "" && r.site !== "");

  console.log(`  ${spreadsheetRows.length} rows with serial + site`);

  // Build lookup: serial → { site, costCents }
  const bySerial = new Map<string, { site: string; costCents: number | null }>();
  for (const row of spreadsheetRows) {
    bySerial.set(row.serial.toLowerCase(), {
      site: row.site,
      costCents: parseCentValue(row.cost),
    });
  }

  console.log("Loading equipment from DB…");
  const equipment = await db.select({
    id: equipmentTable.id,
    name: equipmentTable.name,
    serial: equipmentTable.serial,
    location: equipmentTable.location,
    purchasePriceCents: equipmentTable.purchasePriceCents,
  }).from(equipmentTable);

  console.log(`  ${equipment.length} equipment rows in DB`);

  let locationUpdated = 0;
  let locationSkipped = 0;
  let priceUpdated = 0;
  let priceSkipped = 0;
  let noMatch = 0;

  for (const eq_row of equipment) {
    const serial = (eq_row.serial ?? "").trim().toLowerCase();
    const match = bySerial.get(serial);

    if (!match) {
      noMatch++;
      continue;
    }

    const patch: Record<string, unknown> = {};

    // Always set location from spreadsheet Site column
    if (match.site && eq_row.location !== match.site) {
      patch.location = match.site;
      locationUpdated++;
    } else {
      locationSkipped++;
    }

    // Only fill purchase price if currently null
    if (match.costCents !== null && eq_row.purchasePriceCents === null) {
      patch.purchasePriceCents = match.costCents;
      priceUpdated++;
    } else {
      priceSkipped++;
    }

    if (Object.keys(patch).length > 0) {
      await db.update(equipmentTable).set(patch).where(eq(equipmentTable.id, eq_row.id));
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Location updates:  ${locationUpdated}`);
  console.log(`Location skipped:  ${locationSkipped} (already set or no change)`);
  console.log(`Price updates:     ${priceUpdated}`);
  console.log(`Price skipped:     ${priceSkipped} (already set or no spreadsheet value)`);
  console.log(`No serial match:   ${noMatch}`);
  console.log("\nDone.");

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
