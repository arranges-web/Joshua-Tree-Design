import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { rowsToCsv, downloadCsv } from "@/lib/csv";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Calculator,
  CreditCard,
  Wrench,
  AlertTriangle,
  Wallet,
  Download,
} from "lucide-react";
import { useAccountingSummary } from "@/lib/extra-api";

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

export function Accounting() {
  const { data, isLoading, error } = useAccountingSummary();

  // Recharts wants its rows pre-formatted with `$` axes in dollars and
  // shorter month labels — do that mapping here so the chart components
  // stay declarative.
  const orgChartData = useMemo(
    () =>
      (data?.orgMonthly ?? []).map((m) => ({
        month: monthLabel(m.month),
        Revenue: m.collectedRevenueCents / 100,
        Maintenance: m.maintenanceSpendCents / 100,
      })),
    [data?.orgMonthly],
  );

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

  return (
    <div className="space-y-6" data-testid="accounting-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-branch financial visibility — collected revenue, open invoices,
            quote pipeline, and fleet maintenance spend.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const csv = rowsToCsv(data.branches, [
              { header: "Branch", value: (b) => b.departmentLabel },
              {
                header: "Open invoices (USD)",
                value: (b) => (b.openInvoiceCents / 100).toFixed(2),
              },
              {
                header: "Collected revenue (USD)",
                value: (b) => (b.collectedRevenueCents / 100).toFixed(2),
              },
              {
                header: "Quote pipeline (USD)",
                value: (b) => (b.quotePipelineCents / 100).toFixed(2),
              },
              {
                header: "Maintenance spend (USD)",
                value: (b) => (b.maintenanceSpendCents / 100).toFixed(2),
              },
            ]);
            const stamp = new Date().toISOString().slice(0, 10);
            downloadCsv(`accounting-by-branch-${stamp}.csv`, csv);
          }}
        >
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Open invoices"
          value={usd(data.totals.openInvoiceCents)}
          icon={CreditCard}
          tone={data.totals.openInvoiceCents > 0 ? "amber" : "neutral"}
        />
        <KpiCard
          label="Collected revenue"
          value={usd(data.totals.collectedRevenueCents)}
          icon={Wallet}
          tone="emerald"
        />
        <KpiCard
          label="Quote pipeline"
          value={usd(data.totals.quotePipelineCents)}
          icon={Calculator}
        />
        <KpiCard
          label="Maintenance spend"
          value={usd(data.totals.maintenanceSpendCents)}
          icon={Wrench}
          tone={data.totals.maintenanceSpendCents > 0 ? "rose" : "neutral"}
        />
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Last 12 months — org wide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orgChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => usdShort(v * 100)} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => usd(value * 100)}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="hsl(150 50% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Maintenance" fill="hsl(0 70% 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">By branch</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Branch</TableHead>
                <TableHead className="text-right">Open invoices</TableHead>
                <TableHead className="text-right">Collected revenue</TableHead>
                <TableHead className="text-right">Quote pipeline</TableHead>
                <TableHead className="text-right">Maintenance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.branches.map((b) => (
                <TableRow
                  key={b.departmentId ?? "unattributed"}
                  data-testid={`branch-row-${b.departmentId ?? "unattributed"}`}
                >
                  <TableCell>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {b.departmentId == null ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {b.departmentLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {usd(b.openInvoiceCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {usd(b.collectedRevenueCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {usd(b.quotePipelineCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {usd(b.maintenanceSpendCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.branches.map((b) => (
          <Card
            key={`mini-${b.departmentId ?? "unattributed"}`}
            className="border-border/60"
          >
            <CardHeader>
              <CardTitle className="text-sm">{b.departmentLabel}</CardTitle>
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
                    <Bar dataKey="Revenue" fill="hsl(150 50% 45%)" />
                    <Bar dataKey="Maintenance" fill="hsl(0 70% 55%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
