import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  trucksTable,
  equipmentTable,
  maintenanceLogsTable,
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
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSection } from "../middlewares/requireSection";

const router: IRouter = Router();

type FleetStatus = "ACTIVE" | "IN_SHOP" | "RETIRED";
type MaintenanceKind = "SCHEDULED" | "REPAIR" | "INSPECTION";

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
    const [row] = await db
      .insert(trucksTable)
      .values({ ...parsed.data, status: parsed.data.status as FleetStatus })
      .returning();
    res.status(201).json({ truck: row });
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
    const [row] = await db
      .update(trucksTable)
      .set({ ...body.data, status: body.data.status as FleetStatus })
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
    const [row] = await db
      .insert(equipmentTable)
      .values({ ...parsed.data, status: parsed.data.status as FleetStatus })
      .returning();
    res.status(201).json({ equipment: row });
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
    const [row] = await db
      .update(equipmentTable)
      .set({ ...body.data, status: body.data.status as FleetStatus })
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
function coerceLogInput<
  T extends { kind?: string; performedAt?: string | Date | null },
>(input: T) {
  const { kind, performedAt, ...rest } = input;
  void kind;
  void performedAt;
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
  };
}

router.get(
  "/maintenance-logs",
  requireAuth,
  requireSection("fleet.maintenance", "view"),
  async (_req, res) => {
    const rows = await db.select().from(maintenanceLogsTable).limit(500);
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
    const [row] = await db
      .insert(maintenanceLogsTable)
      .values(coerceLogInput(parsed.data))
      .returning();
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
      .set(coerceLogInput(body.data))
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

export default router;
