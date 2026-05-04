import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListAssets, type Asset } from "@workspace/api-client-react";
import { useListCrews, type AssetExt } from "@/lib/extra-api";
import { useDepartmentFilter } from "@/context/DepartmentContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  // RETIRED / "Out of Service" — flag clearly red so a glance at the registry
  // makes it obvious which trucks are off the road for safety reasons.
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

// The orval-generated `Asset` type doesn't yet know about the new
// server fields, and its `usageUnit` is narrower than what we now
// return (NONE for trailers / quantity items). We omit the conflicting
// field so the AssetExt override actually widens it.
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

export function AssetRegistry() {
  const { activeDeptId } = useDepartmentFilter();
  const { data, isLoading } = useListAssets(activeDeptId != null ? { departmentId: activeDeptId } : {});
  const { data: crewsData } = useListCrews();
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
    // "Service" rollups only count usage-tracked assets (trucks +
    // hour-metered equipment) — quantity-tracked items don't have a
    // due-date concept and shouldn't inflate "OK" counts either.
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
              {crews.map((c) => (
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
