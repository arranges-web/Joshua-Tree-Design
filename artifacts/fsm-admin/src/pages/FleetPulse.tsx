import { Link } from "wouter";
import { useGetFleetPulse } from "@workspace/api-client-react";
import { useDepartmentFilter } from "@/context/DepartmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Wrench,
  TrendingUp,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

const usd = (cents: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);

const num = (n: number) => new Intl.NumberFormat("en-US").format(n);

function monthLabel(key: string) {
  // key like "2025-04"
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short" });
}

export function FleetPulse() {
  const { activeDeptId } = useDepartmentFilter();
  const { data, isLoading } = useGetFleetPulse(activeDeptId != null ? { departmentId: activeDeptId } : {});

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const counts = data?.counts ?? {
    active: 0,
    inShop: 0,
    outOfService: 0,
    down: 0,
    openRepairs: 0,
    total: 0,
  };
  const overdue = data?.overdue ?? [];
  const dueSoon = data?.dueSoon ?? [];
  const monthly = data?.monthlySpend ?? [];
  const moneyPits = data?.topMoneyPits ?? [];
  const recent = data?.recentMaintenance ?? [];
  const totals = data?.totals ?? {
    mtdCents: 0,
    last30DaysCents: 0,
    ytdCents: 0,
    lifetimeCents: 0,
  };

  const chartData = monthly.map((m) => ({
    month: monthLabel(m.month),
    total: (m.totalCents ?? 0) / 100,
    labor: (m.laborCents ?? 0) / 100,
    parts: (m.partsCents ?? 0) / 100,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fleet & Shop"
        title="Fleet Pulse"
        description="One screen to know if every truck and chainsaw is healthy — and where the money is going."
        icon={<Activity className="h-5 w-5" />}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/assets">
              <Wrench className="mr-2 h-4 w-4" /> Asset Registry
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="Active"
          value={num(counts.active)}
          sub={`of ${counts.total} total`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Down"
          value={num(counts.down)}
          sub="out of service"
          icon={AlertTriangle}
          tone={counts.down > 0 ? "rose" : "neutral"}
        />
        <KpiCard
          label="Open Repairs"
          value={num(counts.openRepairs)}
          sub={`${overdue.length} overdue · ${dueSoon.length} due soon`}
          icon={Wrench}
          tone={counts.openRepairs > 0 ? "amber" : "neutral"}
        />
        <KpiCard
          label="Spend MTD"
          value={usd(totals.mtdCents)}
          sub={`YTD ${usd(totals.ytdCents)}`}
          icon={DollarSign}
        />
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Monthly Maintenance Spend
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Last 12 months
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full" data-testid="monthly-spend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${Math.round(Number(v))}`}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    `$${value.toFixed(2)}`,
                    name === "total" ? "Total" : name,
                  ]}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill="hsl(var(--accent))" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <ServiceList
          title="Overdue"
          items={overdue}
          icon={AlertTriangle}
          tone="rose"
          emptyText="Nothing overdue. "
          testid="overdue-list"
        />
        <ServiceList
          title="Due Soon"
          items={dueSoon}
          icon={Clock}
          tone="amber"
          emptyText="Nothing due in the near term."
          testid="due-soon-list"
        />
        <Card className="border-border/60" data-testid="money-pits" id="money-pits-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-rose-600" />
              Top 5 Money Pits
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Ranked by year-to-date spend
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {moneyPits.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                No spend recorded yet.
              </div>
            ) : (
              <ol className="divide-y">
                {moneyPits.map((m, i) => (
                  <li key={`${m.kind}-${m.id}`} className="px-6 py-3">
                    <Link
                      href={`/assets/${m.slug}`}
                      className="flex items-center justify-between gap-3 hover:underline"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{i + 1}
                        </span>
                        <span className="truncate text-sm font-medium">{m.name}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-mono text-sm font-semibold">
                          {usd(m.ytdSpendCents)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          LTD {usd(m.lifeToDateSpendCents)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60" data-testid="recent-maintenance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4" /> Recent Maintenance
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Last 8 entries
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No maintenance has been logged yet.
            </div>
          ) : (
            <ul className="divide-y">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-6 py-3"
                >
                  <Link
                    href={`/assets/${r.assetSlug}`}
                    className="min-w-0 hover:underline"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] uppercase"
                      >
                        {r.kind}
                      </Badge>
                      <span className="truncate text-sm font-medium">
                        {r.assetName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.performedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.description}
                    </div>
                  </Link>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold">
                      {usd(r.costCents)}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {usd(r.laborCostCents)} labor · {usd(r.partsCostCents)} parts
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
          {sub && (
            <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
          )}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-foreground/80 ring-1 ring-inset ring-accent/15">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceList({
  title,
  items,
  icon: Icon,
  tone,
  emptyText,
  testid,
}: {
  title: string;
  items: Array<{
    kind: string;
    id: number;
    slug: string;
    name: string;
    usageUntilDue: number;
    usageUnit: "MILES" | "HOURS";
  }>;
  icon: React.ComponentType<{ className?: string }>;
  tone: "rose" | "amber";
  emptyText: string;
  testid: string;
}) {
  const toneClass = tone === "rose" ? "text-rose-600" : "text-amber-600";
  return (
    <Card className="border-border/60" data-testid={testid}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-4 w-4 ${toneClass}`} />
          {title}
          <Badge variant="outline" className="ml-1">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((m) => (
              <li key={`${m.kind}-${m.id}`} className="px-6 py-3">
                <Link
                  href={`/assets/${m.slug}`}
                  className="flex items-center justify-between gap-3 hover:underline"
                >
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  <span className="flex items-center gap-2">
                    <span className={`font-mono text-xs ${toneClass}`}>
                      {m.usageUntilDue >= 0
                        ? `${num(m.usageUntilDue)} ${m.usageUnit.toLowerCase()}`
                        : `−${num(Math.abs(m.usageUntilDue))} ${m.usageUnit.toLowerCase()}`}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
