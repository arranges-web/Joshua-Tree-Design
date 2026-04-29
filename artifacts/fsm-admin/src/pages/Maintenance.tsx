import { useState } from "react";
import { 
  useListMaintenanceLogs, useCreateMaintenanceLog, useUpdateMaintenanceLog, useDeleteMaintenanceLog, getListMaintenanceLogsQueryKey,
  useListTrucks, useListEquipment, useListEmployees,
  type MaintenanceLog,
} from "@workspace/api-client-react";
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
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, User } from "lucide-react";

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);

export function Maintenance() {
  const { data, isLoading } = useListMaintenanceLogs();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Maintenance Logs</h1>
        <MaintenanceFormDialog 
          isOpen={isCreateOpen} 
          setIsOpen={setIsCreateOpen} 
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Log
            </Button>
          } 
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data?.logs && data.logs.length > 0 ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Performed At</TableHead>
                <TableHead>Logged By</TableHead>
                <TableHead className="text-right">Labor</TableHead>
                <TableHead className="text-right">Parts</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.truckId ? `Truck #${log.truckId}` : log.equipmentId ? `Equipment #${log.equipmentId}` : 'Unknown'}
                  </TableCell>
                  <TableCell><Badge variant="outline">{log.kind}</Badge></TableCell>
                  <TableCell>{log.description}</TableCell>
                  <TableCell>{new Date(log.performedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {(log as typeof log & { loggedByName?: string | null }).loggedByName ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {(log as typeof log & { loggedByName?: string | null }).loggedByName}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{usd(log.laborCostCents ?? 0)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{usd(log.partsCostCents ?? 0)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{usd(log.costCents)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MaintenanceFormDialog 
                        log={log} 
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="h-4 w-4" />
                          </Button>
                        } 
                      />
                      <DeleteMaintenance id={log.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-md bg-card">
          No maintenance logs found.
        </div>
      )}
    </div>
  );
}

function MaintenanceFormDialog({ log, trigger, isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: { log?: MaintenanceLog, trigger?: React.ReactNode, isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateMaintenanceLog();
  const updateMutation = useUpdateMaintenanceLog();
  
  const { data: trucksData } = useListTrucks();
  const { data: equipmentData } = useListEquipment();
  const { data: employeesData } = useListEmployees();
  
  const [formData, setFormData] = useState({
    assetType: log?.truckId ? "truck" : (log?.equipmentId ? "equipment" : "truck"),
    truckId: log?.truckId?.toString() || "none",
    equipmentId: log?.equipmentId?.toString() || "none",
    kind: log?.kind || "SCHEDULED",
    description: log?.description || "",
    performedByUserId: log?.performedByUserId?.toString() || "none",
    performedAt: log?.performedAt ? new Date(log.performedAt).toISOString().slice(0, 16) : "",
    laborDollars: log ? ((log.laborCostCents ?? 0) / 100).toString() : "0",
    partsDollars: log ? ((log.partsCostCents ?? 0) / 100).toString() : "0",
    usageAt: log
      ? (log.mileageAtService ?? log.hoursAtService ?? "").toString()
      : "",
  });

  const labor = parseFloat(formData.laborDollars || "0") || 0;
  const parts = parseFloat(formData.partsDollars || "0") || 0;
  const total = labor + parts;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isTruck = formData.assetType === "truck";
    const usageNum = formData.usageAt ? parseInt(formData.usageAt, 10) : null;
    const payload = {
      truckId: isTruck && formData.truckId !== "none" ? parseInt(formData.truckId, 10) : null,
      equipmentId: !isTruck && formData.equipmentId !== "none" ? parseInt(formData.equipmentId, 10) : null,
      kind: formData.kind,
      description: formData.description,
      performedByUserId: formData.performedByUserId !== "none" ? parseInt(formData.performedByUserId, 10) : null,
      performedAt: formData.performedAt ? new Date(formData.performedAt).toISOString() : null,
      laborCostCents: Math.round(labor * 100),
      partsCostCents: Math.round(parts * 100),
      mileageAtService: isTruck && usageNum != null && Number.isFinite(usageNum) ? usageNum : null,
      hoursAtService: !isTruck && usageNum != null && Number.isFinite(usageNum) ? usageNum : null,
    };

    if (log) {
      updateMutation.mutate(
        { id: log.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListMaintenanceLogsQueryKey() });
            toast({ title: "Log updated" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error updating log", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListMaintenanceLogsQueryKey() });
            toast({ title: "Log created" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error creating log", variant: "destructive" })
        }
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{log ? "Edit Log" : "New Maintenance Log"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>Asset Type</Label>
                <Select value={formData.assetType} onValueChange={(val) => setFormData({ ...formData, assetType: val, truckId: "none", equipmentId: "none" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             
             {formData.assetType === "truck" ? (
               <div className="space-y-2">
                 <Label>Truck</Label>
                 <Select value={formData.truckId} onValueChange={(val) => setFormData({ ...formData, truckId: val })}>
                   <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="none">None</SelectItem>
                     {trucksData?.trucks?.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
             ) : (
               <div className="space-y-2">
                 <Label>Equipment</Label>
                 <Select value={formData.equipmentId} onValueChange={(val) => setFormData({ ...formData, equipmentId: val })}>
                   <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="none">None</SelectItem>
                     {equipmentData?.equipment?.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
             )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="kind">Kind</Label>
            <Select value={formData.kind} onValueChange={(val) => setFormData({ ...formData, kind: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="REPAIR">Repair</SelectItem>
                <SelectItem value="INSPECTION">Inspection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" required value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="laborDollars">Labor ($)</Label>
              <Input
                id="laborDollars"
                type="number"
                step="0.01"
                min="0"
                value={formData.laborDollars}
                onChange={(e) => setFormData({ ...formData, laborDollars: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partsDollars">Parts ($)</Label>
              <Input
                id="partsDollars"
                type="number"
                step="0.01"
                min="0"
                value={formData.partsDollars}
                onChange={(e) => setFormData({ ...formData, partsDollars: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total auto-summed</span>
            <span className="font-mono font-semibold">{usd(Math.round(total * 100))}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="performedByUserId">Performed By</Label>
              <Select value={formData.performedByUserId} onValueChange={(val) => setFormData({ ...formData, performedByUserId: val })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employeesData?.employees?.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="usageAt">
                {formData.assetType === "truck" ? "Mileage at service" : "Hours at service"}
              </Label>
              <Input
                id="usageAt"
                type="number"
                min="0"
                placeholder="optional"
                value={formData.usageAt}
                onChange={(e) => setFormData({ ...formData, usageAt: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="performedAt">Performed At</Label>
            <Input id="performedAt" type="datetime-local" value={formData.performedAt} onChange={(e) => setFormData({ ...formData, performedAt: e.target.value })} />
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

function DeleteMaintenance({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteMaintenanceLog();

  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMaintenanceLogsQueryKey() });
          toast({ title: "Log deleted" });
        },
        onError: () => toast({ title: "Error deleting log", variant: "destructive" })
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
            This action cannot be undone. This will permanently delete the log.
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
