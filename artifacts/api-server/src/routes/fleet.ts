import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import {
  db,
  trucksTable,
  equipmentTable,
  equipmentItemsTable,
  maintenanceLogsTable,
  usageReadingsTable,
  assetStatusLogTable,
  assetAssignmentLogTable,
  crewsTable,
  crewMembersTable,
  usersTable,
  departmentsTable,
  rolesTable,
  type MaintenanceLog,
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

// Extension schemas for fields not yet in the OpenAPI spec. These let
// the route handlers accept the new category / quantity / vehicleType
// payloads without regenerating the orval client. The UI sends them as
// regular body fields and we layer them on top of the generated parse.
const truckExtensionSchema = z
  .object({
    vehicleType: z.enum(["TRUCK", "TRAILER"]).optional(),
  })
  .passthrough();

const equipmentExtensionSchema = z
  .object({
    category: z.enum(["HANDHELD", "CUSTOM"]).optional(),
    quantity: z.number().int().min(1).optional(),
    customCategoryLabel: z.string().min(1).max(60).nullable().optional(),
  })
  .passthrough();

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
  async (req, res) => {
    const deptId = resolveDeptId(req);
    const rows = deptId != null
      ? await db.select().from(trucksTable).where(eq(trucksTable.departmentId, deptId)).limit(500)
      : await db.select().from(trucksTable).limit(500);
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
    // Non-admins can only create assets within their own department.
    let effectiveDeptId: number | null = d.departmentId ?? null;
    if (req.user!.role !== "ADMIN") {
      const userDept = req.user!.departmentId ?? null;
      if (effectiveDeptId != null && effectiveDeptId !== userDept) {
        res.status(403).json({ error: "forbidden", detail: "cannot assign asset to another department" });
        return;
      }
      effectiveDeptId = userDept;
    }
    // Every asset must be assigned to a department going forward.
    if (effectiveDeptId == null) {
      res.status(400).json({ error: "department_required", detail: "departmentId is required when creating a fleet asset" });
      return;
    }
    const truckExt = truckExtensionSchema.safeParse(req.body);
    const vehicleType =
      truckExt.success && truckExt.data.vehicleType ? truckExt.data.vehicleType : "TRUCK";
    const [row] = await db
      .insert(trucksTable)
      .values({
        name: d.name,
        vehicleType,
        brand: d.brand ?? null,
        model: d.model ?? null,
        vin: d.vin ?? null,
        plate: d.plate ?? null,
        status: d.status as FleetStatus,
        assignedCrewId: d.assignedCrewId ?? null,
        departmentId: effectiveDeptId,
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
    // Non-admins may not reassign a vehicle to a different department.
    if (d.departmentId !== undefined && req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "forbidden", detail: "only admins may change department assignment" });
      return;
    }
    // Verify non-admin callers can only mutate assets in their own department.
    if (!(await assertAssetInScope(req, res, { truckId: params.data.id }))) return;
    // PATCH semantics: only update fields explicitly present in the body so
    // partial updates do not unintentionally clear existing values.
    const patch: Record<string, unknown> = {};
    if (d.name !== undefined) patch.name = d.name;
    if (d.brand !== undefined) patch.brand = d.brand ?? null;
    if (d.model !== undefined) patch.model = d.model ?? null;
    if (d.vin !== undefined) patch.vin = d.vin ?? null;
    if (d.plate !== undefined) patch.plate = d.plate ?? null;
    if (d.status !== undefined) patch.status = d.status as FleetStatus;
    if (d.assignedCrewId !== undefined)
      patch.assignedCrewId = d.assignedCrewId ?? null;
    if (d.departmentId !== undefined) {
      // Admins may reassign but may not un-assign (departmentId must remain non-null).
      if (d.departmentId == null) {
        res.status(400).json({ error: "department_required", detail: "departmentId cannot be removed from an asset" });
        return;
      }
      patch.departmentId = d.departmentId;
    }
    if (d.purchasePriceCents !== undefined)
      patch.purchasePriceCents = d.purchasePriceCents ?? null;
    if (d.purchaseDate !== undefined)
      patch.purchaseDate = d.purchaseDate ? new Date(d.purchaseDate) : null;
    if (d.currentMileage != null) patch.currentMileage = d.currentMileage;
    if (d.serviceIntervalMiles != null)
      patch.serviceIntervalMiles = d.serviceIntervalMiles;

    const truckExt = truckExtensionSchema.safeParse(req.body);
    if (truckExt.success && truckExt.data.vehicleType !== undefined) {
      patch.vehicleType = truckExt.data.vehicleType;
    }

    const [row] = await db
      .update(trucksTable)
      .set(patch)
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
    if (!(await assertAssetInScope(req, res, { truckId: params.data.id }))) return;
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
  async (req, res) => {
    const deptId = resolveDeptId(req);
    const rows = deptId != null
      ? await db.select().from(equipmentTable).where(eq(equipmentTable.departmentId, deptId)).limit(500)
      : await db.select().from(equipmentTable).limit(500);
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
    // Non-admins can only create assets within their own department.
    let effectiveDeptId: number | null = d.departmentId ?? null;
    if (req.user!.role !== "ADMIN") {
      const userDept = req.user!.departmentId ?? null;
      if (effectiveDeptId != null && effectiveDeptId !== userDept) {
        res.status(403).json({ error: "forbidden", detail: "cannot assign asset to another department" });
        return;
      }
      effectiveDeptId = userDept;
    }
    // Every asset must be assigned to a department going forward.
    if (effectiveDeptId == null) {
      res.status(400).json({ error: "department_required", detail: "departmentId is required when creating a fleet asset" });
      return;
    }
    const equipExt = equipmentExtensionSchema.safeParse(req.body);
    const category =
      equipExt.success && equipExt.data.category ? equipExt.data.category : "HANDHELD";
    const quantity =
      equipExt.success && equipExt.data.quantity != null ? equipExt.data.quantity : 1;
    // CUSTOM rows must carry a free-form label; HANDHELD rows must not.
    let customCategoryLabel: string | null = null;
    if (category === "CUSTOM") {
      const label = equipExt.success ? equipExt.data.customCategoryLabel ?? null : null;
      if (!label) {
        res
          .status(400)
          .json({ error: "custom_category_label_required", detail: "CUSTOM items require a category label" });
        return;
      }
      customCategoryLabel = label;
    }
    const [row] = await db
      .insert(equipmentTable)
      .values({
        name: d.name,
        type: d.type,
        category,
        quantity,
        customCategoryLabel,
        brand: d.brand ?? null,
        model: d.model ?? null,
        serial: d.serial ?? null,
        status: d.status as FleetStatus,
        assignedTruckId: d.assignedTruckId ?? null,
        departmentId: effectiveDeptId,
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
    // Non-admins may not reassign equipment to a different department.
    if (d.departmentId !== undefined && req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "forbidden", detail: "only admins may change department assignment" });
      return;
    }
    // Verify non-admin callers can only mutate assets in their own department.
    if (!(await assertAssetInScope(req, res, { equipmentId: params.data.id }))) return;
    // PATCH semantics: only update fields explicitly present in the body.
    const patch: Record<string, unknown> = {};
    if (d.name !== undefined) patch.name = d.name;
    if (d.type !== undefined) patch.type = d.type;
    if (d.brand !== undefined) patch.brand = d.brand ?? null;
    if (d.model !== undefined) patch.model = d.model ?? null;
    if (d.serial !== undefined) patch.serial = d.serial ?? null;
    if (d.status !== undefined) patch.status = d.status as FleetStatus;
    if (d.assignedTruckId !== undefined)
      patch.assignedTruckId = d.assignedTruckId ?? null;
    if (d.departmentId !== undefined) {
      // Admins may reassign but may not un-assign (departmentId must remain non-null).
      if (d.departmentId == null) {
        res.status(400).json({ error: "department_required", detail: "departmentId cannot be removed from an asset" });
        return;
      }
      patch.departmentId = d.departmentId;
    }
    if (d.purchasePriceCents !== undefined)
      patch.purchasePriceCents = d.purchasePriceCents ?? null;
    if (d.purchaseDate !== undefined)
      patch.purchaseDate = d.purchaseDate ? new Date(d.purchaseDate) : null;
    if (d.currentHours != null) patch.currentHours = d.currentHours;
    if (d.serviceIntervalHours != null)
      patch.serviceIntervalHours = d.serviceIntervalHours;

    const equipExt = equipmentExtensionSchema.safeParse(req.body);
    if (equipExt.success) {
      if (equipExt.data.category !== undefined) patch.category = equipExt.data.category;
      if (equipExt.data.quantity !== undefined) patch.quantity = equipExt.data.quantity;
      if (equipExt.data.customCategoryLabel !== undefined) {
        patch.customCategoryLabel = equipExt.data.customCategoryLabel;
      }
    }

    const [row] = await db
      .update(equipmentTable)
      .set(patch)
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
    if (!(await assertAssetInScope(req, res, { equipmentId: params.data.id }))) return;
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

// ---------- Equipment Items ----------
// Consumables / accessories attached to a piece of equipment.
// Anyone with fleet.equipment view can read; edit required to mutate.

const equipmentItemBodySchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).optional().default(1),
  unit: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
});

