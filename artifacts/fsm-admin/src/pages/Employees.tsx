import { useState } from "react";
import {
  useListEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  getListEmployeesQueryKey,
  useListRoles,
  useListDepartments,
  type Employee,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus } from "lucide-react";

interface RoleRow {
  id: number;
  key: string;
  label?: string | null;
}
interface DeptRow {
  id: number;
  key: string;
  label?: string | null;
}

export function Employees() {
  const { data, isLoading } = useListEmployees();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Employees</h1>
        <EmployeeFormDialog 
          isOpen={isCreateOpen} 
          setIsOpen={setIsCreateOpen} 
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Employee
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
      ) : data?.employees && data.employees.length > 0 ? (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.fullName}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>{emp.role}</TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell>
                    <Badge variant={emp.isActive ? "default" : "secondary"}>
                      {emp.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EmployeeFormDialog 
                        employee={emp} 
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="h-4 w-4" />
                          </Button>
                        } 
                      />
                      <DeleteEmployee id={emp.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-md bg-card">
          No employees found.
        </div>
      )}
    </div>
  );
}

function EmployeeFormDialog({ employee, trigger, isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }: { employee?: Employee, trigger?: React.ReactNode, isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = controlledSetIsOpen || setInternalIsOpen;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  
  const { data: rolesData } = useListRoles();
  const { data: departmentsData } = useListDepartments();
  
  const [formData, setFormData] = useState({
    fullName: employee?.fullName || "",
    email: employee?.email || "",
    password: "",
    roleId: employee?.roleId?.toString() || "",
    departmentId: employee?.departmentId?.toString() || "",
    isActive: employee !== undefined ? employee.isActive : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (employee) {
      const payload: {
        fullName: string;
        email: string;
        isActive: boolean;
        password?: string;
        roleId?: number;
        departmentId?: number;
      } = {
        fullName: formData.fullName,
        email: formData.email,
        isActive: formData.isActive,
      };

      if (formData.password) {
        payload.password = formData.password;
      }
      if (formData.roleId) {
        payload.roleId = parseInt(formData.roleId, 10);
      }
      if (formData.departmentId) {
        payload.departmentId = parseInt(formData.departmentId, 10);
      }

      updateMutation.mutate(
        { id: employee.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            toast({ title: "Employee updated" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error updating employee", variant: "destructive" })
        }
      );
    } else {
      const roleId = parseInt(formData.roleId, 10);
      const departmentId = parseInt(formData.departmentId, 10);
      if (!Number.isFinite(roleId) || !Number.isFinite(departmentId)) {
        toast({
          title: "Pick a role and a department before saving",
          variant: "destructive",
        });
        return;
      }
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        roleId,
        departmentId,
        isActive: formData.isActive,
      };

      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
            toast({ title: "Employee created" });
            setIsOpen(false);
          },
          onError: () => toast({ title: "Error creating employee", variant: "destructive" })
        }
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit Employee" : "New Employee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password {employee && "(leave blank to keep current)"}</Label>
            <Input id="password" type="password" required={!employee} minLength={6} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Role</Label>
               <Select value={formData.roleId} onValueChange={(val) => setFormData({ ...formData, roleId: val })}>
                 <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                 <SelectContent>
                   {((rolesData?.roles ?? []) as RoleRow[]).map((r) => (
                     <SelectItem key={r.id} value={r.id.toString()}>
                       {r.label ?? r.key}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label>Department</Label>
               <Select value={formData.departmentId} onValueChange={(val) => setFormData({ ...formData, departmentId: val })}>
                 <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                 <SelectContent>
                   {((departmentsData?.departments ?? []) as DeptRow[]).map(
                     (d) => (
                       <SelectItem key={d.id} value={d.id.toString()}>
                         {d.label ?? d.key}
                       </SelectItem>
                     ),
                   )}
                 </SelectContent>
               </Select>
             </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch 
              id="isActive" 
              checked={formData.isActive} 
              onCheckedChange={(val) => setFormData({ ...formData, isActive: val })} 
            />
            <Label htmlFor="isActive">Active account</Label>
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

function DeleteEmployee({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteEmployee();

  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          toast({ title: "Employee deleted" });
        },
        onError: () => toast({ title: "Error deleting employee", variant: "destructive" })
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
            This action cannot be undone. This will permanently delete the employee.
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
