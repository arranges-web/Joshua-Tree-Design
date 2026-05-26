import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDeleteRequests,
  useApproveDeleteRequest,
  useDenyDeleteRequest,
  DELETE_REQUESTS_KEY,
  DELETE_REQUESTS_PENDING_COUNT_KEY,
  type DeleteRequest,
} from "@/lib/extra-api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Shield,
  ShieldAlert,
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";

/**
 * Admin approval queue for the "you tried to delete a lot of
 * things" safety net. Two stacked sections:
 *
 *   1. Pending — every queued delete from a non-admin who hit the
 *      3-per-hour cap. Each row gets explicit Approve / Deny
 *      buttons.
 *   2. History — last ~200 audit rows (executed, approved, denied)
 *      so the admin can see what changed and by whom.
 */
export function DeleteRequests() {
  const { data, isLoading } = useListDeleteRequests();
  const requests = data?.requests ?? [];

  const pending = useMemo(
    () => requests.filter((r) => r.status === "PENDING"),
    [requests],
  );
  const history = useMemo(
    () => requests.filter((r) => r.status !== "PENDING"),
    [requests],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Delete Approvals"
        icon={<Shield className="h-5 w-5" />}
        description="Safety net: any non-admin who tries to delete more than 3 items in an hour gets queued here for your approval. The full audit history of every deletion across the console lives here too."
      />

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Pending approval
            <Badge
              variant={pending.length > 0 ? "default" : "outline"}
              className="ml-1"
            >
              {pending.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Nothing waiting on you — every recent deletion has cleared the
              safety cap.
            </div>
          ) : (
            <RequestList rows={pending} pending />
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-4 w-4" />
            Recent activity
            <Badge variant="outline" className="ml-1">
              {history.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No deletions logged yet.
            </div>
          ) : (
            <RequestList rows={history} pending={false} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RequestList({
  rows,
  pending,
}: {
  rows: DeleteRequest[];
  pending: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Resource</TableHead>
            <TableHead className="hidden md:table-cell">By</TableHead>
            <TableHead className="hidden lg:table-cell">When</TableHead>
            <TableHead>Status</TableHead>
            {pending && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <RequestRow key={r.id} request={r} pending={pending} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RequestRow({
  request,
  pending,
}: {
  request: DeleteRequest;
  pending: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const approve = useApproveDeleteRequest();
  const deny = useDenyDeleteRequest();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: DELETE_REQUESTS_KEY });
    queryClient.invalidateQueries({
      queryKey: DELETE_REQUESTS_PENDING_COUNT_KEY,
    });
  }

  function handleApprove() {
    approve.mutate(request.id, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Deletion approved" });
      },
      onError: () =>
        toast({ title: "Couldn't approve deletion", variant: "destructive" }),
    });
  }
  function handleDeny() {
    deny.mutate(request.id, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Deletion denied" });
      },
      onError: () =>
        toast({ title: "Couldn't deny deletion", variant: "destructive" }),
    });
  }

  return (
    <TableRow className="text-sm hover:bg-muted/40">
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span className="truncate">
            {request.resourceLabel ??
              `${request.resourceKind} #${request.resourceId}`}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            {request.resourceKind.replace(/_/g, " ")}
          </span>
          {/* Fold the "by + when" under the resource label on phones. */}
          <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground md:hidden">
            <span>{request.requestedByName ?? "unknown"}</span>
            <span aria-hidden>·</span>
            <span>{new Date(request.createdAt).toLocaleString()}</span>
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {request.requestedByName ?? "—"}
          </span>
          {request.requestedByEmail && (
            <span className="font-mono text-xs text-muted-foreground">
              {request.requestedByEmail}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell font-mono text-xs">
        {new Date(request.createdAt).toLocaleString()}
      </TableCell>
      <TableCell>
        <StatusPill status={request.status} />
        {request.decidedByName && (
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            by {request.decidedByName}
          </div>
        )}
      </TableCell>
      {pending && (
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleDeny}
              disabled={deny.isPending || approve.isPending}
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Deny</span>
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleApprove}
              disabled={approve.isPending || deny.isPending}
            >
              <Check className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Approve</span>
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

function StatusPill({ status }: { status: DeleteRequest["status"] }) {
  if (status === "PENDING") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/60 text-amber-700 dark:text-amber-300"
      >
        <Clock className="h-3 w-3" /> Pending
      </Badge>
    );
  }
  if (status === "EXECUTED") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <CheckCircle2 className="h-3 w-3" /> Executed
      </Badge>
    );
  }
  if (status === "APPROVED") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
      >
        <CheckCircle2 className="h-3 w-3" /> Approved
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-rose-500/60 text-rose-700 dark:text-rose-300"
    >
      <XCircle className="h-3 w-3" /> Denied
    </Badge>
  );
}
