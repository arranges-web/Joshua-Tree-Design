import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown } from "lucide-react";

export interface DataTableState<TKey extends string> {
  query: string;
  setQuery: (q: string) => void;
  sortKey: TKey;
  setSortKey: (k: TKey) => void;
  sortDir: "asc" | "desc";
  toggleSort: (k: TKey) => void;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
}

export function useDataTable<TKey extends string>(
  initialSort: TKey,
  initialDir: "asc" | "desc" = "desc",
  initialPageSize = 25,
): DataTableState<TKey> {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<TKey>(initialSort);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialDir);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const toggleSort = (k: TKey) => {
    if (k === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  return {
    query,
    setQuery: (q: string) => {
      setQuery(q);
      setPage(1);
    },
    sortKey,
    setSortKey,
    sortDir,
    toggleSort,
    page,
    setPage,
    pageSize,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
  };
}

export function applySortFilter<T, TKey extends string>(
  rows: T[],
  state: Pick<
    DataTableState<TKey>,
    "query" | "sortKey" | "sortDir" | "page" | "pageSize"
  >,
  search: (row: T) => string,
  getSortValue: (row: T, key: TKey) => string | number | null | undefined,
  extraFilter?: (row: T) => boolean,
) {
  const q = state.query.trim().toLowerCase();
  let filtered = q
    ? rows.filter((r) => search(r).toLowerCase().includes(q))
    : rows.slice();
  if (extraFilter) filtered = filtered.filter(extraFilter);

  filtered.sort((a, b) => {
    const av = getSortValue(a, state.sortKey);
    const bv = getSortValue(b, state.sortKey);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return state.sortDir === "asc" ? -1 : 1;
    if (av > bv) return state.sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const safePage = Math.min(state.page, totalPages);
  const start = (safePage - 1) * state.pageSize;
  const pageRows = filtered.slice(start, start + state.pageSize);
  return { rows: pageRows, total, totalPages, safePage };
}

export function SortHeader<TKey extends string>({
  label,
  sortKey,
  state,
  align = "left",
}: {
  label: string;
  sortKey: TKey;
  state: DataTableState<TKey>;
  align?: "left" | "right" | "center";
}) {
  const active = state.sortKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => state.toggleSort(sortKey)}
      className={`flex w-full items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ${
        align === "right"
          ? "justify-end"
          : align === "center"
            ? "justify-center"
            : "justify-start"
      }`}
    >
      <span>{label}</span>
      <ArrowUpDown
        className={`h-3 w-3 ${active ? "text-primary" : "opacity-40"}`}
      />
      {active && (
        <span className="text-[9px] text-primary">
          {state.sortDir === "asc" ? "▲" : "▼"}
        </span>
      )}
    </button>
  );
}

export function Toolbar({
  state,
  total,
  searchPlaceholder = "Search…",
  children,
}: {
  state: DataTableState<string>;
  total: number;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={state.query}
          onChange={(e) => state.setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
        />
      </div>
      {children}
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">
          {total.toLocaleString()} {total === 1 ? "row" : "rows"}
        </span>
      </div>
    </div>
  );
}

export function Pager<TKey extends string>({
  state,
  totalPages,
  total,
}: {
  state: DataTableState<TKey>;
  totalPages: number;
  total: number;
}) {
  const start = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const end = Math.min(state.page * state.pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-card px-3 py-2 text-xs text-muted-foreground">
      <div className="font-mono">
        {start}–{end} of {total.toLocaleString()}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px]">Rows</span>
          <Select
            value={String(state.pageSize)}
            onValueChange={(v) => state.setPageSize(parseInt(v, 10))}
          >
            <SelectTrigger className="h-7 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 250].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={state.page <= 1}
            onClick={() => state.setPage(state.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono">
            {state.page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={state.page >= totalPages}
            onClick={() => state.setPage(state.page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: "green" | "blue" | "amber" | "red" | "gray";
}) {
  const t =
    tone ??
    (/(complete|paid|approved|active)/i.test(status)
      ? "green"
      : /(scheduled|sent|in_progress|in.shop)/i.test(status)
        ? "blue"
        : /(draft|pending)/i.test(status)
          ? "gray"
          : /(overdue|cancel|reject|retired)/i.test(status)
            ? "red"
            : "amber");
  const cls = {
    green: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
    blue: "bg-sky-100 text-sky-800 ring-sky-600/20",
    amber: "bg-amber-100 text-amber-900 ring-amber-600/30",
    red: "bg-rose-100 text-rose-800 ring-rose-600/20",
    gray: "bg-zinc-100 text-zinc-700 ring-zinc-600/20",
  }[t];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
