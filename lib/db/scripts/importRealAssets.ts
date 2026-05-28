/* eslint-disable no-console */
/**
 * One-shot importer that replaces *fleet* data (trucks + equipment +
 * maintenance + checkouts + audit logs) with real customer data
 * transcribed from the insurance schedule + asset-3.xlsx spreadsheet.
 *
 * Leaves users, customers, jobs, quotes, invoices alone — we only
 * touch the fleet tables.
 *
 * Run:
 *   DATABASE_URL=... pnpm --filter @workspace/db run import-real-assets
 *
 * Idempotent: re-running re-truncates and re-inserts. Use
 * --keep-existing to skip the truncate step if you only want to upsert.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db, trucksTable, equipmentTable, departmentsTable } from "../src";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");

type TruckRow = {
  vehNum: number;
  year: number;
  brand: string;
  model: string | null;
  bodyType: string;
  vin: string;
  statedValueCents: number;
  gvwLbs: number;
};

type HeavyEquipRow = {
  name: string;
  brand: string;
  model: string;
  serial: string;
  year: number;
  purchasePriceCents: number;
  site: string;
  department: "TreeService" | "Lawn";
  description: string;
};

type HandheldRow = {
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  purchaseDate: string | null;
  purchasePriceCents: number | null;
  purchasedFrom: string | null;
  site: string | null;
  department: "TreeService" | "Lawn" | null;
  holderName: string | null;
  status: string;
  notes?: string;
};

// Body-type to vehicle/department heuristics. The insurance schedule
// uses TK / PU / DMPTK / OT / SUV / CRGVN / OTHB for vehicles and
// SRVT / T for trailers. We default everything to TRUCK unless the
// body type is clearly a trailer.
function classify(body: string): { vehicleType: "TRUCK" | "TRAILER" } {
  if (body === "SRVT" || body === "T") return { vehicleType: "TRAILER" };
  return { vehicleType: "TRUCK" };
}

// Department assignment for trucks is harder to infer from a VIN
// alone, so we default to TreeService (the biggest user of heavy
// trucks). Bigfoot trailers + PJ trailers are shared across crews
// but we pin them to TreeService too for now — the team can re-home
// individual rows via the admin UI once they log in.
function deptForTruck(brand: string, model: string | null): "TreeService" | "Lawn" {
  const m = `${brand} ${model ?? ""}`.toLowerCase();
  // Smaller pickups + SUVs typically ride with the lawn crews;
  // anything CDL-class stays with tree.
  if (/(silverado|tacoma|colorado|blazer|expedition|sierra|ram 2500|f250|econoline)/i.test(m)) {
    return "Lawn";
  }
  return "TreeService";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

function makeAssetSlug(kind: "truck" | "equip", id: number, name: string) {
  const base = slugify(name) || kind;
  return `${kind}-${id}-${base}`;
}

async function main() {
  const keepExisting = process.argv.includes("--keep-existing");

  const trucks = JSON.parse(
    readFileSync(join(DATA_DIR, "trucks-import.json"), "utf8"),
  ) as TruckRow[];
  const heavy = JSON.parse(
    readFileSync(join(DATA_DIR, "heavy-equipment-import.json"), "utf8"),
  ) as HeavyEquipRow[];
  const handhelds = JSON.parse(
    readFileSync(join(DATA_DIR, "equipment-import.json"), "utf8"),
  ) as HandheldRow[];

  console.log(
    `Loaded: ${trucks.length} trucks/trailers · ${heavy.length} heavy equipment · ${handhelds.length} handheld`,
  );

  // Resolve departments by key so we never depend on a brittle id.
  const depts = await db
    .select({ id: departmentsTable.id, key: departmentsTable.key })
    .from(departmentsTable);
  const deptByKey = new Map(depts.map((d) => [d.key, d.id]));
  const dTree = deptByKey.get("TreeService");
  const dLawn = deptByKey.get("Lawn");
  if (!dTree || !dLawn) {
    throw new Error(
      `Missing required departments (need TreeService + Lawn). Run backfillDepartments first. Got: ${[...deptByKey.keys()].join(", ")}`,
    );
  }

  if (!keepExisting) {
    console.log("Wiping fleet tables…");
    await db.execute(sql`TRUNCATE
      asset_checkouts,
      asset_assignment_log,
      asset_status_log,
      usage_readings,
      maintenance_logs,
      equipment_items,
      equipment,
      trucks
      RESTART IDENTITY CASCADE`);
  }

  // ─── Trucks + trailers ───────────────────────────────────────────
  console.log("Inserting trucks/trailers…");
  let truckCount = 0;
  for (const t of trucks) {
    const { vehicleType } = classify(t.bodyType);
    const deptKey = deptForTruck(t.brand, t.model);
    const departmentId = deptKey === "Lawn" ? dLawn : dTree;
    const namePieces = [
      `#${t.vehNum}`,
      `${t.year}`,
      t.brand,
      t.model ?? "",
    ].filter(Boolean);
    const name = namePieces.join(" ").replace(/\s+/g, " ").trim();
    const [row] = await db
      .insert(trucksTable)
      .values({
        name,
        vehicleType,
        brand: t.brand,
        model: t.model ?? null,
        vin: t.vin,
        status: "ACTIVE",
        departmentId,
        purchasePriceCents: t.statedValueCents,
        // Insurance schedules don't track a purchase date — store
        // year-only as Jan 1 of the model year so the per-asset
        // "Purchased" stat has something meaningful to show.
        purchaseDate: new Date(t.year, 0, 1),
        currentMileage: 0,
        serviceIntervalMiles: 5000,
      })
      .returning({ id: trucksTable.id });
    if (row) {
      await db
        .update(trucksTable)
        .set({ slug: makeAssetSlug("truck", row.id, name) })
        .where(sql`${trucksTable.id} = ${row.id}`);
      truckCount++;
    }
  }
  console.log(`  ✓ ${truckCount} trucks/trailers`);

  // ─── Heavy equipment (Dingos, lift, skid steer, track loader) ────
  console.log("Inserting heavy equipment…");
  let heavyCount = 0;
  for (const e of heavy) {
    const departmentId = e.department === "Lawn" ? dLawn : dTree;
    const [row] = await db
      .insert(equipmentTable)
      .values({
        name: e.name,
        type: e.description,
        category: "CUSTOM",
        customCategoryLabel: "Heavy Equipment",
        quantity: 1,
        brand: e.brand,
        model: e.model,
        serial: e.serial,
        status: "ACTIVE",
        departmentId,
        purchasePriceCents: e.purchasePriceCents,
        purchaseDate: new Date(e.year, 0, 1),
        currentHours: 0,
        serviceIntervalHours: 250,
      })
      .returning({ id: equipmentTable.id });
    if (row) {
      await db
        .update(equipmentTable)
        .set({ slug: makeAssetSlug("equip", row.id, e.name) })
        .where(sql`${equipmentTable.id} = ${row.id}`);
      heavyCount++;
    }
  }
  console.log(`  ✓ ${heavyCount} heavy equipment`);

  // ─── Handheld equipment from asset-3.xlsx ────────────────────────
  // Stored as HANDHELD category; the spreadsheet "Crew" column holds
  // first-name labels (Melecio, Wilber, etc.) — we stash those in
  // notes since they aren't real user accounts. Once the team
  // creates user records, the per-asset Checkout flow can replace
  // these labels with real checkouts.
  console.log("Inserting handheld equipment…");
  let handheldCount = 0;
  for (const h of handhelds) {
    const departmentId = h.department === "Lawn" ? dLawn : dTree;
    const noteBits: string[] = [];
    if (h.holderName) noteBits.push(`Held by: ${h.holderName}`);
    if (h.purchasedFrom) noteBits.push(`Bought from: ${h.purchasedFrom}`);
    if (h.notes) noteBits.push(h.notes);
    const notes = noteBits.join(" · ") || null;
    const status =
      h.status === "IN_SHOP" || h.status === "RETIRED" ? h.status : "ACTIVE";
    const [row] = await db
      .insert(equipmentTable)
      .values({
        name: h.name,
        type: h.model ?? h.name,
        category: "HANDHELD",
        quantity: 1,
        brand: h.brand,
        model: h.model,
        serial: h.serial,
        status: status as "ACTIVE" | "IN_SHOP" | "RETIRED",
        departmentId,
        purchasePriceCents: h.purchasePriceCents,
        purchaseDate: h.purchaseDate ? new Date(h.purchaseDate) : null,
        currentHours: 0,
        serviceIntervalHours: 100,
      })
      .returning({ id: equipmentTable.id });
    if (row) {
      // The notes column lives on maintenance_logs, not equipment.
      // We surface the holder label in the equipment name suffix
      // when present, so it's visible in the registry table without
      // a schema change.
      const finalName = notes ? `${h.name} [${notes}]` : h.name;
      await db
        .update(equipmentTable)
        .set({
          slug: makeAssetSlug("equip", row.id, h.name),
          name: finalName,
        })
        .where(sql`${equipmentTable.id} = ${row.id}`);
      handheldCount++;
    }
  }
  console.log(`  ✓ ${handheldCount} handheld equipment`);

  console.log("\nImport complete.");
  console.log(
    `  trucks/trailers: ${truckCount} · heavy: ${heavyCount} · handheld: ${handheldCount} · total assets: ${truckCount + heavyCount + handheldCount}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
