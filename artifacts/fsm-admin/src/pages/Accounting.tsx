import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import {
  Building2,
  Wrench,
  AlertTriangle,
  Download,
  TrendingUp,
  Receipt,
  Users,
  Truck as TruckIcon,
  Caravan,
  Hammer,
  Package,
  ChevronRight,
} from "lucide-react";
import {
  useAccountingSummary,
  type AccountingBranch,
  type AccountingExpenseCategoryKey,
  type AccountingExpensesByCategory,
  type AccountingAssetSpend,
  type AssetCategoryKey,
} from "@/lib/extra-api";
import { useDepartmentFilter } from "@/context/DepartmentContext";
import { rowsToCsv, downloadCsv } from "@/lib/csv";
import { PageHeader } from "@/components/layout/PageHeader";
import { useUrlSearch } from "@/lib/use-url-search";

const usd = (cents: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);

// Chart axes prefer dollars (not cents) so the gridlines are readable.
const usdShort = (cents: number) => {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000)
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (Math.abs(dollars) >= 1_000) return `$${(dollars / 1_000).toFixed(0)}k`;
  return `$${dollars.toFixed(0)}`;
};

function monthLabel(key: string) {
  // key is `YYYY-MM`
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short" });
}

const MAINT_COLOR = "hsl(0 70% 55%)";

// Distinct hues for the expense pie so each category is readable.
const CATEGORY_COLORS: Record<AccountingExpenseCategoryKey, string> = {
  LABOR: "hsl(220 65% 55%)",
  PARTS: "hsl(150 55% 45%)",
  FUEL: "hsl(35 90% 55%)",
  OUTSOURCED: "hsl(280 50% 55%)",
  OTHER: "hsl(200 35% 50%)",
  UNCATEGORIZED: "hsl(0 0% 60%)",
};

const CATEGORY_LABELS: Record<AccountingExpenseCategoryKey, string> = {
  LABOR: "Labor",
  PARTS: "Parts",
  FUEL: "Fuel",
  OUTSOURCED: "Outsourced",
  OTHER: "Other",
  UNCATEGORIZED: "Uncategorized",
};

const TABS = ["overview", "assets", "expenses", "trends"] as const;
type TabValue = (typeof TABS)[number];

function tabFromSearch(search: string): TabValue {
  const raw = new URLSearchParams(search).get("tab");
  return (TABS as readonly string[]).includes(raw ?? "")
    ? (raw as TabValue)
    : "overview";
}

// Old API responses (or any unexpected shape) might be missing the
// aging / expensesByCategory / quotesByStatus blocks. Filling in
// zero-valued defaults here means the dashboard always renders, even
// during the brief window after the frontend deploys but before the
// backend has redeployed.
function normalizeBranch(b: AccountingBranch): AccountingBranch {
  const emptyCat = { count: 0, cents: 0 };
  return {
    ...b,
    aging: b.aging ?? {
      currentCents: 0,
      d1to30Cents: 0,
      d31to60Cents: 0,
      d61to90Cents: 0,
      d90plusCents: 0,
    },
    expensesByCategory: {
      LABOR: b.expensesByCategory?.LABOR ?? emptyCat,
      PARTS: b.expensesByCategory?.PARTS ?? emptyCat,
      FUEL: b.expensesByCategory?.FUEL ?? emptyCat,
      OUTSOURCED: b.expensesByCategory?.OUTSOURCED ?? emptyCat,
      OTHER: b.expensesByCategory?.OTHER ?? emptyCat,
      UNCATEGORIZED: b.expensesByCategory?.UNCATEGORIZED ?? emptyCat,
    },
    quotesByStatus: b.quotesByStatus ?? {
      draft: { count: 0, cents: 0 },
      sent: { count: 0, cents: 0 },
      approved: { count: 0, cents: 0 },
    },
    maintenanceLogCount: b.maintenanceLogCount ?? 0,
    maintenanceLogsWithReceipt: b.maintenanceLogsWithReceipt ?? 0,
  };
}

