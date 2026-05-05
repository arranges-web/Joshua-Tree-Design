import { useState } from "react";
import { Link } from "wouter";
import { useListCrews, useCrewDetail } from "@/lib/extra-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { HardHat, Truck, Wrench, Users, ChevronRight } from "lucide-react";
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

function CrewDetailPanel({ crewId }: { crewId: number }) {
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

  return (
    <div className="space-y-5 p-1">
      {/* Members */}
      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Members ({crew.members.length})
        </div>
        {crew.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members assigned.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {crew.members.map((m) => (
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

      {/* Trucks */}
      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Truck className="h-3.5 w-3.5" />
          Assigned Trucks ({crew.trucks.length})
        </div>
        {crew.trucks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trucks assigned.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {crew.trucks.map((t) => (
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

      {/* Equipment */}
      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" />
          Assigned Equipment ({crew.equipment.length})
        </div>
        {crew.equipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equipment assigned.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {crew.equipment.map((e) => (
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

export function Crews() {
  const { data, isLoading, error } = useListCrews();
  const [selectedCrewId, setSelectedCrewId] = useState<number | null>(null);

  const crews = data?.crews ?? [];

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

  const selectedCrew = crews.find((c) => c.id === selectedCrewId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crews</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Field crews with their assigned members, trucks, and equipment.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {/* Crew list */}
        <div className="space-y-2">
          {crews.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No crews found.
              </CardContent>
            </Card>
          ) : (
            crews.map((crew) => (
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

        {/* Detail panel */}
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
                <CrewDetailPanel crewId={selectedCrewId} />
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
