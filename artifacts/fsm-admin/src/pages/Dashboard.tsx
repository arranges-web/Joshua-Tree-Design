import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);

export function Dashboard() {
  const { data, isLoading, error } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-destructive">Failed to load dashboard data</div>;
  }

  const { kpi, jobsByStatus, quotePipelineByStage, recentJobs } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard title="Open Jobs" value={kpi.openJobs} />
        <KpiCard title="Scheduled Jobs" value={kpi.scheduledJobs} />
        <KpiCard title="Completed This Month" value={kpi.completedThisMonth} />
        <KpiCard title="Pipeline" value={usd(kpi.pipelineCents)} />
        <KpiCard title="Paid This Month" value={usd(kpi.paidThisMonthCents)} />
        <KpiCard title="Outstanding Invoices" value={usd(kpi.outstandingInvoicesCents)} />
        <KpiCard title="Fleet Active" value={kpi.fleetActive} />
        <KpiCard title="Fleet In Shop" value={kpi.fleetInShop} />
        <KpiCard title="Employees" value={kpi.employees} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {jobsByStatus.length > 0 ? jobsByStatus.map((s) => (
                <Badge key={s.status} variant="secondary" className="text-sm py-1 px-3">
                  {s.status}: {s.count}
                </Badge>
              )) : <p className="text-sm text-muted-foreground">No jobs.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quote Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {quotePipelineByStage.length > 0 ? quotePipelineByStage.map((s) => (
                <Badge key={s.status} variant="outline" className="text-sm py-1 px-3">
                  {s.status}: {s.count}
                </Badge>
              )) : <p className="text-sm text-muted-foreground">No quotes.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>#{job.id}</TableCell>
                    <TableCell><Badge>{job.status}</Badge></TableCell>
                    <TableCell>{job.scheduledFor ? new Date(job.scheduledFor).toLocaleString() : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{usd(job.totalCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-muted-foreground">No recent jobs.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value }: { title: string, value: string | number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
