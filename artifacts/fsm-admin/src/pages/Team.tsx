import { useMemo, useState } from "react";
import { useListDepartments } from "@workspace/api-client-react";
import {
  useListInvites,
  useCreateInvite,
  useRevokeInvite,
  INVITES_KEY,
  type Invite,
} from "@/lib/extra-api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Plus,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldOff,
  UserPlus,
} from "lucide-react";

const ROLE_OPTIONS = [
  { key: "ADMIN", label: "Administrator" },
  { key: "SALES", label: "Sales / Estimator" },
  { key: "CREW_LEAD", label: "Crew Lead" },
  { key: "MECHANIC", label: "Mechanic / Fleet" },
  { key: "ACCOUNTING_MANAGER", label: "Accounting Manager" },
];

function inviteUrl(token: string): string {
  // Compose against the SPA's base path so the link works on both
  // the local Vite dev server (/admin/...) and the deployed root.
  const base =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "";
  // BASE_URL is "/admin/" in deploy; trim trailing slash for clean
  // URL composition.
  const adminBase =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL.replace(/\/$/, "")
      : "/admin";
  return `${base}${adminBase}/invite/${token}`;
}

export function Team() {
  const { data, isLoading } = useListInvites();
  const invites = data?.invites ?? [];

  const pending = invites.filter((i) => i.status === "pending");
  const settled = invites.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <UserPlus className="h-6 w-6 text-accent-foreground sm:h-7 sm:w-7" />
            Team
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite teammates to the admin console. Each invite is a one-time
            link you can copy and send via your preferred channel — Slack,
            email, SMS, anything.
          </p>
        </div>
        <NewInviteDialog />
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Pending invitations
            <Badge variant="outline" className="ml-1">
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
              No invitations are waiting. Click "New invitation" to create one.
            </div>
          ) : (
            <InviteList rows={pending} canRevoke />
          )}
        </CardContent>
      </Card>

      {settled.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> History
              <Badge variant="outline" className="ml-1">
                {settled.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <InviteList rows={settled} canRevoke={false} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InviteList({
  rows,
  canRevoke,
}: {
  rows: Invite[];
  canRevoke: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead className="hidden md:table-cell">Role</TableHead>
            <TableHead className="hidden lg:table-cell">Department</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((invite) => (
            <InviteRow key={invite.id} invite={invite} canRevoke={canRevoke} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InviteRow({
  invite,
  canRevoke,
}: {
  invite: Invite;
  canRevoke: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const revoke = useRevokeInvite();

  function handleCopy() {
    const url = inviteUrl(invite.token);
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast({ title: "Invite link copied" });
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        toast({ title: "Couldn't copy link", variant: "destructive" });
      },
    );
  }

  function handleRevoke() {
    revoke.mutate(invite.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: INVITES_KEY });
        toast({ title: "Invite revoked" });
      },
      onError: () =>
        toast({ title: "Couldn't revoke invite", variant: "destructive" }),
    });
  }

  const expiresLabel = (() => {
    const d = new Date(invite.expiresAt);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
  })();

  return (
    <TableRow className="text-sm hover:bg-muted/40">
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span>{invite.email}</span>
          {invite.fullName && (
            <span className="text-xs text-muted-foreground">
              {invite.fullName}
            </span>
          )}
          {/* On mobile, fold role + dept under the email so the row stays narrow. */}
          <span className="mt-1 flex flex-wrap gap-1 md:hidden">
            {invite.roleKey && (
              <Badge variant="secondary" className="text-[10px]">
                {invite.roleKey.replace(/_/g, " ")}
              </Badge>
            )}
            {invite.departmentLabel && (
              <Badge variant="outline" className="text-[10px]">
                {invite.departmentLabel}
              </Badge>
            )}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {invite.roleKey ? (
          <Badge variant="secondary" className="text-xs">
            {invite.roleKey.replace(/_/g, " ")}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm">
        {invite.departmentLabel ?? "—"}
      </TableCell>
      <TableCell>
        <StatusPill status={invite.status} />
      </TableCell>
      <TableCell className="hidden md:table-cell font-mono text-xs">
        {expiresLabel}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {invite.status === "pending" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 gap-1.5"
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {copied ? "Copied" : "Copy link"}
              </span>
            </Button>
          )}
          {canRevoke && invite.status === "pending" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={handleRevoke}
              disabled={revoke.isPending}
              title="Revoke"
            >
              <ShieldOff className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusPill({ status }: { status: Invite["status"] }) {
  if (status === "pending") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/60 text-amber-700 dark:text-amber-300"
      >
        <Clock className="h-3 w-3" /> Pending
      </Badge>
    );
  }
  if (status === "accepted") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
      >
        <CheckCircle2 className="h-3 w-3" /> Joined
      </Badge>
    );
  }
  if (status === "revoked") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <ShieldOff className="h-3 w-3" /> Revoked
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <XCircle className="h-3 w-3" /> Expired
    </Badge>
  );
}

function NewInviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleKey, setRoleKey] = useState<string>("ADMIN");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [created, setCreated] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deptsData } = useListDepartments();
  const depts = useMemo(
    () =>
      (deptsData?.departments ?? []).filter(
        // Hide the synthetic "Admin" home department from the picker
        // — for new ADMIN users we land them in Admin automatically.
        (d) => d.key !== "Admin",
      ),
    [deptsData],
  );

  // Default to the first visible department once the list lands.
  if (!departmentId && depts[0]) {
    setDepartmentId(String(depts[0].id));
  }

  const createInvite = useCreateInvite();

  function reset() {
    setEmail("");
    setFullName("");
    setRoleKey("ADMIN");
    setDepartmentId(depts[0] ? String(depts[0].id) : "");
    setCreated(null);
    setError(null);
    setCopied(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const deptId = Number(departmentId);
    if (!Number.isFinite(deptId)) {
      setError("Please pick a department.");
      return;
    }
    createInvite.mutate(
      {
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        roleKey,
        departmentId: deptId,
      },
      {
        onSuccess: ({ invite }) => {
          queryClient.invalidateQueries({ queryKey: INVITES_KEY });
          setCreated({ url: inviteUrl(invite.token) });
        },
        onError: () => setError("Couldn't create the invitation. Try again."),
      },
    );
  }

  function handleCopy() {
    if (!created) return;
    void navigator.clipboard.writeText(created.url).then(
      () => {
        setCopied(true);
        toast({ title: "Invite link copied" });
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast({ title: "Couldn't copy link", variant: "destructive" }),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New invitation
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>
            {created ? "Invitation created" : "Invite a teammate"}
          </DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Share this single-use link with your teammate — they'll set their
              own password and land directly in the admin console.
            </p>
            <div className="space-y-2">
              <Label>Invite link</Label>
              <div className="flex gap-2">
                <Input value={created.url} readOnly className="font-mono text-xs" />
                <Button type="button" onClick={handleCopy} className="shrink-0 gap-1.5">
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires in 14 days. You can revoke it any time from the Team page.
            </p>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name (optional)</Label>
              <Input
                id="invite-name"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role *</Label>
                <Select value={roleKey} onValueChange={setRoleKey}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-dept">Department *</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger id="invite-dept">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createInvite.isPending}>
                {createInvite.isPending ? "Generating…" : "Create invitation"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
