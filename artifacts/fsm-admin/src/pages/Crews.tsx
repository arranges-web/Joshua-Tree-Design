import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListDepartments, useGetMe } from "@workspace/api-client-react";
import {
  useListCrews,
  useCrewDetail,
  useCreateCrew,
  useUpdateCrew,
  useListCrewLeadCandidates,
  getCrewDetailKey,
  type Crew,
  type CrewMember,
  type CrewLeadCandidate,
  type CreateCrewBody,
} from "@/lib/extra-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { HardHat, Truck, Wrench, Users, ChevronRight, Plus, UserCog } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  IN_SHOP: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  RETIRED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function StatusBadge({ status }: { status: string }) {
  const label = status === "RETIRED" ? "Out of Service" : status.replace("_", " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function CrewDetailPanel({
  crewId,
  canEdit,
}: {
  crewId: number;
  canEdit: boolean;
}) {
  const { data, isLoading, error } = useCrewDetail(crewId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (error || !data?.crew) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Unable to load crew details.
      </div>
    );
  }

  const { crew } = data;
  const leadMember = crew.members.find((m) => m.userId === crew.leadUserId);

  return (
    <div className="space-y-5 p-1">
      <section className="rounded-md border bg-muted/20 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Crew Lead
            </div>
            <div className="mt-1 text-sm font-semibold">
              {leadMember?.fullName ?? "Unassigned"}
            </div>
            {leadMember?.department && (
              <div className="text-xs text-muted-foreground">
                {leadMember.department}
              </div>
            )}
          </div>
          {canEdit && (
            <ChangeCrewLeadDialog
              crewId={crew.id}
              currentLeadUserId={crew.leadUserId}
            />
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Members ({crew.members.length})
        </div>
        {crew.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members assigned.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {crew.members.map((m: CrewMember) => (
              <div key={m.userId} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{m.fullName}</p>
                  <p className="text-xs text-muted-foreground">{m.department}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Truck className="h-3.5 w-3.5" />
          Assigned Trucks ({crew.trucks.length})
        </div>
        {crew.trucks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trucks assigned.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {crew.trucks.map((t: { id: number; name: string; status: string; slug: string | null }) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm font-medium">{t.name}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.status} />
                  {t.slug && (
                    <Link
                      href={`/assets/${t.slug}`}
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                      View <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" />
          Assigned Equipment ({crew.equipment.length})
        </div>
        {crew.equipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equipment assigned.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {crew.equipment.map((e: { id: number; name: string; type: string; status: string; slug: string | null }) => (
              <div key={e.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{e.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  {e.slug && (
                    <Link
                      href={`/assets/${e.slug}`}
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                      View <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChangeCrewLeadDialog({
  crewId,
  currentLeadUserId,
}: {
  crewId: number;
  currentLeadUserId: number;
}) {
  const [open, setOpen] = useState(false);
  const [leadUserId, setLeadUserId] = useState(String(currentLeadUserId));
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const updateCrew = useUpdateCrew(crewId);
  const { data: candidatesData } = useListCrewLeadCandidates();
  const candidates: CrewLeadCandidate[] = candidatesData?.users ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const newLeadId = Number(leadUserId);
    if (!newLeadId) {
      setError("Please select a crew lead.");
      return;
    }
    if (newLeadId === currentLeadUserId) {
      setOpen(false);
      return;
    }
    try {
      await updateCrew.mutateAsync({ leadUserId: newLeadId });
      queryClient.invalidateQueries({ queryKey: getCrewDetailKey(crewId) });
      queryClient.invalidateQueries({ queryKey: ["crews"] });
      setOpen(false);
    } catch {
      setError("Failed to update crew lead. Please try again.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setLeadUserId(String(currentLeadUserId));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <UserCog className="h-3.5 w-3.5" />
          Change Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Crew Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="change-crew-lead">Crew Lead *</Label>
            <Select value={leadUserId} onValueChange={setLeadUserId}>
              <SelectTrigger id="change-crew-lead" className="mt-1">
                <SelectValue placeholder="Select a lead" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateCrew.isPending}>
              {updateCrew.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewCrewDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [leadUserId, setLeadUserId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createCrew = useCreateCrew();
  const { data: candidatesData } = useListCrewLeadCandidates();
  const { data: deptsData } = useListDepartments();
  const candidates: CrewLeadCandidate[] = candidatesData?.users ?? [];
  const depts = deptsData?.departments ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Crew name is required."); return; }
    const leadId = Number(leadUserId);
    if (!leadId) { setError("Please select a crew lead."); return; }
    const deptId = Number(departmentId) || undefined;
    try {
      const body: CreateCrewBody = { name: name.trim(), leadUserId: leadId, departmentId: deptId };
      await createCrew.mutateAsync(body);
      onCreated();
      setOpen(false);
      setName("");
      setLeadUserId("");
      setDepartmentId("");
    } catch {
      setError("Failed to create crew. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Crew
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Crew</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="crew-name">Crew Name *</Label>
            <Input
              id="crew-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Crew Delta"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="crew-dept">Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger id="crew-dept" className="mt-1">
                <SelectValue placeholder="Select department (optional)" />
              </SelectTrigger>
              <SelectContent>
                {depts.map((d: { id: number; key: string; label: string }) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="crew-lead">Crew Lead *</Label>
            <Select value={leadUserId} onValueChange={setLeadUserId}>
              <SelectTrigger id="crew-lead" className="mt-1">
                <SelectValue placeholder="Select a lead" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createCrew.isPending}>
              {createCrew.isPending ? "Creating…" : "Create Crew"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Crews() {
  const { data, isLoading, error, refetch } = useListCrews();
  const queryClient = useQueryClient();
  const [selectedCrewId, setSelectedCrewId] = useState<number | null>(null);

  const { data: meData } = useGetMe();
  const canCreateCrew =
    (meData?.user?.permissions?.["fleet.trucks"]?.canEdit ?? false) ||
    (meData?.user?.permissions?.["admin.users"]?.canEdit ?? false);
  const crews = data?.crews ?? [];

  function handleCrewCreated() {
    queryClient.invalidateQueries({ queryKey: ["crews"] });
    refetch();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 text-destructive text-sm">
        Failed to load crews.
      </div>
    );
  }

  const selectedCrew = crews.find((c: Crew) => c.id === selectedCrewId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fleet & Shop"
        title="Crews"
        icon={<HardHat className="h-5 w-5" />}
        description="Field crews with their assigned members, trucks, and equipment."
        actions={canCreateCrew ? <NewCrewDialog onCreated={handleCrewCreated} /> : undefined}
      />

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {crews.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No crews yet. Create your first crew with the button above.
              </CardContent>
            </Card>
          ) : (
            crews.map((crew: Crew) => (
              <button
                key={crew.id}
                onClick={() => setSelectedCrewId(crew.id)}
                className={cn(
                  "w-full text-left rounded-lg border px-4 py-3 transition-colors",
                  selectedCrewId === crew.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                <div className="flex items-center gap-2">
                  <HardHat
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selectedCrewId === crew.id ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="text-sm font-medium">{crew.name}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div>
          {selectedCrewId && selectedCrew ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <HardHat className="h-5 w-5 text-primary" />
                  {selectedCrew.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CrewDetailPanel crewId={selectedCrewId} canEdit={canCreateCrew} />
              </CardContent>
            </Card>
          ) : (
            <Card className="flex items-center justify-center border-dashed py-24">
              <CardContent className="text-center text-muted-foreground">
                <HardHat className="mx-auto mb-3 h-8 w-8 opacity-30" />
                <p className="text-sm">Select a crew to see its details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
