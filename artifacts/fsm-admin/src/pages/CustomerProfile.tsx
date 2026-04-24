import { useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  useGetCustomerProfile,
  useConvertLeadToQuote,
  useUpdateLead,
  getGetCustomerProfileQueryKey,
  getListLeadsQueryKey,
  getListQuotesQueryKey,
  type Lead,
  type Job,
  type Quote,
  type Invoice,
  type Property,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  FileSignature,
  Receipt,
  Inbox,
  ArrowRight,
  Trees,
  Wand2,
} from "lucide-react";
import { StatusBadge } from "@/lib/data-table";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatService(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function CustomerProfile() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data, isLoading, error } = useGetCustomerProfile(id);

  // Hooks must run on every render (no conditionals) — derive the property
  // map up front and let downstream callers handle the empty case.
  const propertyMap = useMemo(() => {
    const m = new Map<number, Property>();
    for (const p of data?.properties ?? []) m.set(p.id, p);
    return m;
  }, [data?.properties]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to customers
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            Customer not found, or you do not have access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { customer, properties, jobs, quotes, invoices, leads, totals } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Customers
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Customer Profile
          </div>
          <h1 className="font-serif text-3xl">{customer.fullName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {customer.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span className="font-mono text-xs">{customer.email}</span>
              </span>
            )}
            {customer.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                <span className="font-mono text-xs">{customer.phone}</span>
              </span>
            )}
            {customer.billingAddress && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>{customer.billingAddress}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RollupCard
          label="Lifetime revenue"
          value={formatCents(totals.lifetimeRevenueCents)}
          tone="green"
        />
        <RollupCard
          label="Outstanding"
          value={formatCents(totals.outstandingInvoiceCents)}
          tone="amber"
        />
        <RollupCard
          label="Open quote exposure"
          value={formatCents(totals.openQuoteCents)}
          tone="blue"
        />
        <RollupCard
          label="Open leads"
          value={String(totals.openLeadCount)}
          tone="rose"
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 sm:max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="properties">
            Properties ({properties.length})
          </TabsTrigger>
          <TabsTrigger value="jobs">
            Jobs ({jobs.upcoming.length + jobs.past.length})
          </TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({quotes.length})</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <PropertyList properties={properties} compact />
            <JobsList
              upcoming={jobs.upcoming.slice(0, 3)}
              past={jobs.past.slice(0, 3)}
              propertyMap={propertyMap}
              compact
            />
          </div>
          <InvoicesList invoices={invoices} compact />
        </TabsContent>

        <TabsContent value="properties" className="mt-4">
          <PropertyList properties={properties} />
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <JobsList
            upcoming={jobs.upcoming}
            past={jobs.past}
            propertyMap={propertyMap}
          />
        </TabsContent>

        <TabsContent value="quotes" className="mt-4">
          <QuotesList quotes={quotes} />
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <LeadsForCustomer customerId={customer.id} leads={leads} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RollupCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "blue" | "rose";
}) {
  const accent = {
    green: "text-emerald-700",
    amber: "text-amber-700",
    blue: "text-sky-700",
    rose: "text-rose-700",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        <div className={`mt-1 font-serif text-2xl ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function PropertyList({
  properties,
  compact,
}: {
  properties: Property[];
  compact?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <Trees className="h-4 w-4 text-muted-foreground" />
          Properties
        </CardTitle>
      </CardHeader>
      <CardContent>
        {properties.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No properties on file.
          </div>
        ) : (
          <ul className="divide-y">
            {(compact ? properties.slice(0, 4) : properties).map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 py-2.5 text-sm"
              >
                <div>
                  <div className="font-medium">{p.address}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.city}, {p.zip}
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  #{p.id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function JobsList({
  upcoming,
  past,
  propertyMap,
  compact,
}: {
  upcoming: Job[];
  past: Job[];
  propertyMap: Map<number, Property>;
  compact?: boolean;
}) {
  const renderRow = (j: Job) => {
    const prop = propertyMap.get(j.propertyId);
    return (
      <li
        key={j.id}
        className="flex items-start justify-between gap-3 py-2.5 text-sm"
      >
        <div className="min-w-0">
          <div className="truncate font-medium">
            {prop ? prop.address : `Property #${j.propertyId}`}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {j.notes || "No notes"} · {formatDate(j.scheduledFor ?? j.createdAt)}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={j.status} />
          <span className="font-mono text-xs text-muted-foreground">
            {formatCents(j.totalCents)}
          </span>
        </div>
      </li>
    );
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          Jobs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 && past.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No jobs yet.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.length > 0 && (
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Upcoming
                </div>
                <ul className="divide-y">{upcoming.map(renderRow)}</ul>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <Separator className="my-2" />
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Past
                </div>
                <ul className="divide-y">
                  {(compact ? past.slice(0, 3) : past).map(renderRow)}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuotesList({ quotes }: { quotes: Quote[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <FileSignature className="h-4 w-4 text-muted-foreground" />
          Quotes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No quotes yet.
          </div>
        ) : (
          <ul className="divide-y">
            {quotes.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div>
                  <div className="font-mono text-xs text-muted-foreground">
                    Quote #{q.id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(q.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">
                    {formatCents(q.totalCents)}
                  </span>
                  <StatusBadge status={q.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InvoicesList({
  invoices,
  compact,
}: {
  invoices: Invoice[];
  compact?: boolean;
}) {
  const rows = compact ? invoices.slice(0, 5) : invoices;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Invoices
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No invoices yet.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div>
                  <div className="font-mono text-xs text-muted-foreground">
                    Invoice #{i.id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i.issuedAt
                      ? `Issued ${formatDate(i.issuedAt)}`
                      : "Not issued"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">
                    {formatCents(i.totalCents)}
                  </span>
                  <StatusBadge status={i.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LeadsForCustomer({
  customerId: _customerId,
  leads,
}: {
  customerId: number;
  leads: Lead[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const convertMutation = useConvertLeadToQuote();
  const updateMutation = useUpdateLead();

  const convert = (lead: Lead) => {
    convertMutation.mutate(
      { id: lead.id },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries();
          toast({
            title: "Draft quote created",
            description: `Quote #${data.quote.id} is ready to fill in.`,
          });
          setLocation(`/quotes`);
        },
        onError: () =>
          toast({
            title: "Couldn't convert lead",
            variant: "destructive",
          }),
      },
    );
  };

  const dismiss = (lead: Lead) => {
    updateMutation.mutate(
      { id: lead.id, data: { status: "DISMISSED" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: "Lead dismissed" });
        },
        onError: () =>
          toast({ title: "Couldn't dismiss", variant: "destructive" }),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          Service requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No service requests for this customer.
          </div>
        ) : (
          <ul className="divide-y">
            {leads.map((l) => (
              <li
                key={l.id}
                className="flex flex-col gap-2 py-3 text-sm md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {formatService(l.service)}
                    </Badge>
                    <StatusBadge status={l.status} />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {l.source}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(l.createdAt)}
                    </span>
                  </div>
                  {l.notes && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {l.notes}
                    </p>
                  )}
                  {(l.preferredWindowStart || l.preferredWindowEnd) && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Preferred:{" "}
                      {formatDate(l.preferredWindowStart)} –{" "}
                      {formatDate(l.preferredWindowEnd)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {l.status !== "CONVERTED" &&
                    l.status !== "DISMISSED" &&
                    !l.convertedQuoteId && (
                      <Button
                        size="sm"
                        onClick={() => convert(l)}
                        disabled={convertMutation.isPending}
                      >
                        <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                        Convert to quote
                      </Button>
                    )}
                  {l.convertedQuoteId && (
                    <Link href="/quotes">
                      <Button size="sm" variant="outline">
                        Quote #{l.convertedQuoteId}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                  {l.status !== "DISMISSED" && l.status !== "CONVERTED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismiss(l)}
                      disabled={updateMutation.isPending}
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Reference unused imports cleanly so TS doesn't strip them in some builds.
void getGetCustomerProfileQueryKey;
void getListLeadsQueryKey;
void getListQuotesQueryKey;