export function Accounting() {
  const { activeDeptId } = useDepartmentFilter();
  const { data, isLoading, error } = useAccountingSummary();
  const [, setLocation] = useLocation();
  // Tabs are URL-driven so the sidebar can deep-link into each one
  // (Accounting section in Shell.tsx) and so a refresh keeps you put.
  const search = useUrlSearch();
  const tab = tabFromSearch(search);
  const handleTabChange = (value: string) => {
    if (!(TABS as readonly string[]).includes(value)) return;
    const next =
      value === "overview" ? "/accounting" : `/accounting?tab=${value}`;
    setLocation(next);
  };

  // When the global dept filter is set, narrow the page to that branch.
  // Otherwise we run org-wide and show the cross-branch table.
  // Defensive: if the API response is from an older deploy and is
  // missing aging/expensesByCategory/quotesByStatus, fill in zeros
  // so the page renders instead of crashing with "Cannot read
  // properties of undefined".
  const scopedBranches = useMemo<AccountingBranch[]>(() => {
    if (!data) return [];
    const list = activeDeptId == null
      ? data.branches
      : data.branches.filter((b) => b.departmentId === activeDeptId);
    return list.map(normalizeBranch);
  }, [data, activeDeptId]);

  const isScopedToOne = activeDeptId != null && scopedBranches.length === 1;
  const scopedLabel = isScopedToOne
    ? scopedBranches[0]!.departmentLabel
    : "All branches";

  // Roll the (possibly narrowed) branch list into the same shape the
  // org-wide totals had. This keeps the rest of the page agnostic.
  const scopedTotals = useMemo(() => {
    return scopedBranches.reduce(
      (acc, b) => ({
        openInvoiceCents: acc.openInvoiceCents + b.openInvoiceCents,
        collectedRevenueCents:
          acc.collectedRevenueCents + b.collectedRevenueCents,
        quotePipelineCents: acc.quotePipelineCents + b.quotePipelineCents,
        maintenanceSpendCents:
          acc.maintenanceSpendCents + b.maintenanceSpendCents,
      }),
      {
        openInvoiceCents: 0,
        collectedRevenueCents: 0,
        quotePipelineCents: 0,
        maintenanceSpendCents: 0,
      },
    );
  }, [scopedBranches]);

  const scopedExpenses = useMemo(() => {
    const empty: AccountingExpensesByCategory = {
      LABOR: { count: 0, cents: 0 },
      PARTS: { count: 0, cents: 0 },
      FUEL: { count: 0, cents: 0 },
      OUTSOURCED: { count: 0, cents: 0 },
      OTHER: { count: 0, cents: 0 },
      UNCATEGORIZED: { count: 0, cents: 0 },
    };
    for (const b of scopedBranches) {
      for (const key of Object.keys(empty) as AccountingExpenseCategoryKey[]) {
        empty[key].count += b.expensesByCategory[key]?.count ?? 0;
        empty[key].cents += b.expensesByCategory[key]?.cents ?? 0;
      }
    }
    return empty;
  }, [scopedBranches]);

  const scopedMaintenanceCoverage = useMemo(() => {
    let total = 0;
    let withReceipt = 0;
    for (const b of scopedBranches) {
      total += b.maintenanceLogCount;
      withReceipt += b.maintenanceLogsWithReceipt;
    }
    return { total, withReceipt };
  }, [scopedBranches]);

  const orgChartData = useMemo(() => {
    const months = data?.orgMonthly ?? [];
    if (activeDeptId == null) {
      return months.map((m) => ({
        month: monthLabel(m.month),
        Revenue: m.collectedRevenueCents / 100,
        Maintenance: m.maintenanceSpendCents / 100,
      }));
    }
    // For a scoped branch, sum its monthly rows.
    const rolled = new Map<
      string,
      { revenue: number; maintenance: number }
    >();
    for (const b of scopedBranches) {
      for (const m of b.monthly) {
        const r = rolled.get(m.month) ?? { revenue: 0, maintenance: 0 };
        r.revenue += m.collectedRevenueCents;
        r.maintenance += m.maintenanceSpendCents;
        rolled.set(m.month, r);
      }
    }
    return Array.from(rolled.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month: monthLabel(month),
        Revenue: v.revenue / 100,
        Maintenance: v.maintenance / 100,
      }));
  }, [data, scopedBranches, activeDeptId]);

  // Fleet-money rollup powering the page-level KPI strip ("Fleet
  // spend lifetime / YTD / 30d"). Defined here, BEFORE the loading
  // / error early returns, so the hook count stays stable across
  // renders. Placing useMemo after a conditional `return` violates
  // the Rules of Hooks and crashes on the second render — exactly
  // what the runtime overlay caught earlier.
  const scopedAssetSpend = useMemo(() => {
    const list = data?.assetSpend ?? [];
    return activeDeptId == null
      ? list
      : list.filter((a) => a.departmentId === activeDeptId);
  }, [data, activeDeptId]);

  const fleetTotals = useMemo(() => {
    let lifetime = 0;
    let ytd = 0;
    let last30 = 0;
    let assetCount = 0;
    for (const a of scopedAssetSpend) {
      lifetime += a.lifeToDateSpendCents;
      ytd += a.ytdSpendCents;
      last30 += a.last30DaysSpendCents;
      assetCount += 1;
    }
    return { lifetime, ytd, last30, assetCount };
  }, [scopedAssetSpend]);

  // Aggregate scopedAssetSpend by department for the headline
  // "Fleet & equipment spend by department" table on the Overview
  // tab. Departments without any spend still show with zeroes so
  // operators can see at a glance that a dept is empty.
  const fleetByDept = useMemo(() => {
    type Row = {
      departmentId: number | null;
      departmentLabel: string;
      assetCount: number;
      lifetime: number;
      ytd: number;
      last30: number;
    };
    const byKey = new Map<string, Row>();
    // Seed with the canonical branches so empty depts still appear.
    for (const b of scopedBranches) {
      const key = b.departmentId == null ? "unattributed" : `d-${b.departmentId}`;
      byKey.set(key, {
        departmentId: b.departmentId,
        departmentLabel: b.departmentLabel,
        assetCount: 0,
        lifetime: 0,
        ytd: 0,
        last30: 0,
      });
    }
    for (const a of scopedAssetSpend) {
      const key = a.departmentId == null ? "unattributed" : `d-${a.departmentId}`;
      let row = byKey.get(key);
      if (!row) {
        row = {
          departmentId: a.departmentId,
          departmentLabel: a.departmentLabel || "Unattributed",
          assetCount: 0,
          lifetime: 0,
          ytd: 0,
          last30: 0,
        };
        byKey.set(key, row);
      }
      row.assetCount += 1;
      row.lifetime += a.lifeToDateSpendCents;
      row.ytd += a.ytdSpendCents;
      row.last30 += a.last30DaysSpendCents;
    }
    return Array.from(byKey.values()).sort((a, b) => {
      // Real branches sorted alphabetically; "Unattributed" pinned last.
      if (a.departmentId == null) return 1;
      if (b.departmentId == null) return -1;
      return a.departmentLabel.localeCompare(b.departmentLabel);
    });
  }, [scopedAssetSpend, scopedBranches]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border bg-card py-12 text-center text-sm text-muted-foreground">
        Could not load accounting summary.
      </div>
    );
  }

  const expenseTotal =
    scopedExpenses.LABOR.cents +
    scopedExpenses.PARTS.cents +
    scopedExpenses.FUEL.cents +
    scopedExpenses.OUTSOURCED.cents +
    scopedExpenses.OTHER.cents +
    scopedExpenses.UNCATEGORIZED.cents;

  const expensePieData = (
    Object.keys(scopedExpenses) as AccountingExpenseCategoryKey[]
  )
    .map((key) => ({
      name: CATEGORY_LABELS[key],
      value: scopedExpenses[key].cents / 100,
      key,
    }))
    .filter((d) => d.value > 0);

  function exportBranchesCsv() {
    const csv = rowsToCsv(fleetByDept, [
      { header: "Department", value: (d) => d.departmentLabel },
      { header: "Asset count", value: (d) => d.assetCount },
      { header: "Lifetime spend (USD)", value: (d) => (d.lifetime / 100).toFixed(2) },
      { header: "YTD spend (USD)", value: (d) => (d.ytd / 100).toFixed(2) },
      { header: "Last-30-day spend (USD)", value: (d) => (d.last30 / 100).toFixed(2) },
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`fleet-spend-by-department-${stamp}.csv`, csv);
  }

  const topVendors = data?.topVendors ?? [];

  function exportTopVendorsCsv() {
    const csv = rowsToCsv(topVendors, [
      { header: "Vendor", value: (v) => v.vendor },
      { header: "Spend (USD)", value: (v) => (v.cents / 100).toFixed(2) },
      { header: "Log count", value: (v) => v.logCount },
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`top-vendors-${stamp}.csv`, csv);
  }

  return (
    <div className="space-y-6" data-testid="accounting-page">
      <PageHeader
        eyebrow="Accounting"
        title="Equipment & Fleet Spend"
        icon={<Wrench className="h-5 w-5" />}
        description="Department-by-department breakdown of lifetime, YTD, and last-30-day cost of every truck, trailer, and piece of equipment. Revenue and receivables are tracked on the Invoices and Customers pages."
        actions={
          <>
            <Badge
              variant={isScopedToOne ? "default" : "outline"}
              className="gap-1.5 px-3 py-1 text-xs"
            >
              <Building2 className="h-3 w-3" />
              {scopedLabel}
            </Badge>
            <Button variant="outline" size="sm" onClick={exportBranchesCsv}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard
          label="Fleet spend (lifetime)"
          value={usd(fleetTotals.lifetime)}
          sub={`${fleetTotals.assetCount} asset${fleetTotals.assetCount === 1 ? "" : "s"} in scope`}
          icon={Wrench}
          tone={fleetTotals.lifetime > 0 ? "rose" : "neutral"}
        />
        <KpiCard
          label="Fleet spend (YTD)"
          value={usd(fleetTotals.ytd)}
          sub={
            fleetTotals.lifetime > 0
              ? `${Math.round((fleetTotals.ytd / fleetTotals.lifetime) * 100)}% of lifetime`
              : ""
          }
          icon={TrendingUp}
          tone={fleetTotals.ytd > 0 ? "amber" : "neutral"}
        />
        <KpiCard
          label="Fleet spend (last 30d)"
          value={usd(fleetTotals.last30)}
          sub="recent burn rate"
          icon={Wrench}
          tone={fleetTotals.last30 > 0 ? "rose" : "neutral"}
        />
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex md:grid-cols-4">
          <TabsTrigger value="overview">By Department</TabsTrigger>
          <TabsTrigger value="assets">Per Asset</TabsTrigger>
          <TabsTrigger value="expenses">Expense Categories</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* ---------- OVERVIEW ---------- */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">
                Fleet &amp; equipment spend by department
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[28%]">Department</TableHead>
                      <TableHead className="text-right">Assets</TableHead>
                      <TableHead className="text-right">Lifetime</TableHead>
                      <TableHead className="text-right">YTD</TableHead>
                      <TableHead className="text-right">Last 30 days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fleetByDept.map((d) => (
                      <TableRow
                        key={d.departmentId ?? "unattributed"}
                        data-testid={`branch-row-${d.departmentId ?? "unattributed"}`}
                      >
                        <TableCell>
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {d.departmentId == null ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            ) : (
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {d.departmentLabel}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {d.assetCount}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {usd(d.lifetime)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {usd(d.ytd)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm ${d.last30 > 0 ? "text-rose-700" : ""}`}
                        >
                          {usd(d.last30)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" /> Last 12 months —
                maintenance spend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orgChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v) => usdShort(v * 100)}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number) => usd(value * 100)}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="Maintenance" fill={MAINT_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- ASSETS ---------- */}
        <TabsContent value="assets" className="space-y-4">
          <AssetsTab
            assetSpend={data.assetSpend ?? []}
            rollup={data.assetTypeRollup}
            deptMatrix={data.deptAssetMatrix ?? []}
            activeDeptId={activeDeptId}
            isScopedToOne={isScopedToOne}
          />
        </TabsContent>

        {/* ---------- EXPENSES ---------- */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">
                  Spend by category{" "}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {usd(expenseTotal)} total
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expensePieData.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No maintenance spend logged yet.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expensePieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {expensePieData.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={CATEGORY_COLORS[entry.key]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => usd(v * 100)}
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Top vendors
                  </span>
                  {topVendors.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exportTopVendorsCsv}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {topVendors.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No vendor data yet — add a vendor when logging
                    maintenance.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Logs</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topVendors.slice(0, 8).map((v) => (
                        <TableRow key={v.vendor}>
                          <TableCell className="text-sm font-medium">
                            {v.vendor}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {v.logCount}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            {usd(v.cents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" />
                Receipt coverage
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {scopedMaintenanceCoverage.withReceipt} of{" "}
                  {scopedMaintenanceCoverage.total} logs have a receipt attached
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReceiptCoverageBar
                total={scopedMaintenanceCoverage.total}
                withReceipt={scopedMaintenanceCoverage.withReceipt}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Snap a photo when you log maintenance and accounting can
                reconcile every line.
              </p>
            </CardContent>
          </Card>

          {!isScopedToOne && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">
                  Expenses by branch &amp; category
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">Labor</TableHead>
                        <TableHead className="text-right">Parts</TableHead>
                        <TableHead className="text-right">Fuel</TableHead>
                        <TableHead className="text-right">Outsourced</TableHead>
                        <TableHead className="text-right">Other</TableHead>
                        <TableHead className="text-right">Uncat.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scopedBranches.map((b) => (
                        <TableRow key={b.departmentId ?? "unattributed"}>
                          <TableCell className="text-sm font-medium">
                            {b.departmentLabel}
                          </TableCell>
                          {(
                            [
                              "LABOR",
                              "PARTS",
                              "FUEL",
                              "OUTSOURCED",
                              "OTHER",
                              "UNCATEGORIZED",
                            ] as AccountingExpenseCategoryKey[]
                          ).map((cat) => (
                            <TableCell
                              key={cat}
                              className="text-right font-mono text-sm"
                            >
                              {usd(b.expensesByCategory[cat]?.cents ?? 0)}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            {usd(b.maintenanceSpendCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---------- TRENDS ---------- */}
        <TabsContent value="trends" className="space-y-4">
          {!isScopedToOne ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {scopedBranches.map((b) => (
                <Card
                  key={`mini-${b.departmentId ?? "unattributed"}`}
                  className="border-border/60"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>{b.departmentLabel}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {usd(b.collectedRevenueCents)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-40 w-full px-2 pb-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={b.monthly.map((m) => ({
                            month: monthLabel(m.month),
                            Revenue: m.collectedRevenueCents / 100,
                            Maintenance: m.maintenanceSpendCents / 100,
                          }))}
                        >
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis hide />
                          <Tooltip
                            formatter={(value: number) => usd(value * 100)}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 6,
                              fontSize: 11,
                            }}
                          />
                          <Bar dataKey="Maintenance" fill={MAINT_COLOR} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">12-month trend — {scopedLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={orgChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => usdShort(v * 100)} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v: number) => usd(v * 100)}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="Maintenance" fill={MAINT_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Defaults so the Assets tab can render even if the API hasn't shipped
// the new fields yet.
const ASSET_CATEGORY_KEYS: AssetCategoryKey[] = [
  "TRUCK",
  "TRAILER",
  "HANDHELD",
  "CUSTOM",
];
const ASSET_CATEGORY_LABELS: Record<AssetCategoryKey, string> = {
  TRUCK: "Trucks",
  TRAILER: "Trailers",
  HANDHELD: "Handheld equipment",
  CUSTOM: "Custom equipment",
};
const ASSET_CATEGORY_ICONS: Record<
  AssetCategoryKey,
  React.ComponentType<{ className?: string }>
> = {
  TRUCK: TruckIcon,
  TRAILER: Caravan,
  HANDHELD: Hammer,
  CUSTOM: Package,
};
const ASSET_CATEGORY_COLORS: Record<AssetCategoryKey, string> = {
  TRUCK: "hsl(220 65% 55%)",
  TRAILER: "hsl(40 80% 50%)",
  HANDHELD: "hsl(150 55% 45%)",
  CUSTOM: "hsl(280 50% 55%)",
};

function emptyRollupCell() {
  return {
    count: 0,
    lifeToDateSpendCents: 0,
    ytdSpendCents: 0,
    last30DaysSpendCents: 0,
    logCount: 0,
    logsWithReceipt: 0,
    purchasePriceCents: 0,
  };
}

function AssetsTab({
  assetSpend,
  rollup,
  deptMatrix,
  activeDeptId,
  isScopedToOne,
}: {
  assetSpend: AccountingAssetSpend[];
  rollup:
    | Record<AssetCategoryKey, ReturnType<typeof emptyRollupCell>>
    | undefined;
  deptMatrix: Array<{
    departmentId: number | null;
    departmentLabel: string;
    cells: Record<AssetCategoryKey, { count: number; cents: number }>;
    totalCents: number;
  }>;
  activeDeptId: number | undefined;
  isScopedToOne: boolean;
}) {
  // Defensive defaults so the page renders against an older API.
  const safeRollup = useMemo(() => {
    return {
      TRUCK: rollup?.TRUCK ?? emptyRollupCell(),
      TRAILER: rollup?.TRAILER ?? emptyRollupCell(),
      HANDHELD: rollup?.HANDHELD ?? emptyRollupCell(),
      CUSTOM: rollup?.CUSTOM ?? emptyRollupCell(),
    };
  }, [rollup]);

  // Narrow the per-asset list to the active dept (when filtered).
  const filteredAssets = useMemo(() => {
    if (activeDeptId == null) return assetSpend;
    return assetSpend.filter((a) => a.departmentId === activeDeptId);
  }, [assetSpend, activeDeptId]);

  // Recompute the rollup against the (possibly filtered) list so the
  // KPI cards always match the table below.
  const scopedRollup = useMemo(() => {
    if (activeDeptId == null) return safeRollup;
    const r: Record<AssetCategoryKey, ReturnType<typeof emptyRollupCell>> = {
      TRUCK: emptyRollupCell(),
      TRAILER: emptyRollupCell(),
      HANDHELD: emptyRollupCell(),
      CUSTOM: emptyRollupCell(),
    };
    for (const a of filteredAssets) {
      const cat = a.assetCategory;
      r[cat].count += 1;
      r[cat].lifeToDateSpendCents += a.lifeToDateSpendCents;
      r[cat].ytdSpendCents += a.ytdSpendCents;
      r[cat].last30DaysSpendCents += a.last30DaysSpendCents;
      r[cat].logCount += a.logCount;
      r[cat].logsWithReceipt += a.logsWithReceipt;
      r[cat].purchasePriceCents += a.purchasePriceCents;
    }
    return r;
  }, [filteredAssets, safeRollup, activeDeptId]);

  const totalLtd =
    scopedRollup.TRUCK.lifeToDateSpendCents +
    scopedRollup.TRAILER.lifeToDateSpendCents +
    scopedRollup.HANDHELD.lifeToDateSpendCents +
    scopedRollup.CUSTOM.lifeToDateSpendCents;
  const totalYtd =
    scopedRollup.TRUCK.ytdSpendCents +
    scopedRollup.TRAILER.ytdSpendCents +
    scopedRollup.HANDHELD.ytdSpendCents +
    scopedRollup.CUSTOM.ytdSpendCents;
  const totalAssets =
    scopedRollup.TRUCK.count +
    scopedRollup.TRAILER.count +
    scopedRollup.HANDHELD.count +
    scopedRollup.CUSTOM.count;

  const exportAssetsCsv = () => {
    const csv = rowsToCsv(filteredAssets, [
      { header: "Asset", value: (a) => a.name },
      { header: "Type", value: (a) => ASSET_CATEGORY_LABELS[a.assetCategory] },
      {
        header: "Custom category",
        value: (a) => a.customCategoryLabel ?? "",
      },
      { header: "Department", value: (a) => a.departmentLabel },
      { header: "Status", value: (a) => a.status },
      {
        header: "Purchase price (USD)",
        value: (a) => (a.purchasePriceCents / 100).toFixed(2),
      },
      {
        header: "Lifetime spend (USD)",
        value: (a) => (a.lifeToDateSpendCents / 100).toFixed(2),
      },
      {
        header: "YTD spend (USD)",
        value: (a) => (a.ytdSpendCents / 100).toFixed(2),
      },
      {
        header: "Last 30 days (USD)",
        value: (a) => (a.last30DaysSpendCents / 100).toFixed(2),
      },
      { header: "Log count", value: (a) => a.logCount },
      { header: "Logs with receipt", value: (a) => a.logsWithReceipt },
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`asset-spend-${stamp}.csv`, csv);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Lifetime maintenance spend rolled up per equipment type and
          per asset, with last-30-days trend so you can see what's
          burning money right now.
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportAssetsCsv}
          disabled={filteredAssets.length === 0}
        >
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {ASSET_CATEGORY_KEYS.map((key) => {
          const r = scopedRollup[key];
          const Icon = ASSET_CATEGORY_ICONS[key];
          return (
            <Card key={key} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {ASSET_CATEGORY_LABELS[key]}
                    </div>
                    <div className="mt-2 text-2xl font-bold">
                      {usd(r.lifeToDateSpendCents)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.count} asset{r.count === 1 ? "" : "s"} · YTD{" "}
                      {usd(r.ytdSpendCents)}
                    </div>
                  </div>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: ASSET_CATEGORY_COLORS[key] }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:
                        totalLtd > 0
                          ? `${Math.round((r.lifeToDateSpendCents / totalLtd) * 100)}%`
                          : "0%",
                      backgroundColor: ASSET_CATEGORY_COLORS[key],
                    }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    {totalLtd > 0
                      ? `${Math.round((r.lifeToDateSpendCents / totalLtd) * 100)}% of fleet`
                      : "—"}
                  </span>
                  <span>30d {usd(r.last30DaysSpendCents)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isScopedToOne && deptMatrix.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              Spend by department × asset type
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                lifetime totals
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    {ASSET_CATEGORY_KEYS.map((k) => (
                      <TableHead key={k} className="text-right">
                        {ASSET_CATEGORY_LABELS[k]}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptMatrix.map((row) => (
                    <TableRow key={row.departmentId ?? "unattributed"}>
                      <TableCell className="text-sm font-medium">
                        {row.departmentLabel}
                      </TableCell>
                      {ASSET_CATEGORY_KEYS.map((k) => {
                        const cell = row.cells[k];
                        return (
                          <TableCell
                            key={k}
                            className="text-right font-mono text-sm"
                          >
                            {cell.count > 0 ? (
                              <>
                                {usd(cell.cents)}
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                  ({cell.count})
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {usd(row.totalCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">
            Per-asset spend
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {totalAssets} asset{totalAssets === 1 ? "" : "s"} · {usd(totalLtd)} lifetime
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAssets.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No assets in scope. Add a truck or piece of equipment from the
              Asset Registry, or pick a different department.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Lifetime</TableHead>
                    <TableHead className="text-right">YTD</TableHead>
                    <TableHead className="text-right">30 days</TableHead>
                    <TableHead className="text-right">Logs</TableHead>
                    <TableHead className="w-[44px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((a) => {
                    const Icon = ASSET_CATEGORY_ICONS[a.assetCategory];
                    return (
                      <TableRow key={`${a.kind}-${a.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                              style={{
                                backgroundColor:
                                  ASSET_CATEGORY_COLORS[a.assetCategory],
                              }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <div className="text-sm font-medium">
                                {a.name}
                              </div>
                              {a.customCategoryLabel && (
                                <div className="text-xs text-muted-foreground">
                                  {a.customCategoryLabel}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ASSET_CATEGORY_LABELS[a.assetCategory]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.departmentLabel}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.status === "ACTIVE"
                                ? "default"
                                : a.status === "IN_SHOP"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[10px]"
                          >
                            {a.status === "RETIRED"
                              ? "Out of service"
                              : a.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {usd(a.lifeToDateSpendCents)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {usd(a.ytdSpendCents)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm ${a.last30DaysSpendCents > 0 ? "text-rose-700" : "text-muted-foreground/60"}`}
                        >
                          {usd(a.last30DaysSpendCents)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {a.logCount}
                          {a.logsWithReceipt > 0 && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-emerald-700">
                              <Receipt className="h-3 w-3" />
                              {a.logsWithReceipt}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {a.slug && (
                            <Link
                              href={`/assets/${a.slug}`}
                              className="text-muted-foreground hover:text-primary"
                              aria-label={`Open ${a.name}`}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}% of open`;
}

function ReceiptCoverageBar({
  total,
  withReceipt,
}: {
  total: number;
  withReceipt: number;
}) {
  if (total === 0) {
    return (
      <div className="text-xs text-muted-foreground">No logs yet.</div>
    );
  }
  const pctVal = Math.round((withReceipt / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="font-medium">{pctVal}%</span>
        <span className="text-muted-foreground">target 100%</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pctVal}%` }}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "rose" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "emerald"
          ? "text-emerald-700"
          : "text-foreground";
  return (
    <Card className="kpi-tile border-border/60 transition-shadow hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className={`mt-2 text-2xl font-bold tracking-tight ${toneClass}`}>
            {value}
          </div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-foreground/80 ring-1 ring-inset ring-accent/15">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
