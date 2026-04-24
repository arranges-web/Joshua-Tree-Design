import { useState } from "react";
import { useListInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, getListInvoicesQueryKey, useListCustomers, type Invoice } from "@workspace/api-client-react";
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

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);

type InvSortKey = "id" | "customerId" | "status" | "totalCents" | "issuedAt" | "paidAt";
const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE"] as const;

export function Invoices() {
  const { data, isLoading } = useListInvoices();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const state = useDataTable<InvSortKey>("id", "desc", 50);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const all: Invoice[] = data?.invoices ?? [];
  const { rows, total, totalPages } = applySortFilter<Invoice, InvSortKey>(
    all,
    state,
    (r) => `#${r.id} customer:${r.customerId} job:${r.jobId ?? ""} ${r.status}`,
    (r, k) => {
      const v = r[k];
      if ((k === "issuedAt" || k === "paidAt") && typeof v === "string")
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
          <h1 className="font-serif text-3xl">Invoices</h1>
        </div>
        <InvoiceFormDialog
          isOpen={isCreateOpen}
          setIsOpen={setIsCreateOpen}
          trigger={<Button><Plus className="mr-2 h-4 w-4" />New Invoice</Button>}
        />
      </div>

      <Toolbar state={state as never} total={total} searchPlaceholder="Search by id, customer, job, status…">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setStatusFilter("ALL")}
            className={`rounded-md px-2 py-1 text-xs font-medium ${statusFilter === "ALL" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>All</button>
          {INVOICE_STATUSES.map((s) => (
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
          <div className="p-12 text-center text-sm text-muted-foreground">No invoices match the current filters.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]"><SortHeader label="ID" sortKey="id" state={state} /></TableHead>
                <TableHead><SortHeader label="Customer" sortKey="customerId" state={state} /></TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="w-[120px]"><SortHeader label="Status" sortKey="status" state={state} /></TableHead>
                <TableHead className="w-[120px]"><SortHeader label="Total" sortKey="totalCents" state={state} align="right" /></TableHead>
                <TableHead><SortHeader label="Issued" sortKey="issuedAt" state={state} /></TableHead>
                <TableHead><SortHeader label="Paid" sortKey="paidAt" state={state} /></TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((invoice) => (
                <TableRow key={invoice.id} className="text-sm">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{invoice.id}</TableCell>
                  <TableCell className="font-mono text-xs">Customer #{invoice.customerId}</TableCell>
                  <TableCell className="font-mono text-xs">{invoice.jobId ? `Job #${invoice.jobId}` : '—'}</TableCell>
                  <TableCell><StatusBadge status={invoice.status} /></TableCell>
                  <TableCell className="text-right font-mono font-medium">{usd(invoice.totalCents)}</TableCell>
                  <TableCell className="font-mono text-xs">{invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString() : '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <InvoiceFormDialog invoice={invoice} trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>} />
                      <DeleteInvoice id={invoice.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager state={state} totalPages={totalPages} total={total} />
      </div>
    </div>
  );
}

function InvoiceFormDialog({ invoice, trigger, isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: { invoice?: Invoice, trigger?: React.ReactNode, isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();
  
  const { data: customersData } = useListCustomers();
  
  const [formData, setFormData] = useState({
    customerId: invoice?.customerId?.toString() || "",
    jobId: invoice?.jobId?.toString() || "",
    status: invoice?.status || "DRAFT",
    totalDollars: invoice ? (invoice.totalCents / 100).toString() : "0",
    issuedAt: invoice?.issuedAt ? new Date(invoice.issuedAt).toISOString().slice(0, 16) : "",
    paidAt: invoice?.paidAt ? new Date(invoice.paidAt).toISOString().slice(0, 16) : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const customerId = parseInt(formData.customerId, 10);
    if (!Number.isFinite(customerId)) {
      toast({ title: "Pick a customer before saving", variant: "destructive" });
      return;
    }
    const payload = {
      customerId,
      jobId: formData.jobId ? parseInt(formData.jobId, 10) : null,
      status: formData.status,
      totalCents: Math.round(parseFloat(formData.totalDollars || "0") * 100),
      issuedAt: formData.issuedAt ? new Date(formData.issuedAt).toISOString() : null,
      paidAt: formData.paidAt ? new Date(formData.paidAt).toISOString() : null,
    };

    if (invoice) {
      updateMutation.mutate(
        { id: invoice.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
            toast({ title: "Invoice updated" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error updating invoice", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
            toast({ title: "Invoice created" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error creating invoice", variant: "destructive" })
        }
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit Invoice" : "New Invoice"}</DialogTitle>
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
            <Label htmlFor="jobId">Job ID (Optional)</Label>
            <Input id="jobId" type="number" value={formData.jobId} onChange={(e) => setFormData({ ...formData, jobId: e.target.value })} />
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
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalDollars">Total ($)</Label>
            <Input id="totalDollars" type="number" step="0.01" required value={formData.totalDollars} onChange={(e) => setFormData({ ...formData, totalDollars: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issuedAt">Issued At</Label>
              <Input id="issuedAt" type="datetime-local" value={formData.issuedAt} onChange={(e) => setFormData({ ...formData, issuedAt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidAt">Paid At</Label>
              <Input id="paidAt" type="datetime-local" value={formData.paidAt} onChange={(e) => setFormData({ ...formData, paidAt: e.target.value })} />
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

function DeleteInvoice({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteInvoice();

  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
          toast({ title: "Invoice deleted" });
        },
        onError: () => toast({ title: "Error deleting invoice", variant: "destructive" })
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
            This action cannot be undone. This will permanently delete the invoice.
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
