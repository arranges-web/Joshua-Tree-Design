import { useRef, useState } from "react";
import {
  useListMaintenanceLogs, useCreateMaintenanceLog, useUpdateMaintenanceLog, useDeleteMaintenanceLog, getListMaintenanceLogsQueryKey,
  useListTrucks, useListEquipment, useListEmployees,
  type MaintenanceLog,
} from "@workspace/api-client-react";
import {
  useUpdateMaintenanceReceipt,
  useMaintenanceReceipt,
  type MaintenanceReceiptCategory,
} from "@/lib/extra-api";
import { useDepartmentFilter } from "@/context/DepartmentContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, User, Paperclip, Upload, Download, X } from "lucide-react";
import { rowsToCsv, downloadCsv } from "@/lib/csv";

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);

// Server widens MaintenanceLog with hasReceipt + accountant-facing
// fields. The orval-generated type doesn't know about them yet, so we
// intersect at the call site like the rest of extra-api does.
type MaintenanceLogExt = MaintenanceLog & {
  vendor?: string | null;
  category?: MaintenanceReceiptCategory | null;
  notes?: string | null;
  hasReceipt?: boolean;
};

const RECEIPT_CATEGORIES: { value: MaintenanceReceiptCategory; label: string }[] = [
  { value: "LABOR", label: "Labor" },
  { value: "PARTS", label: "Parts" },
  { value: "FUEL", label: "Fuel" },
  { value: "OUTSOURCED", label: "Outsourced" },
  { value: "OTHER", label: "Other" },
];

