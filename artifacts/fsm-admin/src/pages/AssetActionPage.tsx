import { useState } from "react";
import { useParams, Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAssetBySlug,
  getGetAssetBySlugQueryKey,
  useCreateUsageReading,
  useCreateMaintenanceLog,
  useSetAssetStatus,
  useGetAssetStatusHistory,
  getGetAssetStatusHistoryQueryKey,
  getListMaintenanceLogsQueryKey,
  getListAssetsQueryKey,
  getGetFleetPulseQueryKey,
  useListDepartments,
  useUpdateTruck,
  useUpdateEquipment,
} from "@workspace/api-client-react";
import { useDepartmentFilter } from "@/context/DepartmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Truck,
  Package,
  ArrowLeft,
  Wrench,
  Gauge,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  DollarSign,
  Tag,
  Printer,
  ShieldAlert,
  TrendingUp,
  History,
  User,
  Building2,
} from "lucide-react";

const usd = (cents: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((cents ?? 0) / 100);

const num = (n: number) => new Intl.NumberFormat("en-US").format(n);

function statusLabel(status: string) {
  if (status === "ACTIVE") return "Active";
  if (status === "IN_SHOP") return "In Shop";
  return "Out of Service";
}

function printQrLabel(name: string, slug: string, url: string) {
  // Serialize the QR SVG already rendered on the page so we don't pull
  // a remote QR generator (works offline, no extra deps).
  const svgEl = document.querySelector<SVGSVGElement>(
    "[data-testid='asset-qr-code']",
  );
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", "240");
  clone.setAttribute("height", "240");
  const svgMarkup = new XMLSerializer().serializeToString(clone);
  const win = window.open("", "qr-label", "width=420,height=520");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>${escapeHtml(name)} — QR label</title>
    <style>
      body { font-family: 'Inter Tight', system-ui, sans-serif; padding: 16px; text-align: center; margin: 0; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .meta { font-family: ui-monospace, monospace; color: #555; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 12px; }
      .url { font-family: ui-monospace, monospace; font-size: 10px; color: #777; margin-top: 8px; word-break: break-all; }
      svg { display: block; margin: 0 auto; }
      @page { margin: 12mm; }
    </style></head><body>
      <h1>${escapeHtml(name)}</h1>
      <div class="meta">${escapeHtml(slug)}</div>
      ${svgMarkup}
      <div class="url">${escapeHtml(url)}</div>
      <script>setTimeout(function(){ window.print(); }, 50);</script>
    </body></html>`,
  );
  win.document.close();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function AssetActionPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data, isLoading } = useGetAssetBySlug(slug);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data?.asset) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/assets">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to registry
          </Link>
        </Button>
        <div className="rounded-md border bg-card py-16 text-center text-muted-foreground">
          Asset not found.
        </div>
      </div>
    );
  }

  const asset = data.asset;
  const logs = data.logs ?? [];
  const qrUrl = `${window.location.origin}${window.location.pathname.replace(/\/assets\/.*/, "")}/assets/${asset.slug}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/assets">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to registry
          </Link>
        </Button>
        <Badge
          variant="outline"
          className="font-mono text-[10px] uppercase tracking-wider"
        >
          {asset.kind === "TRUCK" ? "Truck" : "Equipment"} · {asset.slug}
        </Badge>
      </div>

      <Card className="border-border/60">
        <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                {asset.kind === "TRUCK" ? (
                  <Truck className="h-6 w-6" />
                ) : (
                  <Package className="h-6 w-6" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{asset.name}</h1>
                <div className="text-sm text-muted-foreground">
                  {[asset.brand, asset.model].filter(Boolean).join(" · ") ||
                    "Make / model not set"}
                </div>
              </div>
            </div>
            <ServiceStateBanner asset={asset} />
            {asset.departmentName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>{asset.departmentName}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-5">
              <Stat label="Status" value={statusLabel(asset.status)} icon={Tag} />
              <Stat
                label={asset.usageUnit === "MILES" ? "Odometer" : "Engine hours"}
                value={`${num(asset.currentUsage)} ${asset.usageUnit === "MILES" ? "mi" : "hrs"}`}
                icon={Gauge}
              />
              <Stat
                label="Life-to-date"
                value={usd(asset.lifeToDateSpendCents)}
                icon={DollarSign}
              />
              <Stat
                label={asset.usageUnit === "MILES" ? "Cost / mile" : "Cost / hour"}
                value={
                  asset.costPerUsageCents != null
                    ? `${usd(asset.costPerUsageCents)}/${asset.usageUnit === "MILES" ? "mi" : "hr"}`
                    : "—"
                }
                icon={TrendingUp}
              />
              <Stat
                label="Purchased"
                value={
                  asset.purchaseDate
                    ? new Date(asset.purchaseDate).toLocaleDateString()
                    : "—"
                }
                icon={Calendar}
              />
            </div>
            {asset.purchasePriceCents != null && (
              <div className="text-xs text-muted-foreground">
                Original purchase price{" "}
                <span className="font-mono">{usd(asset.purchasePriceCents)}</span>
                {asset.identifier && (
                  <>
                    {" · "}
                    {asset.kind === "TRUCK" ? "VIN" : "Serial"}{" "}
                    <span className="font-mono">{asset.identifier}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-4">
            <QRCodeSVG
              value={qrUrl}
              size={130}
              data-testid="asset-qr-code"
              level="M"
            />
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Scan to open
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 gap-1.5"
              onClick={() => printQrLabel(asset.name, asset.slug, qrUrl)}
              data-testid="print-qr-button"
            >
              <Printer className="h-3.5 w-3.5" /> Print label
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="actions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
          <TabsTrigger value="ledger">
            Maintenance Ledger ({logs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <UsageReadingForm asset={asset} />
            <QuickServiceForm asset={asset} />
          </div>
          <ChangeStatusCard asset={asset} />
          <ChangeDepartmentCard asset={asset} />
          <StatusHistoryCard slug={asset.slug} />
        </TabsContent>

        <TabsContent value="ledger">
          <Card className="border-border/60">
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No maintenance recorded yet.
                </div>
              ) : (
                <ul className="divide-y">
                  {logs.map((log) => (
                    <li key={log.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {log.kind}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.performedAt).toLocaleDateString()}
                          </span>
                          {(log.mileageAtService ?? log.hoursAtService) != null && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              @ {num(log.mileageAtService ?? log.hoursAtService ?? 0)}{" "}
                              {asset.usageUnit === "MILES" ? "mi" : "hrs"}
                            </span>
                          )}
                          {log.loggedByName && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <User className="h-3 w-3" />
                              {log.loggedByName}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-medium">{log.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold">
                          {usd(log.costCents)}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {usd(log.laborCostCents)} labor · {usd(log.partsCostCents)} parts
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ServiceStateBanner({
  asset,
}: {
  asset: { serviceState: "OK" | "DUE_SOON" | "OVERDUE"; usageUntilDue: number; usageUnit: "MILES" | "HOURS"; serviceIntervalUsage: number };
}) {
  const unit = asset.usageUnit === "MILES" ? "miles" : "hours";
  if (asset.serviceState === "OVERDUE") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
        <AlertTriangle className="h-4 w-4" />
        <span>
          <strong>Overdue</strong> by {num(Math.abs(asset.usageUntilDue))} {unit}.
          Service interval is every {num(asset.serviceIntervalUsage)} {unit}.
        </span>
      </div>
    );
  }
  if (asset.serviceState === "DUE_SOON") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <Clock className="h-4 w-4" />
        <span>
          Due soon — only {num(asset.usageUntilDue)} {unit} remaining before next service.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      <CheckCircle2 className="h-4 w-4" />
      <span>
        On schedule — {num(asset.usageUntilDue)} {unit} until next service.
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function UsageReadingForm({
  asset,
}: {
  asset: {
    kind: "TRUCK" | "EQUIPMENT";
    id: number;
    slug: string;
    usageUnit: "MILES" | "HOURS";
    currentUsage: number;
  };
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useCreateUsageReading();
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Enter a positive reading", variant: "destructive" });
      return;
    }
    if (n < asset.currentUsage) {
      toast({
        title: "Reading lower than current",
        description: `Current is ${num(asset.currentUsage)}. Saving anyway will not roll back the asset.`,
      });
    }
    const payload = {
      truckId: asset.kind === "TRUCK" ? asset.id : null,
      equipmentId: asset.kind === "EQUIPMENT" ? asset.id : null,
      mileage: asset.usageUnit === "MILES" ? n : null,
      hours: asset.usageUnit === "HOURS" ? n : null,
      notes: notes || null,
    };
    mutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetAssetBySlugQueryKey(asset.slug),
          });
          queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetFleetPulseQueryKey() });
          toast({ title: "Reading recorded" });
          setValue("");
          setNotes("");
        },
        onError: () =>
          toast({ title: "Could not save reading", variant: "destructive" }),
      },
    );
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4" /> Log Usage Reading
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="usage-reading">
              {asset.usageUnit === "MILES" ? "Odometer (miles)" : "Engine hours"}
            </Label>
            <Input
              id="usage-reading"
              type="number"
              min="0"
              value={value}
              placeholder={String(asset.currentUsage)}
              onChange={(e) => setValue(e.target.value)}
              data-testid="usage-reading-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="usage-notes">Notes (optional)</Label>
            <Textarea
              id="usage-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
            data-testid="usage-reading-submit"
          >
            Save Reading
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function QuickServiceForm({
  asset,
}: {
  asset: {
    kind: "TRUCK" | "EQUIPMENT";
    id: number;
    slug: string;
    usageUnit: "MILES" | "HOURS";
    currentUsage: number;
  };
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useCreateMaintenanceLog();
  const [kind, setKind] = useState("REPAIR");
  const [description, setDescription] = useState("");
  const [labor, setLabor] = useState("");
  const [parts, setParts] = useState("");
  const [usageAt, setUsageAt] = useState(String(asset.currentUsage));

  const total =
    (parseFloat(labor || "0") || 0) + (parseFloat(parts || "0") || 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    const usageNum = parseInt(usageAt, 10);
    const payload = {
      truckId: asset.kind === "TRUCK" ? asset.id : null,
      equipmentId: asset.kind === "EQUIPMENT" ? asset.id : null,
      kind,
      description: description.trim(),
      performedAt: new Date().toISOString(),
      laborCostCents: Math.round((parseFloat(labor || "0") || 0) * 100),
      partsCostCents: Math.round((parseFloat(parts || "0") || 0) * 100),
      mileageAtService:
        asset.usageUnit === "MILES" && Number.isFinite(usageNum) ? usageNum : null,
      hoursAtService:
        asset.usageUnit === "HOURS" && Number.isFinite(usageNum) ? usageNum : null,
    };
    mutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetAssetBySlugQueryKey(asset.slug),
          });
          queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListMaintenanceLogsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetFleetPulseQueryKey() });
          toast({ title: "Service logged" });
          setDescription("");
          setLabor("");
          setParts("");
        },
        onError: () =>
          toast({ title: "Could not log service", variant: "destructive" }),
      },
    );
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-4 w-4" /> Log Service
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger data-testid="service-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="REPAIR">Repair</SelectItem>
                  <SelectItem value="INSPECTION">Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="usage-at">
                {asset.usageUnit === "MILES" ? "Odometer at service" : "Hours at service"}
              </Label>
              <Input
                id="usage-at"
                type="number"
                value={usageAt}
                onChange={(e) => setUsageAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-desc">Description</Label>
            <Textarea
              id="service-desc"
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="service-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="labor-cost">Labor ($)</Label>
              <Input
                id="labor-cost"
                type="number"
                step="0.01"
                min="0"
                value={labor}
                onChange={(e) => setLabor(e.target.value)}
                data-testid="labor-cost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parts-cost">Parts ($)</Label>
              <Input
                id="parts-cost"
                type="number"
                step="0.01"
                min="0"
                value={parts}
                onChange={(e) => setParts(e.target.value)}
                data-testid="parts-cost"
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total auto-calculated</span>
            <span className="font-mono text-base font-semibold" data-testid="service-total">
              {usd(Math.round(total * 100))}
            </span>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
            data-testid="service-submit"
          >
            Save Service Entry
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ChangeDepartmentCard({
  asset,
}: {
  asset: { slug: string; kind: string; id: number; departmentId?: number | null };
}) {
  const { isAdmin } = useDepartmentFilter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: deptData } = useListDepartments();
  const departments = deptData?.departments ?? [];
  const updateTruck = useUpdateTruck();
  const updateEquipment = useUpdateEquipment();

  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    asset.departmentId != null ? String(asset.departmentId) : "",
  );
  const [touched, setTouched] = useState(false);

  if (!isAdmin || departments.length === 0) return null;

  const currentVal = asset.departmentId != null ? String(asset.departmentId) : "";
  const dirty = touched && selectedDeptId !== currentVal && selectedDeptId !== "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || selectedDeptId === "") return;
    const deptId = Number(selectedDeptId);
    const opts = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAssetBySlugQueryKey(asset.slug) });
        queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetFleetPulseQueryKey() });
        toast({ title: "Department updated" });
        setTouched(false);
      },
      onError: () => toast({ title: "Could not update department", variant: "destructive" }),
    };
    if (asset.kind === "TRUCK") {
      updateTruck.mutate({ id: asset.id, data: { departmentId: deptId } }, opts);
    } else {
      updateEquipment.mutate({ id: asset.id, data: { departmentId: deptId } }, opts);
    }
  };

  const isPending = updateTruck.isPending || updateEquipment.isPending;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" /> Assign Department
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="asset-dept">Department</Label>
            <Select
              value={selectedDeptId}
              onValueChange={(v) => {
                setSelectedDeptId(v);
                setTouched(true);
              }}
            >
              <SelectTrigger id="asset-dept" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!dirty || isPending}>
            Save department
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusHistoryCard({ slug }: { slug: string }) {
  const { data } = useGetAssetStatusHistory(slug);
  const history = data?.history ?? [];

  function statusLabel(s: string) {
    if (s === "ACTIVE") return "Active";
    if (s === "IN_SHOP") return "In Shop";
    return "Out of Service";
  }

  if (history.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Status History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {history.slice(0, 5).map((entry) => (
            <li key={entry.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{statusLabel(entry.oldStatus)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{statusLabel(entry.newStatus)}</span>
                {entry.changedByName && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" /> {entry.changedByName}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(entry.changedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ChangeStatusCard({
  asset,
}: {
  asset: { slug: string; status: string };
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useSetAssetStatus();
  const [status, setStatus] = useState(asset.status);
  const [touched, setTouched] = useState(false);

  const dirty = touched && status !== asset.status;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    mutation.mutate(
      { slug: asset.slug, data: { status: status as "ACTIVE" | "IN_SHOP" | "RETIRED" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetAssetBySlugQueryKey(asset.slug),
          });
          queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetFleetPulseQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAssetStatusHistoryQueryKey(asset.slug) });
          toast({ title: `Status changed to ${statusLabel(status)}` });
          setTouched(false);
        },
        onError: () =>
          toast({ title: "Could not change status", variant: "destructive" }),
      },
    );
  };

  return (
    <Card className="border-border/60" data-testid="change-status-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4" /> Change Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={submit}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="space-y-2">
            <Label htmlFor="asset-status">Service state</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setTouched(true);
              }}
            >
              <SelectTrigger
                id="asset-status"
                className="w-56"
                data-testid="status-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="IN_SHOP">In Shop</SelectItem>
                <SelectItem value="RETIRED">Out of Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={!dirty || mutation.isPending}
            data-testid="status-submit"
          >
            Save status
          </Button>
          <p className="basis-full text-xs text-muted-foreground">
            Use <strong>In Shop</strong> for temporary downtime and{" "}
            <strong>Out of Service</strong> when the asset is permanently retired
            or unsafe to operate.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
