import { useState } from "react";
import { useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, getListCustomersQueryKey, useListEmployees, type Customer } from "@workspace/api-client-react";
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
import { applySortFilter, Pager, SortHeader, Toolbar, useDataTable } from "@/lib/data-table";

type CustSortKey = "fullName" | "email" | "phone";

export function Customers() {
  const { data, isLoading } = useListCustomers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const state = useDataTable<CustSortKey>("fullName", "asc", 50);

  const all: Customer[] = data?.customers ?? [];
  const { rows, total, totalPages } = applySortFilter<Customer, CustSortKey>(
    all,
    state,
    (r) => `${r.fullName ?? ""} ${r.email ?? ""} ${r.phone ?? ""} ${r.billingAddress ?? ""}`,
    (r, k) => (r[k] ?? "") as string,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Operations</div>
          <h1 className="font-serif text-3xl">Customers</h1>
        </div>
        <CustomerFormDialog
          isOpen={isCreateOpen}
          setIsOpen={setIsCreateOpen}
          trigger={<Button><Plus className="mr-2 h-4 w-4" />New Customer</Button>}
        />
      </div>

      <Toolbar state={state as never} total={total} searchPlaceholder="Search by name, email, phone, address…" />

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No customers match the current search.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader label="Name" sortKey="fullName" state={state} /></TableHead>
                <TableHead><SortHeader label="Email" sortKey="email" state={state} /></TableHead>
                <TableHead><SortHeader label="Phone" sortKey="phone" state={state} /></TableHead>
                <TableHead>Billing Address</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className="text-sm">
                  <TableCell className="font-medium">{c.fullName}</TableCell>
                  <TableCell className="font-mono text-xs">{c.email || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{c.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.billingAddress || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <CustomerFormDialog customer={c} trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>} />
                      <DeleteCustomer id={c.id} />
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

function CustomerFormDialog({ customer, trigger, isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: { customer?: Customer, trigger?: React.ReactNode, isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const { data: employeesData } = useListEmployees();
  
  const [formData, setFormData] = useState({
    fullName: customer?.fullName || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    billingAddress: customer?.billingAddress || "",
    ownerUserId: customer?.ownerUserId?.toString() || ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const ownerUserId = parseInt(formData.ownerUserId, 10);
    if (!Number.isFinite(ownerUserId)) {
      toast({ title: "Pick an owner before saving", variant: "destructive" });
      return;
    }
    const payload = {
      ...formData,
      ownerUserId,
    };

    if (customer) {
      updateMutation.mutate(
        { id: customer.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
            toast({ title: "Customer updated" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error updating customer", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
            toast({ title: "Customer created" });
            setIsOpen(false);
            setFormData({ fullName: "", email: "", phone: "", billingAddress: "", ownerUserId: "" });
          },
          onError: () => toast({ title: "Error creating customer", variant: "destructive" })
        }
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingAddress">Billing Address</Label>
            <Input id="billingAddress" value={formData.billingAddress} onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerUserId">Owner</Label>
            <Select value={formData.ownerUserId} onValueChange={(val) => setFormData({ ...formData, ownerUserId: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employeesData?.employees?.map(e => (
                  <SelectItem key={e.id} value={e.id.toString()}>{e.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

function DeleteCustomer({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteCustomer();

  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          toast({ title: "Customer deleted" });
        },
        onError: () => toast({ title: "Error deleting customer", variant: "destructive" })
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
            This action cannot be undone. This will permanently delete the customer.
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