export function Maintenance() {
  const { activeDeptId } = useDepartmentFilter();
  const deptParams = activeDeptId != null ? { departmentId: activeDeptId } : {};
  const { data, isLoading } = useListMaintenanceLogs(deptParams);
  const { data: trucksData } = useListTrucks(deptParams);
  const { data: equipmentData } = useListEquipment(deptParams);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [previewLogId, setPreviewLogId] = useState<number | null>(null);

  const truckById = new Map(
    (trucksData?.trucks ?? []).map((t) => [t.id, t.name] as const),
  );
  const equipmentById = new Map(
    (equipmentData?.equipment ?? []).map((e) => [e.id, e.name] as const),
  );

  function assetName(log: MaintenanceLogExt): string {
    if (log.truckId) return truckById.get(log.truckId) ?? `Truck #${log.truckId}`;
    if (log.equipmentId)
      return equipmentById.get(log.equipmentId) ?? `Equipment #${log.equipmentId}`;
    return "Unknown";
  }

  const logs = (data?.logs ?? []) as MaintenanceLogExt[];

  function handleExport() {
    const csv = rowsToCsv(logs, [
      { header: "Date", value: (l) => new Date(l.performedAt).toISOString().slice(0, 10) },
      { header: "Asset", value: (l) => assetName(l) },
      { header: "Kind", value: (l) => l.kind },
      { header: "Category", value: (l) => l.category ?? "" },
      { header: "Vendor", value: (l) => l.vendor ?? "" },
      { header: "Description", value: (l) => l.description },
      { header: "Labor (USD)", value: (l) => ((l.laborCostCents ?? 0) / 100).toFixed(2) },
      { header: "Parts (USD)", value: (l) => ((l.partsCostCents ?? 0) / 100).toFixed(2) },
      { header: "Total (USD)", value: (l) => ((l.costCents ?? 0) / 100).toFixed(2) },
      { header: "Mileage at service", value: (l) => l.mileageAtService ?? "" },
      { header: "Hours at service", value: (l) => l.hoursAtService ?? "" },
      { header: "Logged by", value: (l) => l.loggedByName ?? "" },
      { header: "Receipt attached", value: (l) => (l.hasReceipt ? "yes" : "no") },
      { header: "Notes", value: (l) => l.notes ?? "" },
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`maintenance-logs-${stamp}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-3xl font-bold">Maintenance Logs</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={logs.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
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
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : logs.length > 0 ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Performed At</TableHead>
                <TableHead className="text-right">Labor</TableHead>
                <TableHead className="text-right">Parts</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm font-medium">{assetName(log)}</TableCell>
                  <TableCell><Badge variant="outline">{log.kind}</Badge></TableCell>
                  <TableCell>
                    {log.category ? (
                      <Badge variant="secondary" className="text-xs">
                        {log.category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.vendor ?? <span className="text-xs text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell>{log.description}</TableCell>
                  <TableCell>{new Date(log.performedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{usd(log.laborCostCents ?? 0)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{usd(log.partsCostCents ?? 0)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{usd(log.costCents)}</TableCell>
                  <TableCell>
                    {log.hasReceipt ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-primary"
                        onClick={() => setPreviewLogId(log.id)}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        View
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
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

      {previewLogId != null && (
        <ReceiptPreviewDialog
          logId={previewLogId}
          onClose={() => setPreviewLogId(null)}
        />
      )}
    </div>
  );
}

function ReceiptPreviewDialog({
  logId,
  onClose,
}: {
  logId: number;
  onClose: () => void;
}) {
  const { data, isLoading } = useMaintenanceReceipt(logId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-2">
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : data?.receiptDataUrl ? (
            <img
              src={data.receiptDataUrl}
              alt="Receipt"
              className="max-h-[70vh] w-auto rounded-md border"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No receipt attached.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Cap upload at ~3MB so we never POST something the server will
// reject (server limit matches). Browsers handle this client-side
// via FileReader.readAsDataURL.
const RECEIPT_SIZE_LIMIT_BYTES = 3 * 1024 * 1024;

function MaintenanceFormDialog({ log, trigger, isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: { log?: MaintenanceLogExt, trigger?: React.ReactNode, isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeDeptId } = useDepartmentFilter();
  const createMutation = useCreateMaintenanceLog();
  const updateMutation = useUpdateMaintenanceLog();
  // Receipt updates target a specific log id, so we build the hook
  // around the existing log's id (or 0 for create — we only fire it
  // after the create succeeds and we know the new id).
  const updateReceiptOnExisting = useUpdateMaintenanceReceipt(log?.id ?? 0);

  const deptParams = activeDeptId != null ? { departmentId: activeDeptId } : {};
  const { data: trucksData } = useListTrucks(deptParams);
  const { data: equipmentData } = useListEquipment(deptParams);
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
    vendor: log?.vendor ?? "",
    category: (log?.category ?? "") as MaintenanceReceiptCategory | "",
    notes: log?.notes ?? "",
  });
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [hasExistingReceipt, setHasExistingReceipt] = useState<boolean>(
    log?.hasReceipt ?? false,
  );
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const labor = parseFloat(formData.laborDollars || "0") || 0;
  const parts = parseFloat(formData.partsDollars || "0") || 0;
  const total = labor + parts;

  function handleReceiptFile(file: File) {
    setReceiptError(null);
    if (!file.type.startsWith("image/")) {
      setReceiptError("Receipt must be an image file.");
      return;
    }
    if (file.size > RECEIPT_SIZE_LIMIT_BYTES) {
      setReceiptError("Receipt is too large (max 3 MB). Please compress and try again.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setReceiptDataUrl(result);
        setHasExistingReceipt(true);
      }
    };
    reader.onerror = () => setReceiptError("Failed to read the file.");
    reader.readAsDataURL(file);
  }

  async function persistReceiptExtras(targetLogId: number) {
    // Build the receipt-side payload: only send fields we actually
    // collected so we don't accidentally clear unrelated columns.
    const body: {
      vendor?: string | null;
      category?: MaintenanceReceiptCategory | null;
      notes?: string | null;
      receiptDataUrl?: string | null;
    } = {};
    if (formData.vendor !== (log?.vendor ?? "")) {
      body.vendor = formData.vendor.trim() || null;
    }
    if (formData.category !== (log?.category ?? "")) {
      body.category = (formData.category || null) as
        | MaintenanceReceiptCategory
        | null;
    }
    if (formData.notes !== (log?.notes ?? "")) {
      body.notes = formData.notes.trim() || null;
    }
    if (receiptDataUrl != null) {
      body.receiptDataUrl = receiptDataUrl;
    }
    if (Object.keys(body).length === 0) return;
    // The dialog reuses the same hook for both create + edit by
    // recreating the URL with the freshly-known log id.
    if (log) {
      await updateReceiptOnExisting.mutateAsync(body);
    } else {
      // Build an ad-hoc fetch since the orval hooks don't help here
      // and we don't want a second hook constructor for the create
      // path. customFetch already inherits credentials + base URL.
      await fetch(`/api/maintenance-logs/${targetLogId}/receipt`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }
  }

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
          onSuccess: async () => {
            try {
              await persistReceiptExtras(log.id);
            } catch {
              toast({ title: "Saved log, but receipt update failed", variant: "destructive" });
            }
            queryClient.invalidateQueries({ queryKey: getListMaintenanceLogsQueryKey() });
            queryClient.invalidateQueries({ queryKey: ["maintenance-receipt", log.id] });
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
          onSuccess: async (created) => {
            const newId = (created as { log?: { id: number } } | undefined)?.log?.id;
            if (newId) {
              try {
                await persistReceiptExtras(newId);
              } catch {
                toast({ title: "Created log, but receipt save failed", variant: "destructive" });
              }
            }
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
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
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

          <div className="rounded-md border bg-muted/20 p-3 space-y-3">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Receipt &amp; Accounting
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="e.g. NAPA Auto Parts"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category || "none"}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      category: val === "none" ? "" : (val as MaintenanceReceiptCategory),
                    })
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {RECEIPT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt">Receipt photo</Label>
              <input
                ref={fileInputRef}
                id="receipt"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleReceiptFile(file);
                  // Reset so re-uploading the same file fires onChange.
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {hasExistingReceipt ? "Replace photo" : "Upload photo"}
                </Button>
                {hasExistingReceipt && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      setReceiptDataUrl(null);
                      setHasExistingReceipt(false);
                      // Tell the server to clear by sending receiptDataUrl: null on save.
                      // We achieve that by treating null as the new value.
                      setReceiptDataUrl(null);
                    }}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  JPG / PNG up to 3 MB. Snap a photo of the vendor receipt; you'll
                  fill in vendor + category manually for accounting.
                </span>
              </div>
              {receiptDataUrl && (
                <img
                  src={receiptDataUrl}
                  alt="Receipt preview"
                  className="mt-1 max-h-40 w-auto rounded-md border"
                />
              )}
              {receiptError && (
                <p className="text-xs text-destructive">{receiptError}</p>
              )}
              {hasExistingReceipt && !receiptDataUrl && log?.hasReceipt && (
                <p className="text-xs text-muted-foreground">
                  A receipt is already attached to this log. Upload a new one to
                  replace it.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Accountant notes</Label>
              <Textarea
                id="notes"
                rows={2}
                placeholder="GL code, PO number, anything else accounting needs"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
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
