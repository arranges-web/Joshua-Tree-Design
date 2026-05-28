/**
 * Idempotent real-crew import for Joshua Tree Inc.
 *
 * Reads the spreadsheet at attached_assets/asset-3_1779978906385.xlsx,
 * replaces any remaining placeholder demo crews (those whose names match
 * the known demo set), creates the 22 real crews from the asset inventory,
 * assigns equipment to each crew by serial number, and marks "Broken" items
 * as RETIRED.
 *
 * Guard: if a crew named "Melecio" already exists the import has already
 * run — the function returns immediately without touching any data.
 *
 * Safe to call on every boot.
 */

import path from "path";
import { fileURLToPath } from "url";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { crewsTable, equipmentTable } from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.resolve(
  __dirname,
  "../../../attached_assets/asset-3_1779978906385.xlsx",
);

const DEMO_CREW_NAMES = [
  "Sales Crew",
  "Lawn Crew",
  "Landscape Crew",
  "Pest Crew",
  "Tree Crew",
  "Tree Crew 1",
  "Tree Crew 2",
  "Land Crew 1",
  "Land Crew 2",
  "Lawn Crew 1",
  "Lawn Crew 2",
  "Pest Crew 1",
  "Pest Crew 2",
  "Fertilization Crew",
];

function normalizeCrewName(raw: string): string {
  const s = raw.trim();
  const l = s.toLowerCase();
  if (l === "melesio" || l === "melecio") return "Melecio";
  if (l === "anrhony" || l === "anthony") return "Anthony";
  if (l === "yoselande" || l === "yoslande") return "Yoslande";
  if (l.includes("tim") && l.includes("tree")) return "Tim's Trees";
  if (l === "rob c") return "Rob C";
  if (l === "jeff long") return "Jeff Long";
  if (l === "adrian - grapple") return "Adrian (Grapple)";
  if (l === "miguel a") return "Miguel A";
  return s;
}

interface SerialEntry {
  crewName: string | null;
  isBroken: boolean;
}

async function parseXlsx(): Promise<Map<string, SerialEntry>> {
  const XLSX = (await import("xlsx")).default;
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets["Asset"];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

  const headers = rows[0] as string[];
  const serialIdx = headers.indexOf("Serial No");
  const crewIdx = headers.indexOf("Crew");

  const map = new Map<string, SerialEntry>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const rawSerial = row[serialIdx];
    const rawCrew = row[crewIdx];

    if (!rawSerial) continue;
    const serial = String(rawSerial).trim();
    if (!serial) continue;

    if (rawCrew && String(rawCrew).trim()) {
      const crewRaw = String(rawCrew).trim();
      if (crewRaw.toLowerCase() === "broken") {
        map.set(serial, { crewName: null, isBroken: true });
      } else {
        map.set(serial, {
          crewName: normalizeCrewName(crewRaw),
          isBroken: false,
        });
      }
    }
  }

  return map;
}

export async function importRealCrews(): Promise<void> {
  // Guard: skip if real crews are already loaded
  const sentinel = await db
    .select({ id: crewsTable.id })
    .from(crewsTable)
    .where(eq(crewsTable.name, "Melecio"))
    .limit(1);

  if (sentinel.length > 0) {
    return; // already imported
  }

  // Parse XLSX (may not exist in all environments)
  let serialMap: Map<string, SerialEntry>;
  try {
    serialMap = await parseXlsx();
  } catch {
    // XLSX not present (e.g. production deploy without attached_assets).
    // Skip silently — the DB may already have been seeded manually.
    return;
  }

  // ── 1. Null out existing equipment assignments so FK constraint is safe ──
  await db.update(equipmentTable).set({ assignedCrewId: null });

  // ── 2. Delete any lingering demo/placeholder crews ──────────────────────
  await db
    .delete(crewsTable)
    .where(inArray(crewsTable.name, DEMO_CREW_NAMES));

  // ── 3. Collect unique crew names from the spreadsheet ───────────────────
  const crewNameSet = new Set<string>();
  for (const entry of serialMap.values()) {
    if (entry.crewName) crewNameSet.add(entry.crewName);
  }
  const crewNames = [...crewNameSet].sort();

  // ── 4. Pick the fallback lead user (admin user, id=1 equivalent) ────────
  const [adminUser] = await db.execute<{ id: number }>(
    sql`SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE key = 'ADMIN') ORDER BY id LIMIT 1`,
  );
  const leadId: number = adminUser?.id ?? 1;

  // ── 5. Insert real crews ─────────────────────────────────────────────────
  const inserted = await db
    .insert(crewsTable)
    .values(crewNames.map((name) => ({ name, leadUserId: leadId })))
    .returning({ id: crewsTable.id, name: crewsTable.name });

  // Build name→id map
  const crewMap = new Map<string, number>(
    inserted.map((c) => [c.name, c.id]),
  );

  // ── 6. Build bulk assignment arrays ─────────────────────────────────────
  const assignments: { serial: string; crewId: number }[] = [];
  const brokenSerials: string[] = [];

  for (const [serial, entry] of serialMap.entries()) {
    if (entry.isBroken) {
      brokenSerials.push(serial);
    } else if (entry.crewName) {
      const crewId = crewMap.get(entry.crewName);
      if (crewId) assignments.push({ serial, crewId });
    }
  }

  // ── 7. Assign equipment to crews (single UPDATE…FROM VALUES) ────────────
  if (assignments.length > 0) {
    const values = assignments
      .map((a) => `('${a.serial.replace(/'/g, "''")}', ${a.crewId})`)
      .join(", ");
    await db.execute(
      sql.raw(`
        UPDATE equipment
        SET assigned_crew_id = v.crew_id::integer
        FROM (VALUES ${values}) AS v(serial_no, crew_id)
        WHERE LOWER(TRIM(equipment.serial)) = LOWER(TRIM(v.serial_no))
      `),
    );
  }

  // ── 8. Mark "Broken" items as RETIRED ───────────────────────────────────
  if (brokenSerials.length > 0) {
    const brokenList = brokenSerials
      .map((s) => `'${s.replace(/'/g, "''")}'`)
      .join(", ");
    await db.execute(
      sql.raw(
        `UPDATE equipment SET status = 'RETIRED' WHERE LOWER(TRIM(serial)) IN (${brokenList.toLowerCase()})`,
      ),
    );
  }
}
