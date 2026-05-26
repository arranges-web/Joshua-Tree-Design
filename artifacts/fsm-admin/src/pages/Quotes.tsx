import { useState } from "react";
import { useListQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote, getListQuotesQueryKey, useListCustomers, useListEmployees, type Quote } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Plus } from "lucide-react";
import { applySortFilter, Pager, SortHeader, StatusBadge, Toolbar, useDataTable } from "@/lib/data-table";
import { deleteOutcomeToast } from "@/lib/delete-outcome";
import { DELETE_REQUESTS_PENDING_COUNT_KEY } from "@/lib/extra-api";

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);

type QuoteSortKey = "id" | "customerId" | "status" | "totalCents" | "sentAt" | "decidedAt";
const QUOTE_STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED"] as const;

export function Quotes() {
  const { data, isLoading } = useListQuotes();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const state = useDataTable<QuoteSortKey>("id", "desc", 50);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const all: Quote[] = data?.quotes ?? [];
  const { rows, total, totalPages } = applySortFilter<Quote, QuoteSortKey>(
    all,
    state,
    (r) => `#${r.id} customer:${r.customerId} ${r.status}`,
    (r, k) => {
      const v = r[k];
      if ((k === "sentAt" || k === "decidedAt") && typeof v === "string")
        return new Date(v).getTime();
      return (v as string | number | null | undefined) ?? null;
    },
    statusFilter === "ALL" ? undefined : (r) => r.status === statusFilter,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Operations</div>
          <h1 className="font-serif text-3xl">Quotes</h1>
        </div>
        <QuoteFormDialog
          isOpen={isCreateOpen}
          setIsOpen={setIsCreateOpen}
          trigger={<Button><Plus className="mr-2 h-4 w-4" />New Quote</Button>}
        />
      </div>

      <Toolbar state={state as never} total={total} searchPlaceholder="Search by id, customer, status…">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setStatusFilter("ALL")}
            className={`rounded-md px-2 py-1 text-xs font-medium ${statusFilter === "ALL" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>All</button>
          {QUOTE_STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      </Toolbar>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No quotes match the current filters.</div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
              <TableRow>
                <TableHead className="w-[80px]"><SortHeader label="ID" sortKey="id" state={state} /></TableHead>
                <TableHead><SortHeader label="Customer" sortKey="customerId" state={state} /></TableHead>
                <TableHead className="w-[120px]"><SortHeader label="Status" sortKey="status" state={state} /></TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-[120px]"><SortHeader label="Total" sortKey="totalCents" state={state} align="right" /></TableHead>
                <TableHead><SortHeader label="Sent" sortKey="sentAt" state={state} /></TableHead>
                <TableHead><SortHeader label="Decided" sortKey="decidedAt" state={state} /></TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((quote) => (
                <TableRow key={quote.id} className="text-sm hover:bg-muted/40">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{quote.id}</TableCell>
                  <TableCell className="font-mono text-xs">Customer #{quote.customerId}</TableCell>
                  <TableCell><StatusBadge status={quote.status} /></TableCell>
                  <TableCell className="text-right font-mono">{usd(quote.subtotalCents)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{usd(quote.totalCents)}</TableCell>
                  <TableCell className="font-mono text-xs">{quote.sentAt ? new Date(quote.sentAt).toLocaleString() : '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{quote.decidedAt ? new Date(quote.decidedAt).toLocaleString() : '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <QuoteFormDialog quote={quote} trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>} />
                      <DeleteQuote id={quote.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
        <Pager state={state} totalPages={totalPages} total={total} />
      </div>
    </div>
  );
}

function QuoteFormDialog({ quote, trigger, isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: { quote?: Quote, trigger?: React.ReactNode, isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  
  const { data: customersData } = useListCustomers();
  const { data: employeesData } = useListEmployees();
  
  const [formData, setFormData] = useState({
    customerId: quote?.customerId?.toString() || "",
    propertyId: quote?.propertyId?.toString() || "",
    ownerUserId: quote?.ownerUserId?.toString() || "",
    status: quote?.status || "DRAFT",
    subtotalDollars: quote ? (quote.subtotalCents / 100).toString() : "0",
    totalDollars: quote ? (quote.totalCents / 100).toString() : "0",
    sentAt: quote?.sentAt ? new Date(quote.sentAt).toISOString().slice(0, 16) : "",
    decidedAt: quote?.decidedAt ? new Date(quote.decidedAt).toISOString().slice(0, 16) : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const customerId = parseInt(formData.customerId, 10);
    const ownerUserId = parseInt(formData.ownerUserId, 10);
    if (!Number.isFinite(customerId) || !Number.isFinite(ownerUserId)) {
      toast({
        title: "Pick a customer and an owner before saving",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      customerId,
      propertyId: formData.propertyId ? parseInt(formData.propertyId, 10) : null,
      ownerUserId,
      status: formData.status,
      subtotalCents: Math.round(parseFloat(formData.subtotalDollars || "0") * 100),
      totalCents: Math.round(parseFloat(formData.totalDollars || "0") * 100),
      sentAt: formData.sentAt ? new Date(formData.sentAt).toISOString() : null,
      decidedAt: formData.decidedAt ? new Date(formData.decidedAt).toISOString() : null,
    };

    if (quote) {
      updateMutation.mutate(
        { id: quote.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
            toast({ title: "Quote updated" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error updating quote", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
            toast({ title: "Quote created" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error creating quote", variant: "destructive" })
        }
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? "Edit Quote" : "New Quote"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="customerId">Customer</Label>
            <Select value={formData.customerId} onValueChange={(val) => setFormData({ ...formData, customerId: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customersData?.customers?.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ownerUserId">Owner (Employee)</Label>
            <Select value={formData.ownerUserId} onValueChange={(val) => setFormData({ ...formData, ownerUserId: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {employeesData?.employees?.map(e => (
                  <SelectItem key={e.id} value={e.id.toString()}>{e.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="propertyId">Property ID (Optional)</Label>
            <Input id="propertyId" type="number" value={formData.propertyId} onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subtotalDollars">Subtotal ($)</Label>
              <Input id="subtotalDollars" type="number" step="0.01" required value={formData.subtotalDollars} onChange={(e) => setFormData({ ...formData, subtotalDollars: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalDollars">Total ($)</Label>
              <Input id="totalDollars" type="number" step="0.01" required value={formData.totalDollars} onChange={(e) => setFormData({ ...formData, totalDollars: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sentAt">Sent At</Label>
              <Input id="sentAt" type="datetime-local" value={formData.sentAt} onChange={(e) => setFormData({ ...formData, sentAt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decidedAt">Decided At</Label>
              <Input id="decidedAt" type="datetime-local" value={formData.decidedAt} onChange={(e) => setFormData({ ...formData, decidedAt: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteQuote({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteQuote();

  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          queryClient.invalidateQueries({ queryKey: DELETE_REQUESTS_PENDING_COUNT_KEY });
          toast(deleteOutcomeToast(result, "Quote deleted"));
        },
        onError: () => toast({ title: "Error deleting quote", variant: "destructive" })
      }
    );
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the quote.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