router.get(
  "/equipment/:id/items",
  requireAuth,
  requireSection("fleet.equipment", "view"),
  async (req, res) => {
    const equipId = Number(req.params.id);
    if (!Number.isFinite(equipId)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const items = await db
      .select()
      .from(equipmentItemsTable)
      .where(eq(equipmentItemsTable.equipmentId, equipId))
      .orderBy(equipmentItemsTable.createdAt);
    res.json({ items });
  },
);

router.post(
  "/equipment/:id/items",
  requireAuth,
  requireSection("fleet.equipment", "edit"),
  async (req, res) => {
    const equipId = Number(req.params.id);
    if (!Number.isFinite(equipId)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const parsed = equipmentItemBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const [item] = await db
      .insert(equipmentItemsTable)
      .values({ equipmentId: equipId, ...parsed.data })
      .returning();
    res.status(201).json({ item });
  },
);

router.delete(
  "/equipment/:equipId/items/:itemId",
  requireAuth,
  requireSection("fleet.equipment", "edit"),
  async (req, res) => {
    const equipId = Number(req.params.equipId);
    const itemId = Number(req.params.itemId);
    if (!Number.isFinite(equipId) || !Number.isFinite(itemId)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const deleted = await db
      .delete(equipmentItemsTable)
      .where(
        and(
          eq(equipmentItemsTable.id, itemId),
          eq(equipmentItemsTable.equipmentId, equipId),
        ),
      )
      .returning({ id: equipmentItemsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  },
);

// ---------- Maintenance Logs ----------
// `mode = "create"` defaults missing labor/parts to 0 (so costCents is always
// labor+parts on insert). `mode = "patch"` only touches labor/parts when the
// caller actually provided them, so partial updates don't zero out costs.
function buildLogValues<
  T extends {
    kind?: string;
    performedAt?: string | Date | null;
    laborCostCents?: number | null;
    partsCostCents?: number | null;
  },
>(input: T, mode: "create" | "patch" = "create") {
  const { kind, performedAt, laborCostCents, partsCostCents, ...rest } = input;
  void kind;
  void performedAt;
  void laborCostCents;
  void partsCostCents;

  const out: Record<string, unknown> = { ...rest };
  if (input.kind !== undefined) {
    out.kind = input.kind as MaintenanceKind;
  }
  if (input.performedAt !== undefined && input.performedAt !== null) {
    out.performedAt =
      typeof input.performedAt === "string"
        ? new Date(input.performedAt)
        : input.performedAt;
  }

  const laborProvided = input.laborCostCents !== undefined;
  const partsProvided = input.partsCostCents !== undefined;
  if (mode === "create") {
    const labor = input.laborCostCents ?? 0;
    const parts = input.partsCostCents ?? 0;
    out.laborCostCents = labor;
    out.partsCostCents = parts;
    out.costCents = labor + parts;
  } else if (laborProvided || partsProvided) {
    // For PATCH we only recompute costCents if labor or parts is actually
    // being changed. Use the provided value, falling back to 0 only for the
    // side that isn't being touched (the SQL UPDATE will leave it as-is).
    if (laborProvided) out.laborCostCents = input.laborCostCents ?? 0;
    if (partsProvided) out.partsCostCents = input.partsCostCents ?? 0;
    // costCents recomputation requires both sides; defer to caller when
    // partial — see PATCH handler below which loads the existing row.
  }
  return out;
}

router.get(
  "/maintenance-logs",
  requireAuth,
  requireSection("fleet.maintenance", "view"),
  async (req, res) => {
    const deptId = resolveDeptId(req);
    let rows: MaintenanceLog[];
    if (deptId != null) {
      // Filter in SQL so the LIMIT applies only to matching dept rows.
      rows = await db
        .select({ log: maintenanceLogsTable })
        .from(maintenanceLogsTable)
        .leftJoin(trucksTable, eq(maintenanceLogsTable.truckId, trucksTable.id))
        .leftJoin(equipmentTable, eq(maintenanceLogsTable.equipmentId, equipmentTable.id))
        .where(
          sql`(${trucksTable.departmentId} = ${deptId} OR ${equipmentTable.departmentId} = ${deptId})`,
        )
        .orderBy(desc(maintenanceLogsTable.performedAt))
        .limit(500)
        .then((r) => r.map((x) => x.log));
    } else {
      rows = await db
        .select()
        .from(maintenanceLogsTable)
        .orderBy(desc(maintenanceLogsTable.performedAt))
        .limit(500);
    }
    const loggedByIds = [...new Set(rows.map((r) => r.loggedByUserId).filter((id): id is number => id != null))];
    let userMap: Record<number, string> = {};
    if (loggedByIds.length > 0) {
      const users = await db
        .select({ id: usersTable.id, fullName: usersTable.fullName })
        .from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.raw(loggedByIds.join(","))}]::int[])`);
      userMap = Object.fromEntries(users.map((u) => [u.id, u.fullName]));
    }
    res.json({ logs: rows.map((r) => ({ ...r, loggedByName: r.loggedByUserId != null ? (userMap[r.loggedByUserId] ?? null) : null })) });
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
    // Verify non-admin callers can only log against assets in their own dept.
    if (!(await assertAssetInScope(req, res, {
      truckId: parsed.data.truckId,
      equipmentId: parsed.data.equipmentId,
    }))) return;
    const [row] = await db
      .insert(maintenanceLogsTable)
      // buildLogValues("create") always sets description/labor/parts/cost.
      .values({
        ...(buildLogValues(parsed.data, "create") as typeof maintenanceLogsTable.$inferInsert),
        loggedByUserId: req.user?.id ?? null,
      })
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
    if (!(await assertMaintenanceLogInScope(req, res, params.data.id))) return;
    const values = buildLogValues(body.data, "patch") as Record<
      string,
      unknown
    >;
    // If labor or parts is being touched, recompute costCents from the
    // resulting row's values (existing + provided).
    const laborTouched = "laborCostCents" in values;
    const partsTouched = "partsCostCents" in values;
    if (laborTouched || partsTouched) {
      const [existing] = await db
        .select({
          laborCostCents: maintenanceLogsTable.laborCostCents,
          partsCostCents: maintenanceLogsTable.partsCostCents,
        })
        .from(maintenanceLogsTable)
        .where(eq(maintenanceLogsTable.id, params.data.id));
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const labor = laborTouched
        ? (values.laborCostCents as number)
        : (existing.laborCostCents ?? 0);
      const parts = partsTouched
        ? (values.partsCostCents as number)
        : (existing.partsCostCents ?? 0);
      values.costCents = labor + parts;
    }
    const [row] = await db
      .update(maintenanceLogsTable)
      .set(values)
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
    if (!(await assertMaintenanceLogInScope(req, res, params.data.id))) return;
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
// Top-level taxonomy that the registry surfaces. TRUCK / TRAILER come from
// the trucks table (`vehicle_type` discriminator); HANDHELD / CUSTOM come
// from equipment.category.
type AssetCategory = "TRUCK" | "TRAILER" | "HANDHELD" | "CUSTOM";

type AssetSummary = {
  kind: "TRUCK" | "EQUIPMENT";
  category: AssetCategory;
  customCategoryLabel: string | null;
  quantity: number;
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  model: string | null;
  identifier: string | null;
  status: string;
  departmentId: number | null;
  departmentName: string | null;
  assignedCrewId: number | null;
  assignedCrewName: string | null;
  lastAssignedAt: string | null;
  lastAssignedByUserId: number | null;
  lastAssignedByName: string | null;
  purchasePriceCents: number | null;
  purchaseDate: string | null;
  currentUsage: number;
  usageUnit: "MILES" | "HOURS" | "NONE";
  serviceIntervalUsage: number;
  lastServiceUsage: number | null;
  usageSinceLastService: number | null;
  nextServiceDueAt: number;
  usageUntilDue: number;
  serviceState: "OK" | "DUE_SOON" | "OVERDUE";
  lifeToDateSpendCents: number;
  ytdSpendCents: number;
  costPerUsageCents: number | null;
  lastServicePerformedAt: string | null;
};

const DUE_SOON_FRACTION = 0.1; // within 10% of interval

// Sentinel value reported on usage-less assets (trailers, quantity-tracked
// handheld/custom items). JSON cannot encode Infinity, so we use a finite
// "essentially never" value the UI tests with `usageUnit === "NONE"`
// before formatting.
const USAGE_UNTIL_DUE_NA = 999_999_999;

function deriveServiceState(
  usageUntilDue: number,
  intervalUsage: number,
): "OK" | "DUE_SOON" | "OVERDUE" {
  if (usageUntilDue < 0) return "OVERDUE";
  if (usageUntilDue <= Math.max(1, Math.round(intervalUsage * DUE_SOON_FRACTION)))
    return "DUE_SOON";
  return "OK";
}

async function buildAssetList(departmentId?: number): Promise<AssetSummary[]> {
  const [trucks, equipment, logs, deptRows, crewRows] = await Promise.all([
    departmentId != null
      ? db.select().from(trucksTable).where(eq(trucksTable.departmentId, departmentId))
      : db.select().from(trucksTable),
    departmentId != null
      ? db.select().from(equipmentTable).where(eq(equipmentTable.departmentId, departmentId))
      : db.select().from(equipmentTable),
    db.select().from(maintenanceLogsTable),
    db.select({ id: departmentsTable.id, label: departmentsTable.label }).from(departmentsTable),
    db.select({ id: crewsTable.id, name: crewsTable.name }).from(crewsTable),
  ]);

  const deptMap = new Map(deptRows.map((d) => [d.id, d.label]));
  const crewMap = new Map(crewRows.map((c) => [c.id, c.name]));

  // Resolve any "last assigned by" user names in a single batched query so
  // every row carries a printable actor without N+1 lookups.
  const lastAssignedUserIds = Array.from(
    new Set([
      ...trucks.map((t) => t.lastAssignedByUserId).filter((n): n is number => n != null),
      ...equipment.map((e) => e.lastAssignedByUserId).filter((n): n is number => n != null),
    ]),
  );
  const userNameRows = lastAssignedUserIds.length
    ? await db
        .select({ id: usersTable.id, fullName: usersTable.fullName })
        .from(usersTable)
        .where(inArray(usersTable.id, lastAssignedUserIds))
    : [];
  const userNameMap = new Map(userNameRows.map((u) => [u.id, u.fullName]));

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
  const yearStartTs = new Date(new Date().getFullYear(), 0, 1).getTime();

  for (const t of trucks) {
    const myLogs = (truckLogs.get(t.id) ?? []).slice().sort((a, b) => {
      return (
        new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
      );
    });
    const lifetime = myLogs.reduce((sum, l) => sum + (l.costCents ?? 0), 0);
    const ytd = myLogs.reduce(
      (sum, l) =>
        new Date(l.performedAt).getTime() >= yearStartTs ? sum + (l.costCents ?? 0) : sum,
      0,
    );
    // Service interval is anchored on the most recent SCHEDULED service that
    // captured a usage reading — that defines the next-due baseline.
    const lastScheduled = myLogs.find(
      (l) => l.kind === "SCHEDULED" && l.mileageAtService != null,
    );
    const lastService = myLogs[0] ?? null;
    const lastServiceUsage = lastScheduled?.mileageAtService ?? null;
    const usageSinceLastService =
      lastServiceUsage != null ? Math.max(0, t.currentMileage - lastServiceUsage) : null;
    const nextDueAt = (lastServiceUsage ?? 0) + t.serviceIntervalMiles;
    const usageUntilDue = nextDueAt - t.currentMileage;
    // Trailers share the trucks table but don't track usage. The UI hides
    // the odometer column for them, and we report serviceState=OK so they
    // don't pollute the "due soon / overdue" rollups.
    const isTrailer = t.vehicleType === "TRAILER";
    assets.push({
      kind: "TRUCK",
      category: isTrailer ? "TRAILER" : "TRUCK",
      customCategoryLabel: null,
      quantity: 1,
      id: t.id,
      slug: t.slug ?? makeAssetSlug("truck", t.id, t.name),
      name: t.name,
      brand: t.brand,
      model: t.model,
      identifier: t.vin,
      status: t.status,
      departmentId: t.departmentId ?? null,
      departmentName: t.departmentId != null ? (deptMap.get(t.departmentId) ?? null) : null,
      assignedCrewId: t.assignedCrewId ?? null,
      assignedCrewName:
        t.assignedCrewId != null ? (crewMap.get(t.assignedCrewId) ?? null) : null,
      lastAssignedAt: t.lastAssignedAt ? t.lastAssignedAt.toISOString() : null,
      lastAssignedByUserId: t.lastAssignedByUserId ?? null,
      lastAssignedByName:
        t.lastAssignedByUserId != null
          ? (userNameMap.get(t.lastAssignedByUserId) ?? null)
          : null,
      purchasePriceCents: t.purchasePriceCents,
      purchaseDate: t.purchaseDate ? t.purchaseDate.toISOString() : null,
      currentUsage: isTrailer ? 0 : t.currentMileage,
      usageUnit: isTrailer ? "NONE" : "MILES",
      serviceIntervalUsage: t.serviceIntervalMiles,
      lastServiceUsage,
      usageSinceLastService,
      nextServiceDueAt: nextDueAt,
      usageUntilDue: isTrailer ? USAGE_UNTIL_DUE_NA : usageUntilDue,
      serviceState: isTrailer
        ? "OK"
        : deriveServiceState(usageUntilDue, t.serviceIntervalMiles),
      lifeToDateSpendCents: lifetime,
      ytdSpendCents: ytd,
      costPerUsageCents:
        !isTrailer && t.currentMileage > 0
          ? Math.round(lifetime / t.currentMileage)
          : null,
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
    const ytd = myLogs.reduce(
      (sum, l) =>
        new Date(l.performedAt).getTime() >= yearStartTs ? sum + (l.costCents ?? 0) : sum,
      0,
    );
    const lastScheduled = myLogs.find(
      (l) => l.kind === "SCHEDULED" && l.hoursAtService != null,
    );
    const lastService = myLogs[0] ?? null;
    const lastServiceUsage = lastScheduled?.hoursAtService ?? null;
    const usageSinceLastService =
      lastServiceUsage != null ? Math.max(0, e.currentHours - lastServiceUsage) : null;
    const nextDueAt = (lastServiceUsage ?? 0) + e.serviceIntervalHours;
    const usageUntilDue = nextDueAt - e.currentHours;
    // Quantity-tracked items (typically zero or a single fixed run-time
    // engine) don't drive a service-due cadence — surface them as OK.
    const tracksHours = e.serviceIntervalHours > 0 && e.currentHours > 0;
    assets.push({
      kind: "EQUIPMENT",
      category: e.category,
      customCategoryLabel: e.customCategoryLabel ?? null,
      quantity: e.quantity ?? 1,
      id: e.id,
      slug: e.slug ?? makeAssetSlug("equip", e.id, e.name),
      name: e.name,
      brand: e.brand,
      model: e.model,
      identifier: e.serial,
      status: e.status,
      departmentId: e.departmentId ?? null,
      departmentName: e.departmentId != null ? (deptMap.get(e.departmentId) ?? null) : null,
      assignedCrewId: e.assignedCrewId ?? null,
      assignedCrewName:
        e.assignedCrewId != null ? (crewMap.get(e.assignedCrewId) ?? null) : null,
      lastAssignedAt: e.lastAssignedAt ? e.lastAssignedAt.toISOString() : null,
      lastAssignedByUserId: e.lastAssignedByUserId ?? null,
      lastAssignedByName:
        e.lastAssignedByUserId != null
          ? (userNameMap.get(e.lastAssignedByUserId) ?? null)
          : null,
      purchasePriceCents: e.purchasePriceCents,
      purchaseDate: e.purchaseDate ? e.purchaseDate.toISOString() : null,
      currentUsage: tracksHours ? e.currentHours : 0,
      usageUnit: tracksHours ? "HOURS" : "NONE",
      serviceIntervalUsage: e.serviceIntervalHours,
      lastServiceUsage,
      usageSinceLastService,
      nextServiceDueAt: nextDueAt,
      usageUntilDue: tracksHours ? usageUntilDue : USAGE_UNTIL_DUE_NA,
      serviceState: tracksHours
        ? deriveServiceState(usageUntilDue, e.serviceIntervalHours)
        : "OK",
      lifeToDateSpendCents: lifetime,
      ytdSpendCents: ytd,
      costPerUsageCents:
        tracksHours ? Math.round(lifetime / e.currentHours) : null,
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

// Per-kind viewer scope: filter assets to those the user is allowed to see.
function viewableKinds(
  user: NonNullable<import("express").Request["user"]>,
): Set<"TRUCK" | "EQUIPMENT"> {
  const kinds = new Set<"TRUCK" | "EQUIPMENT">();
  if (hasSectionAccess(user, "fleet.trucks", "view")) kinds.add("TRUCK");
  if (hasSectionAccess(user, "fleet.equipment", "view")) kinds.add("EQUIPMENT");
  return kinds;
}

function resolveDeptId(req: import("express").Request): number | undefined {
  const user = req.user!;
  if (user.role === "ADMIN") {
    const raw = req.query.departmentId;
    if (raw) {
      const parsed = parseInt(String(raw), 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
  return user.departmentId;
}

/**
 * For non-admin callers, verify the target truck/equipment belongs to the same
 * department as the caller.  Returns true on success (or for admins); returns
 * false after sending a 403/404 response so the caller can immediately return.
 */
async function assertAssetInScope(
  req: import("express").Request,
  res: import("express").Response,
  opts: { truckId?: number | null; equipmentId?: number | null },
): Promise<boolean> {
  const user = req.user!;
  if (user.role === "ADMIN") return true;

  const userDept = user.departmentId;

  if (opts.truckId != null) {
    const [truck] = await db
      .select({ departmentId: trucksTable.departmentId })
      .from(trucksTable)
      .where(eq(trucksTable.id, opts.truckId));
    if (!truck) {
      res.status(404).json({ error: "not_found" });
      return false;
    }
    if (truck.departmentId !== userDept) {
      res.status(403).json({ error: "forbidden", detail: "asset belongs to a different department" });
      return false;
    }
  }

  if (opts.equipmentId != null) {
    const [equip] = await db
      .select({ departmentId: equipmentTable.departmentId })
      .from(equipmentTable)
      .where(eq(equipmentTable.id, opts.equipmentId));
    if (!equip) {
      res.status(404).json({ error: "not_found" });
      return false;
    }
    if (equip.departmentId !== userDept) {
      res.status(403).json({ error: "forbidden", detail: "asset belongs to a different department" });
      return false;
    }
  }

  return true;
}

/**
 * Same as assertAssetInScope but resolves the asset from a maintenance log id.
 */
async function assertMaintenanceLogInScope(
  req: import("express").Request,
  res: import("express").Response,
  logId: number,
): Promise<boolean> {
  const user = req.user!;
  if (user.role === "ADMIN") return true;

  const [log] = await db
    .select({ truckId: maintenanceLogsTable.truckId, equipmentId: maintenanceLogsTable.equipmentId })
    .from(maintenanceLogsTable)
    .where(eq(maintenanceLogsTable.id, logId));
  if (!log) {
    res.status(404).json({ error: "not_found" });
    return false;
  }
  return assertAssetInScope(req, res, { truckId: log.truckId, equipmentId: log.equipmentId });
}

router.get("/assets", requireAuth, requireFleetView(), async (req, res) => {
  const allowed = viewableKinds(req.user!);
  const assets = (await buildAssetList(resolveDeptId(req))).filter((a) => allowed.has(a.kind));
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
    const allowed = viewableKinds(req.user!);
    const assets = (await buildAssetList()).filter((a) => allowed.has(a.kind));
    const asset = assets.find((a) => a.slug === params.data.slug);
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const rawLogs = asset.kind === "TRUCK"
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

    // Resolve logged-by user names in one batch query.
    const loggedByIds = [
      ...new Set(rawLogs.map((l) => l.loggedByUserId).filter((id): id is number => id != null)),
    ];
    const loggedByUsers =
      loggedByIds.length > 0
        ? await db
            .select({ id: usersTable.id, fullName: usersTable.fullName })
            .from(usersTable)
            .where(sql`${usersTable.id} = ANY(ARRAY[${sql.raw(loggedByIds.join(","))}]::int[])`)
        : [];
    const userNameMap = new Map(loggedByUsers.map((u) => [u.id, u.fullName]));
    const logs = rawLogs.map((l) => ({
      ...l,
      loggedByName: l.loggedByUserId ? (userNameMap.get(l.loggedByUserId) ?? null) : null,
    }));

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
    const allowedKinds = viewableKinds(req.user!);
    // Scope to user's department for non-admins so they cannot change status
    // of assets belonging to a different department.
    const assets = (await buildAssetList(resolveDeptId(req))).filter((a) => allowedKinds.has(a.kind));
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
    // Record the status transition for audit trail.
    if (asset.status !== status) {
      await db.insert(assetStatusLogTable).values({
        assetType: asset.kind,
        assetId: asset.id,
        oldStatus: asset.status,
        newStatus: status,
        changedByUserId: req.user?.id ?? null,
      });
    }
    // Re-query so we return the freshest summary, including derived fields.
    const refreshed = (await buildAssetList(resolveDeptId(req))).find((a) => a.slug === slug);
    res.json({ asset: refreshed, logs: [], recentReadings: [] });
  },
);

router.get(
  "/assets/:slug/status-history",
  requireAuth,
  requireFleetView(),
  async (req, res) => {
    const slug = String(req.params.slug ?? "");
    const allowedKinds = viewableKinds(req.user!);
    const assets = (await buildAssetList()).filter((a) => allowedKinds.has(a.kind));
    const asset = assets.find((a) => a.slug === slug);
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const rawHistory = await db
      .select()
      .from(assetStatusLogTable)
      .where(
        and(
          eq(assetStatusLogTable.assetType, asset.kind),
          eq(assetStatusLogTable.assetId, asset.id),
        ),
      )
      .orderBy(desc(assetStatusLogTable.changedAt))
      .limit(10);

    const changedByIds = [
      ...new Set(
        rawHistory.map((h) => h.changedByUserId).filter((id): id is number => id != null),
      ),
    ];
    const changedByUsers =
      changedByIds.length > 0
        ? await db
            .select({ id: usersTable.id, fullName: usersTable.fullName })
            .from(usersTable)
            .where(sql`${usersTable.id} = ANY(ARRAY[${sql.raw(changedByIds.join(","))}]::int[])`)
        : [];
    const userNameMap = new Map(changedByUsers.map((u) => [u.id, u.fullName]));
    const history = rawHistory.map((h) => ({
      ...h,
      changedAt: new Date(h.changedAt).toISOString(),
      changedByName: h.changedByUserId
        ? (userNameMap.get(h.changedByUserId) ?? null)
        : null,
    }));
    res.json({ history });
  },
);

// ---------- Crews ----------

const createCrewSchema = z.object({
  name: z.string().min(1).max(120),
  leadUserId: z.number().int().positive(),
  departmentId: z.number().int().positive().optional(),
});

// POST /crews — create a new crew. Requires fleet.trucks edit access (or admin).
router.post(
  "/crews",
  requireAuth,
  requireSection("fleet.trucks", "edit"),
  async (req, res) => {
    const parsed = createCrewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const { name, leadUserId, departmentId } = parsed.data;
    // Verify the lead user exists.
    const [leadUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, leadUserId));
    if (!leadUser) {
      res.status(400).json({ error: "lead_user_not_found" });
      return;
    }
    const [crew] = await db
      .insert(crewsTable)
      .values({ name, leadUserId, departmentId: departmentId ?? null })
      .returning();
    if (!crew) {
      res.status(500).json({ error: "insert_failed" });
      return;
    }
    // Auto-add the lead as a crew member.
    await db
      .insert(crewMembersTable)
      .values({ crewId: crew.id, userId: leadUserId })
      .onConflictDoNothing();
    res.status(201).json({ crew: { id: crew.id, name: crew.name } });
  },
);

// GET /crews — lightweight list for asset-assignment dropdowns.
// Anyone with fleet view permission can see crew names.
router.get(
  "/crews",
  requireAuth,
  requireFleetView(),
  async (_req, res) => {
    const rows = await db
      .select({ id: crewsTable.id, name: crewsTable.name })
      .from(crewsTable)
      .orderBy(crewsTable.name);
    res.json({ crews: rows });
  },
);

// GET /crews/:id — full crew detail: members + assigned trucks + equipment.
router.get(
  "/crews/:id",
  requireAuth,
  requireFleetView(),
  async (req, res) => {
    const crewId = Number(req.params.id);
    if (!Number.isFinite(crewId)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const [crew] = await db
      .select({ id: crewsTable.id, name: crewsTable.name })
      .from(crewsTable)
      .where(eq(crewsTable.id, crewId));
    if (!crew) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const memberRows = await db
      .select({
        userId: crewMembersTable.userId,
        fullName: usersTable.fullName,
        roleKey: rolesTable.key,
        roleLabel: rolesTable.label,
        deptLabel: departmentsTable.label,
      })
      .from(crewMembersTable)
      .innerJoin(usersTable, eq(crewMembersTable.userId, usersTable.id))
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .innerJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
      .where(eq(crewMembersTable.crewId, crewId));

    const trucks = await db
      .select({
        id: trucksTable.id,
        name: trucksTable.name,
        status: trucksTable.status,
        slug: trucksTable.slug,
      })
      .from(trucksTable)
      .where(eq(trucksTable.assignedCrewId, crewId));

    const equipment = await db
      .select({
        id: equipmentTable.id,
        name: equipmentTable.name,
        type: equipmentTable.type,
        status: equipmentTable.status,
        slug: equipmentTable.slug,
      })
      .from(equipmentTable)
      .where(eq(equipmentTable.assignedCrewId, crewId));

    res.json({
      crew: {
        ...crew,
        members: memberRows.map((m) => ({
          userId: m.userId,
          fullName: m.fullName,
          role: m.roleLabel,
          department: m.deptLabel,
        })),
        trucks,
        equipment,
      },
    });
  },
);

// ---------- Crew Assignment ----------
// POST /assets/:slug/assign — set or clear the assigned crew for any
// asset. Writes both the row's `assigned_crew_id` (and last-assigned
// metadata) and an audit log entry. Idempotent: if the new crew matches
// the current one, no log row is written. Set `crewId` to null to
// "return" the asset.
const assignAssetSchema = z.object({
  crewId: z.number().int().nullable(),
  note: z.string().max(500).optional(),
});

router.post(
  "/assets/:slug/assign",
  requireAuth,
  requireFleetView(),
  async (req, res) => {
    const slug = String(req.params.slug ?? "");
    const parsed = assignAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const { crewId: newCrewId, note } = parsed.data;

    // Require the same edit scope as status changes — assigning equipment
    // to a crew is an edit on the asset.
    const allowedKinds = viewableKinds(req.user!);
    const sectionForKind = (kind: "TRUCK" | "EQUIPMENT") =>
      kind === "TRUCK" ? "fleet.trucks" : "fleet.equipment";

    const assets = (await buildAssetList(resolveDeptId(req))).filter((a) =>
      allowedKinds.has(a.kind),
    );
    const asset = assets.find((a) => a.slug === slug);
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!hasSectionAccess(req.user!, sectionForKind(asset.kind), "edit")) {
      res.status(403).json({ error: "forbidden", section: sectionForKind(asset.kind), action: "edit" });
      return;
    }

    // Validate the crew exists if a non-null id was provided.
    if (newCrewId != null) {
      const [crew] = await db
        .select({ id: crewsTable.id })
        .from(crewsTable)
        .where(eq(crewsTable.id, newCrewId));
      if (!crew) {
        res.status(400).json({ error: "unknown_crew" });
        return;
      }
    }

    const oldCrewId = asset.assignedCrewId ?? null;
    const now = new Date();

    if (asset.kind === "TRUCK") {
      await db
        .update(trucksTable)
        .set({
          assignedCrewId: newCrewId ?? null,
          lastAssignedByUserId: req.user?.id ?? null,
          lastAssignedAt: now,
        })
        .where(eq(trucksTable.id, asset.id));
    } else {
      await db
        .update(equipmentTable)
        .set({
          assignedCrewId: newCrewId ?? null,
          lastAssignedByUserId: req.user?.id ?? null,
          lastAssignedAt: now,
        })
        .where(eq(equipmentTable.id, asset.id));
    }

    if ((oldCrewId ?? null) !== (newCrewId ?? null)) {
      await db.insert(assetAssignmentLogTable).values({
        assetType: asset.kind,
        assetId: asset.id,
        oldCrewId: oldCrewId,
        newCrewId: newCrewId ?? null,
        changedByUserId: req.user?.id ?? null,
        note: note ?? null,
      });
    }

    const refreshed = (await buildAssetList(resolveDeptId(req))).find((a) => a.slug === slug);
    res.json({ asset: refreshed });
  },
);

router.get(
  "/assets/:slug/assignment-history",
  requireAuth,
  requireFleetView(),
  async (req, res) => {
    const slug = String(req.params.slug ?? "");
    const allowedKinds = viewableKinds(req.user!);
    const assets = (await buildAssetList()).filter((a) => allowedKinds.has(a.kind));
    const asset = assets.find((a) => a.slug === slug);
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const rawHistory = await db
      .select()
      .from(assetAssignmentLogTable)
      .where(
        and(
          eq(assetAssignmentLogTable.assetType, asset.kind),
          eq(assetAssignmentLogTable.assetId, asset.id),
        ),
      )
      .orderBy(desc(assetAssignmentLogTable.changedAt))
      .limit(100);

    // Resolve crew names + actor names in batched queries so the response
    // is self-contained.
    const crewIds = Array.from(
      new Set(
        [
          ...rawHistory.map((h) => h.oldCrewId),
          ...rawHistory.map((h) => h.newCrewId),
        ].filter((id): id is number => id != null),
      ),
    );
    const userIds = Array.from(
      new Set(
        rawHistory.map((h) => h.changedByUserId).filter((id): id is number => id != null),
      ),
    );
    const [crewNameRows, userNameRows] = await Promise.all([
      crewIds.length
        ? db
            .select({ id: crewsTable.id, name: crewsTable.name })
            .from(crewsTable)
            .where(inArray(crewsTable.id, crewIds))
        : Promise.resolve([]),
      userIds.length
        ? db
            .select({ id: usersTable.id, fullName: usersTable.fullName })
            .from(usersTable)
            .where(inArray(usersTable.id, userIds))
        : Promise.resolve([]),
    ]);
    const crewNameMap = new Map(crewNameRows.map((r) => [r.id, r.name]));
    const userNameMap = new Map(userNameRows.map((r) => [r.id, r.fullName]));

    const history = rawHistory.map((h) => ({
      id: h.id,
      changedAt: new Date(h.changedAt).toISOString(),
      oldCrewId: h.oldCrewId,
      oldCrewName: h.oldCrewId != null ? crewNameMap.get(h.oldCrewId) ?? null : null,
      newCrewId: h.newCrewId,
      newCrewName: h.newCrewId != null ? crewNameMap.get(h.newCrewId) ?? null : null,
      changedByUserId: h.changedByUserId,
      changedByName:
        h.changedByUserId != null ? userNameMap.get(h.changedByUserId) ?? null : null,
      note: h.note ?? null,
    }));
    res.json({ history });
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
    // Verify non-admin callers can only record readings for their own dept's assets.
    if (!(await assertAssetInScope(req, res, { truckId, equipmentId }))) return;

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
router.get("/fleet-pulse", requireAuth, requireFleetView(), async (req, res) => {
  const allowedKinds = viewableKinds(req.user!);
  const assets = (await buildAssetList(resolveDeptId(req))).filter((a) => allowedKinds.has(a.kind));

  // Spec semantics:
  //   active        = status ACTIVE
  //   down          = RETIRED ("Out of Service")
  //   openRepairs   = IN_SHOP (currently being repaired)
  //   outOfService  = alias for down (kept for backward-compat consumers)
  const counts = {
    active: 0,
    down: 0,
    openRepairs: 0,
    inShop: 0,
    outOfService: 0,
    total: assets.length,
  };
  for (const a of assets) {
    if (a.status === "ACTIVE") counts.active++;
    else if (a.status === "IN_SHOP") {
      counts.inShop++;
      counts.openRepairs++;
    } else {
      counts.outOfService++;
      counts.down++;
    }
  }

  const overdue = assets
    .filter((a) => a.serviceState === "OVERDUE")
    .map(toPulseSummary);
  const dueSoon = assets
    .filter((a) => a.serviceState === "DUE_SOON")
    .map(toPulseSummary);
  // Top "money pits" rank by current-year spend (YTD), per spec.
  const topMoneyPits = assets
    .slice()
    .sort((a, b) => b.ytdSpendCents - a.ytdSpendCents)
    .slice(0, 5)
    .map(toPulseSummary);

  // Monthly spend for last 12 months — and a recent-maintenance feed.
  // Scope logs to the user's allowed asset kinds so financial aggregates
  // (totals, monthlySpend, recentMaintenance) never leak across permissions.
  const allTruckIds = new Set<number>();
  const allEquipIds = new Set<number>();
  for (const a of assets) {
    if (a.kind === "TRUCK") allTruckIds.add(a.id);
    else allEquipIds.add(a.id);
  }
  const allLogs = await db
    .select()
    .from(maintenanceLogsTable)
    .orderBy(desc(maintenanceLogsTable.performedAt));
  const logs = allLogs.filter((l) =>
    l.truckId
      ? allowedKinds.has("TRUCK") && allTruckIds.has(l.truckId)
      : l.equipmentId
        ? allowedKinds.has("EQUIPMENT") && allEquipIds.has(l.equipmentId)
        : false,
  );
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
  let mtd = 0;
  let ytd = 0;
  let lifetime = 0;
  const since30 = Date.now() - 30 * 86_400_000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
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
    if (t >= monthStart) mtd += c;
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
    totals: {
      mtdCents: mtd,
      last30DaysCents: last30,
      ytdCents: ytd,
      lifetimeCents: lifetime,
    },
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
    ytdSpendCents: a.ytdSpendCents,
  };
}

export default router;
