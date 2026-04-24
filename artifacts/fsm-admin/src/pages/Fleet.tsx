import { useState } from "react";
import { 
  useListTrucks, useCreateTruck, useUpdateTruck, useDeleteTruck, getListTrucksQueryKey,
  useListEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment, getListEquipmentQueryKey,
  type Truck, type Equipment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus } from "lucide-react";

export function Fleet() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Fleet Management</h1>
      
      <Tabs defaultValue="trucks" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="trucks">Trucks</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="trucks">
            <TrucksList />
          </TabsContent>
          <TabsContent value="equipment">
            <EquipmentList />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// --- Trucks ---

function TrucksList() {
  const { data, isLoading } = useListTrucks();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TruckFormDialog 
          isOpen={isCreateOpen} 
          setIsOpen={setIsCreateOpen} 
          trigger={<Button><Plus className="mr-2 h-4 w-4" />New Truck</Button>} 
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data?.trucks && data.trucks.length > 0 ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>VIN</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Crew</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trucks.map((truck) => (
                <TableRow key={truck.id}>
                  <TableCell className="font-medium">{truck.name}</TableCell>
                  <TableCell>{truck.vin || '-'}</TableCell>
                  <TableCell>{truck.plate || '-'}</TableCell>
                  <TableCell><Badge variant="outline">{truck.status}</Badge></TableCell>
                  <TableCell>{truck.assignedCrewId || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TruckFormDialog 
                        truck={truck} 
                        trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>} 
                      />
                      <DeleteTruck id={truck.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-md bg-card">
          No trucks found.
        </div>
      )}
    </div>
  );
}

function TruckFormDialog({ truck, trigger, isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: { truck?: Truck, trigger?: React.ReactNode, isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateTruck();
  const updateMutation = useUpdateTruck();
  
  const [formData, setFormData] = useState({
    name: truck?.name || "",
    vin: truck?.vin || "",
    plate: truck?.plate || "",
    status: truck?.status || "ACTIVE",
    assignedCrewId: truck?.assignedCrewId?.toString() || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      vin: formData.vin || null,
      plate: formData.plate || null,
      status: formData.status,
      assignedCrewId: formData.assignedCrewId ? parseInt(formData.assignedCrewId, 10) : null,
    };

    if (truck) {
      updateMutation.mutate(
        { id: truck.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTrucksQueryKey() });
            toast({ title: "Truck updated" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error updating truck", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTrucksQueryKey() });
            toast({ title: "Truck created" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error creating truck", variant: "destructive" })
        }
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{truck ? "Edit Truck" : "New Truck"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vin">VIN</Label>
              <Input id="vin" value={formData.vin} onChange={(e) => setFormData({ ...formData, vin: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate">Plate</Label>
              <Input id="plate" value={formData.plate} onChange={(e) => setFormData({ ...formData, plate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="IN_SHOP">In Shop</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignedCrewId">Assigned Crew ID</Label>
            <Input id="assignedCrewId" type="number" value={formData.assignedCrewId} onChange={(e) => setFormData({ ...formData, assignedCrewId: e.target.value })} />
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

function DeleteTruck({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteTruck();

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
            This action cannot be undone. This will permanently delete the truck.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => deleteMutation.mutate({ id }, {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getListTrucksQueryKey() });
                toast({ title: "Truck deleted" });
              }
            })} 
            className="bg-destructive text-destructive-foreground">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Equipment ---

function EquipmentList() {
  const { data, isLoading } = useListEquipment();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <EquipmentFormDialog 
          isOpen={isCreateOpen} 
          setIsOpen={setIsCreateOpen} 
          trigger={<Button><Plus className="mr-2 h-4 w-4" />New Equipment</Button>} 
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data?.equipment && data.equipment.length > 0 ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Truck</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.equipment.map((eq) => (
                <TableRow key={eq.id}>
                  <TableCell className="font-medium">{eq.name}</TableCell>
                  <TableCell>{eq.type}</TableCell>
                  <TableCell>{eq.serial || '-'}</TableCell>
                  <TableCell><Badge variant="outline">{eq.status}</Badge></TableCell>
                  <TableCell>{eq.assignedTruckId ? `Truck #${eq.assignedTruckId}` : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EquipmentFormDialog 
                        equipment={eq} 
                        trigger={<Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>} 
                      />
                      <DeleteEquipment id={eq.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-md bg-card">
          No equipment found.
        </div>
      )}
    </div>
  );
}

function EquipmentFormDialog({ equipment, trigger, isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: { equipment?: Equipment, trigger?: React.ReactNode, isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateEquipment();
  const updateMutation = useUpdateEquipment();
  
  const { data: trucksData } = useListTrucks();
  
  const [formData, setFormData] = useState({
    name: equipment?.name || "",
    type: equipment?.type || "",
    serial: equipment?.serial || "",
    status: equipment?.status || "ACTIVE",
    assignedTruckId: equipment?.assignedTruckId?.toString() || "none",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      type: formData.type,
      serial: formData.serial || null,
      status: formData.status,
      assignedTruckId: formData.assignedTruckId !== "none" ? parseInt(formData.assignedTruckId, 10) : null,
    };

    if (equipment) {
      updateMutation.mutate(
        { id: equipment.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey() });
            toast({ title: "Equipment updated" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error updating equipment", variant: "destructive" })
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey() });
            toast({ title: "Equipment created" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error creating equipment", variant: "destructive" })
        }
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{equipment ? "Edit Equipment" : "New Equipment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Input id="type" required value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serial">Serial Number</Label>
            <Input id="serial" value={formData.serial} onChange={(e) => setFormData({ ...formData, serial: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="IN_SHOP">In Shop</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignedTruckId">Assigned Truck</Label>
            <Select value={formData.assignedTruckId} onValueChange={(val) => setFormData({ ...formData, assignedTruckId: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select truck" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {trucksData?.trucks?.map(t => (
                  <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
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

function DeleteEquipment({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteEquipment();

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
            This action cannot be undone. This will permanently delete the equipment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => deleteMutation.mutate({ id }, {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey() });
                toast({ title: "Equipment deleted" });
              }
            })} 
            className="bg-destructive text-destructive-foreground">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
