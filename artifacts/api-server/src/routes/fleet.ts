import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  db,
  trucksTable,
  equipmentTable,
  maintenanceLogsTable,
  usageReadingsTable,
} from "@workspace/db";
import {
  CreateTruckBody,
  UpdateTruckBody,
  UpdateTruckParams,
  DeleteTruckParams,
  CreateEquipmentBody,
  UpdateEquipmentBody,
  UpdateEquipmentParams,
  DeleteEquipmentParams,
  CreateMaintenanceLogBody,
  UpdateMaintenanceLogBody,
  UpdateMaintenanceLogParams,
  DeleteMaintenanceLogParams,
  GetAssetBySlugParams,
  CreateUsageReadingBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection, hasSectionAccess } from "../middlewares/requireSection";

const router: IRouter = Router();

type FleetStatus = "ACTIVE" | "IN_SHOP" | "RETIRED";
type MaintenanceKind = "SCHEDULED" | "REPAIR" | "INSPECTION";

// Helper — slugify a name into a stable URL fragment.
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

// ---------- Trucks ----------
router.get(
  "/trucks",
  requireAuth,
  requireSection("fleet.trucks", "view"),
  async (_req, res) => {
    const rows = await db.select().from(trucksTable).limit(500);
    res.json({ trucks: rows });
  },
);

router.post(
  "/trucks",
  requireAuth,
  requireSection("fleet.trucks", "edit"),
  async (req, res) => {
    const parsed = CreateTruckBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const d = parsed.data;
    const [row] = await db
      .insert(trucksTable)
      .values({
        name: d.name,
        brand: d.brand ?? null,
        model: d.model ?? null,
        vin: d.vin ?? null,
        plate: d.plate ?? null,
        status: d.status as FleetStatus,
        assignedCrewId: d.assignedCrewId ?? null,
        purchasePriceCents: d.purchasePriceCents ?? null,
        purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : null,
        ...(d.currentMileage != null ? { currentMileage: d.currentMileage } : {}),
        ...(d.serviceIntervalMiles != null
          ? { serviceIntervalMiles: d.serviceIntervalMiles }
          : {}),
      })
      .returning();
    if (row) {
      const slug = makeAssetSlug("truck", row.id, row.name);
      const [updated] = await db
        .update(trucksTable)
        .set({ slug })
        .where(eq(trucksTable.id, row.id))
        .returning();
      res.status(201).json({ truck: updated ?? row });
      return;
    }
    res.status(500).json({ error: "insert_failed" });
  },
);

router.patch(
  "/trucks/:id",
  requireAuth,
  requireSection("fleet.trucks", "edit"),
  async (req, res) => {
    const params = UpdateTruckParams.safeParse({ id: Number(req.params.id) });
    const body = UpdateTruckBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const d = body.data;
    const [row] = await db
      .update(trucksTable)
      .set({
        name: d.name,
        brand: d.brand ?? null,
        model: d.model ?? null,
        vin: d.vin ?? null,
        plate: d.plate ?? null,
        ...(d.status ? { status: d.status as FleetStatus } : {}),
        assignedCrewId: d.assignedCrewId ?? null,
        purchasePriceCents: d.purchasePriceCents ?? null,
        purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : null,
        ...(d.currentMileage != null ? { currentMileage: d.currentMileage } : {}),
        ...(d.serviceIntervalMiles != null
          ? { serviceIntervalMiles: d.serviceIntervalMiles }
          : {}),
      })
      .where(eq(trucksTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ truck: row });
  },
);

