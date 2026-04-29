import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListAssets } from "@workspace/api-client-react";
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

export function AssetRegistry() {
  const { data, isLoading } = useListAssets();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | "TRUCK" | "EQUIPMENT">("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "IN_SHOP" | "RETIRED"
  >("ALL");

  const assets = data?.assets ?? [];

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (kindFilter !== "ALL" && a.kind !== kindFilter) return false;
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const haystack = [a.name, a.brand ?? "", a.model ?? "", a.identifier ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [assets, query, kindFilter, statusFilter]);

  const totals = useMemo(() => {
    const overdue = assets.filter((a) => a.serviceState === "OVERDUE").length;
    const dueSoon = assets.filter((a) => a.serviceState === "DUE_SOON").length;
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
            value={kindFilter}
            onValueChange={(v) =>
              setKindFilter(v as "ALL" | "TRUCK" | "EQUIPMENT")
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All kinds</SelectItem>
              <SelectItem value="TRUCK">Trucks</SelectItem>
              <SelectItem value="EQUIPMENT">Equipment</SelectItem>
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
                <TableHead className="w-[30%]">Asset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="text-right">Life-to-date</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow
                  key={`${a.kind}-${a.id}`}
                  data-testid={`asset-row-${a.slug}`}
                >
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {a.kind === "TRUCK" ? (
                          <Truck className="h-4 w-4" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
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
                    <Badge variant="outline" className={statusBadgeClass(a.status)}>
                      {statusLabel(a.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <ServiceBadge state={a.serviceState} />
                      <div className="text-xs text-muted-foreground">
                        {a.usageUntilDue >= 0
                          ? `${num(a.usageUntilDue)} ${a.usageUnit.toLowerCase()} until due`
                          : `${num(Math.abs(a.usageUntilDue))} ${a.usageUnit.toLowerCase()} overdue`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {num(a.currentUsage)}
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {a.usageUnit === "MILES" ? "miles" : "hours"}
                    </div>
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
              ))}
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
