import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListAssets, useListDepartments, useGetMe, type Asset } from "@workspace/api-client-react";
import {
  useListCrews,
  useCreateTruck,
  useCreateEquipment,
  type AssetExt,
  type Crew,
  type CreateTruckBody,
  type CreateEquipmentBody,
} from "@/lib/extra-api";
import { useDepartmentFilter } from "@/context/DepartmentContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  QrCode,
  DollarSign,
  Building2,
  Users as UsersIcon,
  Caravan,
  Hammer,
  Boxes,
  Plus,
} from "lucide-react";

const usd = (cents: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);

const num = (n: number) => new Intl.NumberFormat("en-US").format(n);

function statusLabel(status: string) {
  if (status === "ACTIVE") return "Active";
  if (status === "IN_SHOP") return "In Shop";
  return "Out of Service";
}

function statusBadgeClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (status === "IN_SHOP") return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-rose-100 text-rose-900 border-rose-300";
}

function ServiceBadge({ state }: { state: "OK" | "DUE_SOON" | "OVERDUE" }) {
  if (state === "OVERDUE") {
    return (
      <Badge className="border-rose-200 bg-rose-100 text-rose-900 hover:bg-rose-100">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Overdue
      </Badge>
    );
  }
  if (state === "DUE_SOON") {
    return (
      <Badge className="border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100">
        <Clock className="mr-1 h-3 w-3" />
        Due Soon
      </Badge>
    );
  }
  return (
    <Badge className="border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
      <CheckCircle2 className="mr-1 h-3 w-3" />
      OK
    </Badge>
  );
}

type SortKey = "NAME" | "STATUS" | "SERVICE_DUE" | "YTD_SPEND" | "LIFETIME_SPEND";
type CategoryFilter = "ALL" | "TRUCK" | "TRAILER" | "HANDHELD" | "CUSTOM";

const SERVICE_RANK = { OVERDUE: 0, DUE_SOON: 1, OK: 2 };

type RegistryAsset = Omit<Asset, "usageUnit"> & AssetExt;

function categoryIcon(c: AssetExt["category"]) {
  if (c === "TRUCK") return Truck;
  if (c === "TRAILER") return Caravan;
  if (c === "HANDHELD") return Hammer;
  return Boxes;
}

function categoryLabel(a: RegistryAsset) {
  if (a.category === "CUSTOM") return a.customCategoryLabel || "Custom";
  if (a.category === "HANDHELD") return "Handheld";
  if (a.category === "TRAILER") return "Trailer";
  return "Truck";
}

type AssetKind = "truck" | "equipment";

function AddAssetDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AssetKind>("truck");
  const [error, setError] = useState<string | null>(null);

  const { data: deptsData } = useListDepartments();
  const depts = deptsData?.departments ?? [];

  const createTruck = useCreateTruck();
  const createEquipment = useCreateEquipment();
  const isPending = createTruck.isPending || createEquipment.isPending;

  const [form, setForm] = useState({
    name: "",
    departmentId: "",
    vehicleType: "TRUCK" as "TRUCK" | "TRAILER",
    brand: "",
    model: "",
    vin: "",
    plate: "",
    serial: "",
    type: "CHAINSAW",
    category: "HANDHELD" as "HANDHELD" | "CUSTOM",
    customCategoryLabel: "",
    purchasePrice: "",
    purchaseDate: "",
    mileage: "",
    serviceIntervalMiles: "",
    hours: "",
    serviceIntervalHours: "",
  });

  function field(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const deptId = Number(form.departmentId);
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!deptId) { setError("Department is required."); return; }

    try {
      if (kind === "truck") {
        const body: CreateTruckBody = {
          name: form.name.trim(),
          vehicleType: form.vehicleType,
          departmentId: deptId,
          brand: form.brand.trim() || undefined,
          model: form.model.trim() || undefined,
          vin: form.vin.trim() || undefined,
          plate: form.plate.trim() || undefined,
          purchasePriceCents: form.purchasePrice ? Math.round(parseFloat(form.purchasePrice) * 100) : undefined,
          purchaseDate: form.purchaseDate || undefined,
          currentMileage: form.mileage ? Number(form.mileage) : undefined,
          serviceIntervalMiles: form.serviceIntervalMiles ? Number(form.serviceIntervalMiles) : undefined,
        };
        await createTruck.mutateAsync(body);
      } else {
        if (!form.type.trim()) { setError("Equipment type is required."); return; }
        const body: CreateEquipmentBody = {
          name: form.name.trim(),
          type: form.type.trim(),
          category: form.category,
          customCategoryLabel: form.category === "CUSTOM" ? form.customCategoryLabel.trim() : undefined,
          departmentId: deptId,
          brand: form.brand.trim() || undefined,
          model: form.model.trim() || undefined,
          serial: form.serial.trim() || undefined,
          purchasePriceCents: form.purchasePrice ? Math.round(parseFloat(form.purchasePrice) * 100) : undefined,
          purchaseDate: form.purchaseDate || undefined,
          currentHours: form.hours ? Number(form.hours) : undefined,
          serviceIntervalHours: form.serviceIntervalHours ? Number(form.serviceIntervalHours) : undefined,
        };
        await createEquipment.mutateAsync(body);
      }
      onCreated();
      setOpen(false);
      setForm({ name: "", departmentId: "", vehicleType: "TRUCK", brand: "", model: "", vin: "", plate: "", serial: "", type: "CHAINSAW", category: "HANDHELD", customCategoryLabel: "", purchasePrice: "", purchaseDate: "", mileage: "", serviceIntervalMiles: "", hours: "", serviceIntervalHours: "" });
    } catch {
      setError("Failed to create asset. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("truck")}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${kind === "truck" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent"}`}
            >
              <Truck className="h-4 w-4" /> Truck / Trailer
            </button>
            <button
              type="button"
              onClick={() => setKind("equipment")}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${kind === "equipment" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent"}`}
            >
              <Hammer className="h-4 w-4" /> Equipment
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="asset-name">Name *</Label>
              <Input id="asset-name" value={form.name} onChange={e => field("name", e.target.value)} placeholder={kind === "truck" ? "T-06 Service Truck" : "Husqvarna Chainsaw"} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="asset-dept">Department *</Label>
              <Select value={form.departmentId} onValueChange={v => field("departmentId", v)}>
                <SelectTrigger id="asset-dept" className="mt-1">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {depts.map((d: { id: number; key: string; label: string }) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {kind === "truck" ? (
              <>
                <div>
                  <Label>Type</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(["TRUCK", "TRAILER"] as const).map(vt => (
                      <button key={vt} type="button" onClick={() => field("vehicleType", vt)}
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${form.vehicleType === vt ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent"}`}>
                        {vt === "TRUCK" ? "Truck" : "Trailer"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="asset-brand">Brand</Label>
                    <Input id="asset-brand" value={form.brand} onChange={e => field("brand", e.target.value)} placeholder="Ford" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="asset-model">Model</Label>
                    <Input id="asset-model" value={form.model} onChange={e => field("model", e.target.value)} placeholder="F-550" className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="asset-vin">VIN</Label>
                    <Input id="asset-vin" value={form.vin} onChange={e => field("vin", e.target.value)} placeholder="1FDXX000..." className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="asset-plate">Plate</Label>
                    <Input id="asset-plate" value={form.plate} onChange={e => field("plate", e.target.value)} placeholder="ABC-1234" className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="asset-mileage">Current Mileage</Label>
                    <Input id="asset-mileage" type="number" min="0" value={form.mileage} onChange={e => field("mileage", e.target.value)} placeholder="0" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="asset-interval-mi">Service Interval (mi)</Label>
                    <Input id="asset-interval-mi" type="number" min="0" value={form.serviceIntervalMiles} onChange={e => field("serviceIntervalMiles", e.target.value)} placeholder="5000" className="mt-1" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="asset-type">Equipment Type *</Label>
                  <Input id="asset-type" value={form.type} onChange={e => field("type", e.target.value)} placeholder="CHAINSAW" className="mt-1" />
                </div>
                <div>
                  <Label>Category</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(["HANDHELD", "CUSTOM"] as const).map(cat => (
                      <button key={cat} type="button" onClick={() => field("category", cat)}
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${form.category === cat ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent"}`}>
                        {cat === "HANDHELD" ? "Handheld" : "Custom"}
                      </button>
                    ))}
                  </div>
                </div>
                {form.category === "CUSTOM" && (
                  <div>
                    <Label htmlFor="asset-custom-label">Custom Category Label *</Label>
                    <Input id="asset-custom-label" value={form.customCategoryLabel} onChange={e => field("customCategoryLabel", e.target.value)} placeholder="e.g. Sprayer" className="mt-1" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="asset-brand-eq">Brand</Label>
                    <Input id="asset-brand-eq" value={form.brand} onChange={e => field("brand", e.target.value)} placeholder="Husqvarna" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="asset-model-eq">Model</Label>
                    <Input id="asset-model-eq" value={form.model} onChange={e => field("model", e.target.value)} placeholder="455 Rancher" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="asset-serial">Serial Number</Label>
                  <Input id="asset-serial" value={form.serial} onChange={e => field("serial", e.target.value)} placeholder="SN-123456" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="asset-hours">Current Hours</Label>
                    <Input id="asset-hours" type="number" min="0" value={form.hours} onChange={e => field("hours", e.target.value)} placeholder="0" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="asset-interval-hr">Service Interval (hrs)</Label>
                    <Input id="asset-interval-hr" type="number" min="0" value={form.serviceIntervalHours} onChange={e => field("serviceIntervalHours", e.target.value)} placeholder="50" className="mt-1" />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="asset-price">Purchase Price ($)</Label>
                <Input id="asset-price" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={e => field("purchasePrice", e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="asset-date">Purchase Date</Label>
                <Input id="asset-date" type="date" value={form.purchaseDate} onChange={e => field("purchaseDate", e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : `Add ${kind === "truck" ? "Vehicle" : "Equipment"}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssetRegistry() {
  const { activeDeptId } = useDepartmentFilter();
  const { data, isLoading, refetch } = useListAssets(activeDeptId != null ? { departmentId: activeDeptId } : {});
  const { data: crewsData } = useListCrews();
  const { data: meData } = useGetMe();
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (meData?.user as any)?.permissions as Record<string, { canView: boolean; canEdit: boolean }> | undefined;
  const canEditFleet = perms?.["fleet.trucks"]?.canEdit ?? false;
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [crewFilter, setCrewFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "IN_SHOP" | "RETIRED"
  >("ALL");
  const [dueFilter, setDueFilter] = useState<
    "ALL" | "OVERDUE" | "DUE_SOON" | "OK"
  >("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("SERVICE_DUE");

  const assets = (data?.assets ?? []) as RegistryAsset[];
  const crews = crewsData?.crews ?? [];

  function handleAssetCreated() {
    queryClient.invalidateQueries();
    refetch();
  }

  const filtered = useMemo(() => {
    const list = assets.filter((a) => {
      if (categoryFilter !== "ALL" && a.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (dueFilter !== "ALL" && a.serviceState !== dueFilter) return false;
      if (crewFilter !== "ALL") {
        if (crewFilter === "UNASSIGNED") {
          if (a.assignedCrewId != null) return false;
        } else if (String(a.assignedCrewId ?? "") !== crewFilter) {
          return false;
        }
      }
      if (query) {
        const q = query.toLowerCase();
        const haystack = [
          a.name,
          a.brand ?? "",
          a.model ?? "",
          a.identifier ?? "",
          a.customCategoryLabel ?? "",
          a.assignedCrewName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (sortKey === "NAME") return a.name.localeCompare(b.name);
      if (sortKey === "STATUS") return a.status.localeCompare(b.status);
      if (sortKey === "SERVICE_DUE")
        return (
          SERVICE_RANK[a.serviceState as keyof typeof SERVICE_RANK] -
          SERVICE_RANK[b.serviceState as keyof typeof SERVICE_RANK]
        );
      if (sortKey === "YTD_SPEND") return (b.ytdSpendCents ?? 0) - (a.ytdSpendCents ?? 0);
      if (sortKey === "LIFETIME_SPEND") return b.lifeToDateSpendCents - a.lifeToDateSpendCents;
      return 0;
    });
    return list;
  }, [assets, query, categoryFilter, crewFilter, statusFilter, dueFilter, sortKey]);

  const totals = useMemo(() => {
    const trackedAssets = assets.filter((a) => a.usageUnit !== "NONE");
    const overdue = trackedAssets.filter((a) => a.serviceState === "OVERDUE").length;
    const dueSoon = trackedAssets.filter((a) => a.serviceState === "DUE_SOON").length;
    const lifetime = assets.reduce((s, a) => s + a.lifeToDateSpendCents, 0);
    return { overdue, dueSoon, lifetime, count: assets.length };
  }, [assets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Smart Asset Registry</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every truck and piece of equipment in one place. Scan a QR code or click in to log work.
          </p>
        </div>
        {canEditFleet && <AddAssetDialog onCreated={handleAssetCreated} />}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Assets" value={isLoading ? "—" : num(totals.count)} icon={Package} />
        <KpiCard
          label="Overdue Service"
          value={isLoading ? "—" : num(totals.overdue)}
          tone={totals.overdue > 0 ? "rose" : "neutral"}
          icon={AlertTriangle}
        />
        <KpiCard
          label="Due Soon"
          value={isLoading ? "—" : num(totals.dueSoon)}
          tone={totals.dueSoon > 0 ? "amber" : "neutral"}
          icon={Clock}
        />
        <KpiCard
          label="Lifetime Spend"
          value={isLoading ? "—" : usd(totals.lifetime)}
          icon={DollarSign}
        />
      </div>

      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Input
            placeholder="Search by name, brand, model, VIN/serial…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              <SelectItem value="TRUCK">Trucks</SelectItem>
              <SelectItem value="TRAILER">Trailers</SelectItem>
              <SelectItem value="HANDHELD">Handheld</SelectItem>
              <SelectItem value="CUSTOM">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={crewFilter} onValueChange={(v) => setCrewFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All crews</SelectItem>
              <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
              {crews.map((c: Crew) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as "ALL" | "ACTIVE" | "IN_SHOP" | "RETIRED")
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="IN_SHOP">In Shop</SelectItem>
              <SelectItem value="RETIRED">Out of Service</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dueFilter}
            onValueChange={(v) =>
              setDueFilter(v as "ALL" | "OVERDUE" | "DUE_SOON" | "OK")
            }
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All due statuses</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="DUE_SOON">Due soon</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortKey}
            onValueChange={(v) => setSortKey(v as SortKey)}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SERVICE_DUE">Sort: Service due</SelectItem>
              <SelectItem value="NAME">Sort: Name A–Z</SelectItem>
              <SelectItem value="STATUS">Sort: Status</SelectItem>
              <SelectItem value="YTD_SPEND">Sort: YTD Spend</SelectItem>
              <SelectItem value="LIFETIME_SPEND">Sort: Lifetime Spend</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            Showing <span className="font-mono">{filtered.length}</span> of{" "}
            <span className="font-mono">{assets.length}</span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border bg-card py-12 text-center text-muted-foreground">
          No assets match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Asset</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Crew</TableHead>
                <TableHead>Status</TableHead>
                {!activeDeptId && <TableHead>Department</TableHead>}
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="text-right">Life-to-date</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const Icon = categoryIcon(a.category);
                const tracksUsage = a.usageUnit !== "NONE";
                const usageWord = a.usageUnit === "MILES" ? "miles" : "hours";
                return (
                  <TableRow
                    key={`${a.kind}-${a.id}`}
                    data-testid={`asset-row-${a.slug}`}
                  >
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <Link
                            href={`/assets/${a.slug}`}
                            className="font-semibold hover:underline"
                          >
                            {a.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {[a.brand, a.model].filter(Boolean).join(" · ") ||
                              "No make/model"}
                          </div>
                          {a.identifier && (
                            <div className="font-mono text-[11px] text-muted-foreground/80">
                              {a.kind === "TRUCK" ? "VIN" : "S/N"} {a.identifier}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">{categoryLabel(a)}</span>
                        {a.quantity > 1 && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            qty {num(a.quantity)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.assignedCrewName ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-sm">
                            <UsersIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {a.assignedCrewName}
                          </span>
                          {a.lastAssignedByName && (
                            <span className="text-[11px] text-muted-foreground">
                              by {a.lastAssignedByName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(a.status)}>
                        {statusLabel(a.status)}
                      </Badge>
                    </TableCell>
                    {!activeDeptId && (
                      <TableCell>
                        {a.departmentName ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3 shrink-0" />
                            {a.departmentName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      {tracksUsage ? (
                        <div className="space-y-1">
                          <ServiceBadge state={a.serviceState} />
                          <div className="text-xs text-muted-foreground">
                            {a.usageUntilDue >= 0
                              ? `${num(a.usageUntilDue)} ${usageWord} until due`
                              : `${num(Math.abs(a.usageUntilDue))} ${usageWord} overdue`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {tracksUsage ? (
                        <>
                          {num(a.currentUsage)}
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {a.usageUnit === "MILES" ? "miles" : "hours"}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {usd(a.lifeToDateSpendCents)}
                    </TableCell>
                    <TableCell>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        data-testid={`asset-open-${a.slug}`}
                      >
                        <Link href={`/assets/${a.slug}`}>
                          <QrCode className="h-3.5 w-3.5" />
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "rose" | "amber";
}) {
  const toneClass =
    tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-foreground";
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