router.delete(
  "/trucks/:id",
  requireAuth,
  requireSection("fleet.trucks", "edit"),
  async (req, res) => {
    const params = DeleteTruckParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const deleted = await db
      .delete(trucksTable)
      .where(eq(trucksTable.id, params.data.id))
      .returning({ id: trucksTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  },
);

// ---------- Equipment ----------
router.get(
  "/equipment",
  requireAuth,
  requireSection("fleet.equipment", "view"),
  async (_req, res) => {
    const rows = await db.select().from(equipmentTable).limit(500);
    res.json({ equipment: rows });
  },
);

router.post(
  "/equipment",
  requireAuth,
  requireSection("fleet.equipment", "edit"),
  async (req, res) => {
    const parsed = CreateEquipmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const d = parsed.data;
    const [row] = await db
      .insert(equipmentTable)
      .values({
        name: d.name,
        type: d.type,
        brand: d.brand ?? null,
        model: d.model ?? null,
        serial: d.serial ?? null,
        status: d.status as FleetStatus,
        assignedTruckId: d.assignedTruckId ?? null,
        purchasePriceCents: d.purchasePriceCents ?? null,
        purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : null,
        ...(d.currentHours != null ? { currentHours: d.currentHours } : {}),
        ...(d.serviceIntervalHours != null
          ? { serviceIntervalHours: d.serviceIntervalHours }
          : {}),
      })
      .returning();
    if (row) {
      const slug = makeAssetSlug("equip", row.id, row.name);
      const [updated] = await db
        .update(equipmentTable)
        .set({ slug })
        .where(eq(equipmentTable.id, row.id))
        .returning();
      res.status(201).json({ equipment: updated ?? row });
      return;
    }
    res.status(500).json({ error: "insert_failed" });
  },
);

router.patch(
  "/equipment/:id",
  requireAuth,
  requireSection("fleet.equipment", "edit"),
  async (req, res) => {
    const params = UpdateEquipmentParams.safeParse({ id: Number(req.params.id) });
    const body = UpdateEquipmentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const d = body.data;
    const [row] = await db
      .update(equipmentTable)
      .set({
        name: d.name,
        type: d.type,
        brand: d.brand ?? null,
        model: d.model ?? null,
        serial: d.serial ?? null,
        ...(d.status ? { status: d.status as FleetStatus } : {}),
        assignedTruckId: d.assignedTruckId ?? null,
        purchasePriceCents: d.purchasePriceCents ?? null,
        purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : null,
        ...(d.currentHours != null ? { currentHours: d.currentHours } : {}),
        ...(d.serviceIntervalHours != null
          ? { serviceIntervalHours: d.serviceIntervalHours }
          : {}),
      })
      .where(eq(equipmentTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ equipment: row });
  },
);

router.delete(
  "/equipment/:id",
  requireAuth,
  requireSection("fleet.equipment", "edit"),
  async (req, res) => {
    const params = DeleteEquipmentParams.safeParse({ id: Number(req.params.id) });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const deleted = await db
      .delete(equipmentTable)
      .where(eq(equipmentTable.id, params.data.id))
      .returning({ id: equipmentTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  },
);

// ---------- Maintenance Logs ----------
function buildLogValues<
  T extends {
    kind?: string;
    performedAt?: string | Date | null;
    laborCostCents?: number | null;
    partsCostCents?: number | null;
  },
>(input: T) {
  const { kind, performedAt, laborCostCents, partsCostCents, ...rest } = input;
  void kind;
  void performedAt;
  void laborCostCents;
  void partsCostCents;
  const labor = input.laborCostCents ?? 0;
  const parts = input.partsCostCents ?? 0;
  return {
    ...rest,
    ...(input.kind !== undefined
      ? { kind: input.kind as MaintenanceKind }
      : {}),
    ...(input.performedAt !== undefined && input.performedAt !== null
      ? {
          performedAt:
            typeof input.performedAt === "string"
              ? new Date(input.performedAt)
              : input.performedAt,
        }
      : {}),
    laborCostCents: labor,
    partsCostCents: parts,
    costCents: labor + parts,
  };
}

router.get(
  "/maintenance-logs",
  requireAuth,
  requireSection("fleet.maintenance", "view"),
  async (_req, res) => {
    const rows = await db
      .select()
      .from(maintenanceLogsTable)
      .orderBy(desc(maintenanceLogsTable.performedAt))
      .limit(500);
    res.json({ logs: rows });
  },
);

router.post(
  "/maintenance-logs",
  requireAuth,
  requireSection("fleet.maintenance", "edit"),
  async (req, res) => {
    const parsed = CreateMaintenanceLogBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    // Refinement: maintenance entries must target exactly one asset.
    const hasTruck = parsed.data.truckId != null;
    const hasEquip = parsed.data.equipmentId != null;
    if (hasTruck === hasEquip) {
      res
        .status(400)
        .json({ error: "must_target_exactly_one_asset" });
      return;
    }
    const [row] = await db
      .insert(maintenanceLogsTable)
      .values(buildLogValues(parsed.data))
      .returning();

    // If the log includes a usage snapshot, advance the asset's odometer too.
    if (row) {
      if (row.truckId && row.mileageAtService != null) {
        await db
          .update(trucksTable)
          .set({ currentMileage: row.mileageAtService })
          .where(
            and(
              eq(trucksTable.id, row.truckId),
              sql`${trucksTable.currentMileage} < ${row.mileageAtService}`,
            ),
          );
      }
      if (row.equipmentId && row.hoursAtService != null) {
        await db
          .update(equipmentTable)
          .set({ currentHours: row.hoursAtService })
          .where(
            and(
              eq(equipmentTable.id, row.equipmentId),
              sql`${equipmentTable.currentHours} < ${row.hoursAtService}`,
            ),
          );
      }
    }

    res.status(201).json({ log: row });
  },
);

router.patch(
  "/maintenance-logs/:id",
  requireAuth,
  requireSection("fleet.maintenance", "edit"),
  async (req, res) => {
    const params = UpdateMaintenanceLogParams.safeParse({
      id: Number(req.params.id),
    });
    const body = UpdateMaintenanceLogBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const [row] = await db
      .update(maintenanceLogsTable)
      .set(buildLogValues(body.data))
      .where(eq(maintenanceLogsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ log: row });
  },
);

router.delete(
  "/maintenance-logs/:id",
  requireAuth,
  requireSection("fleet.maintenance", "edit"),
  async (req, res) => {
    const params = DeleteMaintenanceLogParams.safeParse({
      id: Number(req.params.id),
    });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const deleted = await db
      .delete(maintenanceLogsTable)
      .where(eq(maintenanceLogsTable.id, params.data.id))
      .returning({ id: maintenanceLogsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  },
);

// ---------- Asset Registry ----------
type AssetSummary = {
  kind: "TRUCK" | "EQUIPMENT";
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  model: string | null;
  identifier: string | null;
  status: string;
  purchasePriceCents: number | null;
  purchaseDate: string | null;
  currentUsage: number;
  usageUnit: "MILES" | "HOURS";
  serviceIntervalUsage: number;
  lastServiceUsage: number | null;
  usageSinceLastService: number | null;
  nextServiceDueAt: number;
  usageUntilDue: number;
  serviceState: "OK" | "DUE_SOON" | "OVERDUE";
  lifeToDateSpendCents: number;
  lastServicePerformedAt: string | null;
};

const DUE_SOON_FRACTION = 0.1; // within 10% of interval

function deriveServiceState(
  usageUntilDue: number,
  intervalUsage: number,
): "OK" | "DUE_SOON" | "OVERDUE" {
  if (usageUntilDue < 0) return "OVERDUE";
  if (usageUntilDue <= Math.max(1, Math.round(intervalUsage * DUE_SOON_FRACTION)))
    return "DUE_SOON";
  return "OK";
}

async function buildAssetList(): Promise<AssetSummary[]> {
  const [trucks, equipment, logs] = await Promise.all([
    db.select().from(trucksTable),
    db.select().from(equipmentTable),
    db.select().from(maintenanceLogsTable),
  ]);

  const truckLogs = new Map<number, typeof logs>();
  const equipLogs = new Map<number, typeof logs>();
  for (const log of logs) {
    if (log.truckId) {
      const list = truckLogs.get(log.truckId) ?? [];
      list.push(log);
      truckLogs.set(log.truckId, list);
    } else if (log.equipmentId) {
      const list = equipLogs.get(log.equipmentId) ?? [];
      list.push(log);
      equipLogs.set(log.equipmentId, list);
    }
  }

  const assets: AssetSummary[] = [];

  for (const t of trucks) {
    const myLogs = (truckLogs.get(t.id) ?? []).slice().sort((a, b) => {
      return (
        new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
      );
    });
    const lifetime = myLogs.reduce((sum, l) => sum + (l.costCents ?? 0), 0);
    const lastWithMileage = myLogs.find((l) => l.mileageAtService != null);
    const lastService = myLogs[0] ?? null;
    const lastServiceUsage = lastWithMileage?.mileageAtService ?? null;
    const usageSinceLastService =
      lastServiceUsage != null ? Math.max(0, t.currentMileage - lastServiceUsage) : null;
    const nextDueAt = (lastServiceUsage ?? 0) + t.serviceIntervalMiles;
    const usageUntilDue = nextDueAt - t.currentMileage;
    assets.push({
      kind: "TRUCK",
      id: t.id,
      slug: t.slug ?? makeAssetSlug("truck", t.id, t.name),
      name: t.name,
      brand: t.brand,
      model: t.model,
      identifier: t.vin,
      status: t.status,
      purchasePriceCents: t.purchasePriceCents,
      purchaseDate: t.purchaseDate ? t.purchaseDate.toISOString() : null,
      currentUsage: t.currentMileage,
      usageUnit: "MILES",
      serviceIntervalUsage: t.serviceIntervalMiles,
      lastServiceUsage,
      usageSinceLastService,
      nextServiceDueAt: nextDueAt,
      usageUntilDue,
      serviceState: deriveServiceState(usageUntilDue, t.serviceIntervalMiles),
      lifeToDateSpendCents: lifetime,
      lastServicePerformedAt: lastService
        ? new Date(lastService.performedAt).toISOString()
        : null,
    });
  }

  for (const e of equipment) {
    const myLogs = (equipLogs.get(e.id) ?? []).slice().sort((a, b) => {
      return (
        new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
      );
    });
    const lifetime = myLogs.reduce((sum, l) => sum + (l.costCents ?? 0), 0);
    const lastWithHours = myLogs.find((l) => l.hoursAtService != null);
    const lastService = myLogs[0] ?? null;
    const lastServiceUsage = lastWithHours?.hoursAtService ?? null;
    const usageSinceLastService =
      lastServiceUsage != null ? Math.max(0, e.currentHours - lastServiceUsage) : null;
    const nextDueAt = (lastServiceUsage ?? 0) + e.serviceIntervalHours;
    const usageUntilDue = nextDueAt - e.currentHours;
    assets.push({
      kind: "EQUIPMENT",
      id: e.id,
      slug: e.slug ?? makeAssetSlug("equip", e.id, e.name),
      name: e.name,
      brand: e.brand,
      model: e.model,
      identifier: e.serial,
      status: e.status,
      purchasePriceCents: e.purchasePriceCents,
      purchaseDate: e.purchaseDate ? e.purchaseDate.toISOString() : null,
      currentUsage: e.currentHours,
      usageUnit: "HOURS",
      serviceIntervalUsage: e.serviceIntervalHours,
      lastServiceUsage,
      usageSinceLastService,
      nextServiceDueAt: nextDueAt,
      usageUntilDue,
      serviceState: deriveServiceState(usageUntilDue, e.serviceIntervalHours),
      lifeToDateSpendCents: lifetime,
      lastServicePerformedAt: lastService
        ? new Date(lastService.performedAt).toISOString()
        : null,
    });
  }

  // Sort: overdue first, then due soon, then by life-to-date desc
  const stateRank: Record<AssetSummary["serviceState"], number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    OK: 2,
  };
  assets.sort((a, b) => {
    const r = stateRank[a.serviceState] - stateRank[b.serviceState];
    if (r !== 0) return r;
    return b.lifeToDateSpendCents - a.lifeToDateSpendCents;
  });

  return assets;
}

// Section gate: viewer of either trucks OR equipment can see the registry.
function requireFleetView(): import("express").RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const canTrucks = hasSectionAccess(req.user, "fleet.trucks", "view");
    const canEquipment = hasSectionAccess(req.user, "fleet.equipment", "view");
    if (!canTrucks && !canEquipment) {
      res
        .status(403)
        .json({ error: "forbidden", section: "fleet", action: "view" });
      return;
    }
    next();
  };
}

router.get("/assets", requireAuth, requireFleetView(), async (_req, res) => {
  const assets = await buildAssetList();
  res.json({ assets });
});

router.get(
  "/assets/:slug",
  requireAuth,
  requireFleetView(),
  async (req, res) => {
    const params = GetAssetBySlugParams.safeParse({ slug: req.params.slug });
    if (!params.success) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const assets = await buildAssetList();
    const asset = assets.find((a) => a.slug === params.data.slug);
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const logs = asset.kind === "TRUCK"
      ? await db
          .select()
          .from(maintenanceLogsTable)
          .where(eq(maintenanceLogsTable.truckId, asset.id))
          .orderBy(desc(maintenanceLogsTable.performedAt))
      : await db
          .select()
          .from(maintenanceLogsTable)
          .where(eq(maintenanceLogsTable.equipmentId, asset.id))
          .orderBy(desc(maintenanceLogsTable.performedAt));

    const recentReadings = asset.kind === "TRUCK"
      ? await db
          .select()
          .from(usageReadingsTable)
          .where(eq(usageReadingsTable.truckId, asset.id))
          .orderBy(desc(usageReadingsTable.recordedAt))
          .limit(20)
      : await db
          .select()
          .from(usageReadingsTable)
          .where(eq(usageReadingsTable.equipmentId, asset.id))
          .orderBy(desc(usageReadingsTable.recordedAt))
          .limit(20);

    res.json({ asset, logs, recentReadings });
  },
);

router.post(
  "/assets/:slug/status",
  requireAuth,
  requireSection("fleet.maintenance", "edit"),
  async (req, res) => {
    const slug = String(req.params.slug ?? "");
    const rawStatus = String((req.body ?? {}).status ?? "");
    const allowed = ["ACTIVE", "IN_SHOP", "RETIRED"] as const;
    type AllowedStatus = (typeof allowed)[number];
    if (!(allowed as readonly string[]).includes(rawStatus)) {
      res.status(400).json({ error: "invalid_status" });
      return;
    }
    const status = rawStatus as AllowedStatus;
    const assets = await buildAssetList();
    const asset = assets.find((a) => a.slug === slug);
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (asset.kind === "TRUCK") {
      await db
        .update(trucksTable)
        .set({ status })
        .where(eq(trucksTable.id, asset.id));
    } else {
      await db
        .update(equipmentTable)
        .set({ status })
        .where(eq(equipmentTable.id, asset.id));
    }
    // Re-query so we return the freshest summary, including derived fields.
    const refreshed = (await buildAssetList()).find((a) => a.slug === slug);
    res.json({ asset: refreshed, logs: [], recentReadings: [] });
  },
);

router.post(
  "/usage-readings",
  requireAuth,
  requireSection("fleet.maintenance", "edit"),
  async (req, res) => {
    const parsed = CreateUsageReadingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const { mileage, hours, truckId, equipmentId, notes } = parsed.data;
    // Refinement: must target exactly one asset, with the matching usage field.
    const hasTruck = truckId != null;
    const hasEquip = equipmentId != null;
    if (hasTruck === hasEquip) {
      res
        .status(400)
        .json({ error: "must_target_exactly_one_asset" });
      return;
    }
    if (hasTruck && mileage == null) {
      res.status(400).json({ error: "trucks_require_mileage" });
      return;
    }
    if (hasEquip && hours == null) {
      res.status(400).json({ error: "equipment_requires_hours" });
      return;
    }

    const userId = req.user?.id ?? null;
    const [row] = await db
      .insert(usageReadingsTable)
      .values({
        truckId: truckId ?? null,
        equipmentId: equipmentId ?? null,
        mileage: mileage ?? null,
        hours: hours ?? null,
        notes: notes ?? null,
        recordedByUserId: userId,
      })
      .returning();

    // Advance the asset's current usage if the reading is higher.
    if (truckId && mileage != null) {
      await db
        .update(trucksTable)
        .set({ currentMileage: mileage })
        .where(
          and(
            eq(trucksTable.id, truckId),
            sql`${trucksTable.currentMileage} < ${mileage}`,
          ),
        );
    }
    if (equipmentId && hours != null) {
      await db
        .update(equipmentTable)
        .set({ currentHours: hours })
        .where(
          and(
            eq(equipmentTable.id, equipmentId),
            sql`${equipmentTable.currentHours} < ${hours}`,
          ),
        );
    }

    res.status(201).json({ reading: row });
  },
);

// ---------- Fleet Pulse ----------
router.get("/fleet-pulse", requireAuth, requireFleetView(), async (_req, res) => {
  const assets = await buildAssetList();

  const counts = {
    active: 0,
    inShop: 0,
    outOfService: 0,
    total: assets.length,
  };
  for (const a of assets) {
    if (a.status === "ACTIVE") counts.active++;
    else if (a.status === "IN_SHOP") counts.inShop++;
    else counts.outOfService++;
  }

  const overdue = assets
    .filter((a) => a.serviceState === "OVERDUE")
    .map(toPulseSummary);
  const dueSoon = assets
    .filter((a) => a.serviceState === "DUE_SOON")
    .map(toPulseSummary);
  const topMoneyPits = assets
    .slice()
    .sort((a, b) => b.lifeToDateSpendCents - a.lifeToDateSpendCents)
    .slice(0, 5)
    .map(toPulseSummary);

  // Monthly spend for last 12 months — and a recent-maintenance feed.
  const logs = await db
    .select()
    .from(maintenanceLogsTable)
    .orderBy(desc(maintenanceLogsTable.performedAt));
  const assetBySlugIndex = new Map<string, AssetSummary>();
  for (const a of assets) {
    assetBySlugIndex.set(`${a.kind}-${a.id}`, a);
  }
  const recentMaintenance = logs
    .slice(0, 8)
    .map((log) => {
      const key = log.truckId
        ? `TRUCK-${log.truckId}`
        : log.equipmentId
          ? `EQUIPMENT-${log.equipmentId}`
          : null;
      const asset = key ? assetBySlugIndex.get(key) : undefined;
      return {
        id: log.id,
        kind: log.kind,
        description: log.description,
        performedAt: new Date(log.performedAt).toISOString(),
        costCents: log.costCents ?? 0,
        laborCostCents: log.laborCostCents ?? 0,
        partsCostCents: log.partsCostCents ?? 0,
        assetKind: (asset?.kind ?? "TRUCK") as "TRUCK" | "EQUIPMENT",
        assetSlug: asset?.slug ?? "",
        assetName: asset?.name ?? "Unknown asset",
      };
    })
    .filter((r) => r.assetSlug !== "");
  const monthMap = new Map<
    string,
    { totalCents: number; laborCents: number; partsCents: number }
  >();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, { totalCents: 0, laborCents: 0, partsCents: 0 });
  }
  let last30 = 0;
  let ytd = 0;
  let lifetime = 0;
  const since30 = Date.now() - 30 * 86_400_000;
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  for (const log of logs) {
    const d = new Date(log.performedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap.has(key)) {
      const cur = monthMap.get(key)!;
      cur.totalCents += log.costCents ?? 0;
      cur.laborCents += log.laborCostCents ?? 0;
      cur.partsCents += log.partsCostCents ?? 0;
    }
    const t = d.getTime();
    const c = log.costCents ?? 0;
    lifetime += c;
    if (t >= yearStart) ytd += c;
    if (t >= since30) last30 += c;
  }
  const monthlySpend = Array.from(monthMap.entries()).map(([month, v]) => ({
    month,
    ...v,
  }));

  res.json({
    counts,
    overdue,
    dueSoon,
    monthlySpend,
    topMoneyPits,
    totals: { last30DaysCents: last30, ytdCents: ytd, lifetimeCents: lifetime },
    recentMaintenance,
  });
});

function toPulseSummary(a: AssetSummary) {
  return {
    kind: a.kind,
    id: a.id,
    slug: a.slug,
    name: a.name,
    status: a.status,
    usageUntilDue: a.usageUntilDue,
    usageUnit: a.usageUnit,
    serviceState: a.serviceState,
    lifeToDateSpendCents: a.lifeToDateSpendCents,
  };
}

export default router;
