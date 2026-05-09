import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Trash2, Check, Star, Copy, Download, X, RefreshCw } from "lucide-react";
import { useFBIds } from "@/hooks/useFBIds";
import { useFBProfile, unlockUid } from "@/hooks/useFBProfile";
import { useSettings } from "@/hooks/useSettings";
import FBIdItem from "@/components/FBIdItem";
import NoteDialog from "@/components/NoteDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FBId } from "@/types/fbid";
import { toast } from "sonner";

type Filter = "all" | "checked" | "unchecked" | "saved" | "noted" | "tagged";
type Sort = "newest" | "oldest" | "checked" | "unchecked" | "saved";

export default function Home() {
  const { items, setItems, loading } = useFBIds();
  const { fetchProfiles, recheckInstagram, loading: fetching, igProgress } = useFBProfile(setItems);
  const { viewMode, autoRetry } = useSettings();

  // Seed completion lock from previously-saved items so they aren't re-fetched.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !items.length) return;
    seededRef.current = true;
    try {
      const raw = localStorage.getItem("fb_complete_uids_v1");
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      for (const i of items) {
        if (i.real_name && i.username && i.photo_url && i.follower_count) set.add(i.uid);
      }
      localStorage.setItem("fb_complete_uids_v1", JSON.stringify([...set]));
    } catch { /* ignore */ }
  }, [items]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 180);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteFor, setNoteFor] = useState<FBId | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [confirmRecheck, setConfirmRecheck] = useState(false);

  useEffect(() => setVisibleCount(50), [filter, search, sort]);

  // Auto-retry failed/rate-limited/never-fetched/incomplete UIDs.
  // Per-UID cap at 12 retries with exponential backoff.
  const retryCountsRef = useRef<Map<string, number>>(new Map());
  const retryTimersRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!autoRetry) return;
    const MAX = 12;
    const isIncomplete = (i: typeof items[number]) =>
      !i.real_name || !i.username || !i.photo_url || !i.follower_count;
    const isComplete = (i: typeof items[number]) =>
      !!i.real_name && !!i.username && !!i.photo_url && !!i.follower_count;
    const candidates = items.filter((i) => {
      if (i.instagram_checking || i.fetch_status === "pending" || i.fetch_status === "retrying") return false;
      // LOCK: once a UID has full data (name + username + photo + followers), never re-fetch.
      if (isComplete(i)) return false;
      if (i.fetch_status === "failed" || i.fetch_status === "rate_limited") return true;
      // Never fetched or fetched but missing core fields → re-queue
      if (!i.fetch_status && isIncomplete(i)) return true;
      if (i.fetch_status === "done" && isIncomplete(i)) return true;
      return false;
    });
    // Batch up to 50 candidates per scheduling tick to avoid flooding
    for (const it of candidates.slice(0, 200)) {
      if (retryTimersRef.current.has(it.uid)) continue;
      const tries = retryCountsRef.current.get(it.uid) ?? 0;
      if (tries >= MAX) continue;
      // Exponential backoff: 3s, 6s, 12s, 24s … capped at 5min
      const delay = Math.min(3000 * Math.pow(2, tries), 300_000);
      const timer = window.setTimeout(() => {
        retryTimersRef.current.delete(it.uid);
        retryCountsRef.current.set(it.uid, tries + 1);
        fetchProfiles([it.uid]);
      }, delay);
      retryTimersRef.current.set(it.uid, timer);
    }
    // Clear retry counter for UIDs that have succeeded with usable data
    for (const it of items) {
      if (
        it.fetch_status === "done" &&
        (it.real_name || it.username || it.photo_url) &&
        retryCountsRef.current.has(it.uid)
      ) {
        retryCountsRef.current.delete(it.uid);
      }
    }
    return () => {
      // do not clear timers on every render — only on unmount
    };
  }, [items, autoRetry, fetchProfiles]);
  useEffect(() => {
    return () => {
      retryTimersRef.current.forEach((t) => clearTimeout(t));
      retryTimersRef.current.clear();
    };
  }, []);

  const filtered = useMemo(() => {
    let out = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((i) => i.uid.toLowerCase().includes(q) || (i.note ?? "").toLowerCase().includes(q));
    }
    switch (filter) {
      case "checked": out = out.filter((i) => i.visited); break;
      case "unchecked": out = out.filter((i) => !i.visited); break;
      case "saved": out = out.filter((i) => i.pinned); break;
      case "noted": out = out.filter((i) => i.note); break;
      case "tagged": out = out.filter((i) => i.tag); break;
    }
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "oldest": return a.created_at.localeCompare(b.created_at);
        case "checked": return Number(b.visited) - Number(a.visited);
        case "unchecked": return Number(a.visited) - Number(b.visited);
        case "saved": return Number(b.pinned) - Number(a.pinned);
        default: return b.created_at.localeCompare(a.created_at);
      }
    });
    return out;
  }, [items, search, filter, sort]);

  const visible = filtered.slice(0, visibleCount);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + 50, filtered.length));
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const toggleSel = useCallback((id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);
  const clearSel = useCallback(() => setSelected(new Set()), []);

  const updateLocal = useCallback((next: FBId) => {
    setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }, [setItems]);

  const deleteOne = useCallback((item: FBId) => {
    setItems((prev) => prev.filter((p) => p.id !== item.id));
    toast("Deleted", {
      action: { label: "Undo", onClick: () => setItems((prev) => [item, ...prev]) },
      duration: 5000,
    });
  }, [setItems]);

  const bulkUpdate = (patch: Partial<FBId>) => {
    if (!selected.size) return;
    setItems((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, ...patch } : p)));
    toast.success(`Updated ${selected.size} item(s)`);
    clearSel();
  };

  const bulkDelete = () => {
    if (!selected.size) return;
    const removed = items.filter((p) => selected.has(p.id));
    setItems((prev) => prev.filter((p) => !selected.has(p.id)));
    clearSel();
    toast(`Deleted ${removed.length}`, {
      duration: 5000,
      action: { label: "Undo", onClick: () => setItems((prev) => [...removed, ...prev]) },
    });
  };

  const bulkCopy = (fmt: "uidpass" | "uid" | "pass") => {
    const sel = items.filter((i) => selected.has(i.id));
    const text = sel.map((i) =>
      fmt === "uid" ? i.uid : fmt === "pass" ? i.password ?? "" : `${i.uid}${i.password ? "|" + i.password : ""}`
    ).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${sel.length}`);
  };

  const bulkFetch = () => {
    const sel = items.filter((i) => selected.has(i.id));
    fetchProfiles(sel.map((i) => i.uid));
    clearSel();
  };

  const fetchMissing = () => {
    const missing = items
      .filter((i) => !i.real_name && !i.username && !i.photo_url && i.fetch_status !== "done")
      .map((i) => i.uid);
    if (!missing.length) { toast("All profiles already fetched"); return; }
    fetchProfiles(missing);
  };

  const recheckAllInstagram = () => {
    const candidates = items.filter((i) => i.username || i.instagram_username);
    if (!candidates.length) { toast("No usernames to verify"); return; }
    recheckInstagram(
      candidates.map((i) => ({
        uid: i.uid,
        username: i.username,
        instagram_username: i.instagram_username,
      })),
      true
    );
  };

  const retryFailedInstagram = () => {
    const failed = items.filter(
      (i) => i.instagram_verify_status === "failed" || i.instagram_verify_status === "rate_limited"
    );
    if (!failed.length) { toast("No failed IG items to retry"); return; }
    recheckInstagram(
      failed.map((i) => ({
        uid: i.uid,
        username: i.username,
        instagram_username: i.instagram_username,
      })),
      true
    );
  };

  const igCandidatesCount = useMemo(
    () => items.filter((i) => i.username || i.instagram_username).length,
    [items]
  );

  const failedIgCount = useMemo(
    () =>
      items.filter(
        (i) => i.instagram_verify_status === "failed" || i.instagram_verify_status === "rate_limited"
      ).length,
    [items]
  );

  const fetchOne = useCallback((uid: string) => fetchProfiles([uid]), [fetchProfiles]);
  const recheckOne = useCallback(
    (item: FBId) =>
      recheckInstagram(
        [{ uid: item.uid, username: item.username, instagram_username: item.instagram_username }],
        true
      ),
    [recheckInstagram]
  );

  const openNote = useCallback((item: FBId) => setNoteFor(item), []);

  const exportFile = (kind: "txt" | "csv", scope: "all" | "checked" | "unchecked" | "saved") => {
    let data = items;
    if (scope === "checked") data = data.filter((i) => i.visited);
    if (scope === "unchecked") data = data.filter((i) => !i.visited);
    if (scope === "saved") data = data.filter((i) => i.pinned);
    let text = "";
    if (kind === "csv") {
      text = "uid,password,pinned,visited,note,tag,visited_at,created_at\n" +
        data.map((d) => [d.uid, d.password ?? "", d.pinned, d.visited, (d.note ?? "").replace(/"/g, '""'), d.tag ?? "", d.visited_at ?? "", d.created_at]
          .map((v) => `"${v}"`).join(",")).join("\n");
    } else {
      text = data.map((d) => `${d.uid}${d.password ? "|" + d.password : ""}`).join("\n");
    }
    const blob = new Blob([text], { type: kind === "csv" ? "text/csv" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fbids-${scope}.${kind}`; a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => [
    { label: "Total",   val: items.length,                              color: "text-foreground" },
    { label: "Checked", val: items.filter((i) => i.visited).length,     color: "text-primary" },
    { label: "Left",    val: items.filter((i) => !i.visited).length,    color: "text-accent" },
    { label: "Saved",   val: items.filter((i) => i.pinned).length,      color: "text-foreground italic" },
  ], [items]);

  return (
    <div className="space-y-3">
      <div className="border-b-2 border-foreground pb-4 -mt-1">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">§ 01 / Index</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}
          </div>
        </div>
        <h1 className="font-display text-5xl mt-2 leading-[0.95]">
          The <span className="italic text-primary">Ledger</span>,<br/>
          <span className="text-muted-foreground">reimagined.</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-2 max-w-md">
          Track, tag, and verify every account. Eight design modes — one click away.
        </p>
      </div>
      {igProgress.total > 0 && (
        <div className="sticky top-0 z-30 -mx-1">
          <div className="brutal px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <RefreshCw className="w-3 h-3 animate-spin text-primary" />
              <span className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
                Sync · {igProgress.done}/{igProgress.total} · {igProgress.total - igProgress.done} left
              </span>
              <div className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
                <span className="text-muted-foreground">⏳ {igProgress.processing}</span>
                <span className="text-primary">✓ {igProgress.success}</span>
                <span className="text-destructive">✗ {igProgress.failed}</span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-muted border border-foreground overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (igProgress.done / igProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="brutal p-3 text-left transition-all hover:-translate-y-0.5 hover:translate-x-0.5 relative overflow-hidden group"
          >
            <div className="absolute top-1.5 right-2 text-[8px] font-mono text-muted-foreground">0{i + 1}</div>
            <div className="absolute -bottom-4 -right-4 text-7xl font-display italic text-foreground/[0.04] leading-none select-none pointer-events-none">
              {s.val}
            </div>
            <div className={`font-display text-4xl tabular-nums leading-none relative ${s.color}`}>{s.val}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-3 font-mono relative">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search UID or note…"
          className="pl-10 bg-card border-border/60"
        />
      </div>

      <div className="flex gap-2 items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="flex-1 overflow-x-auto no-scrollbar">
          <TabsList className="w-max">
            {(["all", "checked", "unchecked", "saved", "noted", "tagged"] as Filter[]).map((f) => (
              <TabsTrigger key={f} value={f} className="capitalize text-xs">{f}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-[110px] shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="checked">Checked</SelectItem>
            <SelectItem value="unchecked">Unchecked</SelectItem>
            <SelectItem value="saved">Saved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="glass rounded-xl p-2 flex items-center gap-1 flex-wrap sticky top-14 z-20"
          >
            <span className="text-sm font-bold px-2 text-primary">{selected.size}</span>
            <Button size="sm" variant="ghost" onClick={() => bulkUpdate({ visited: true, visited_at: new Date().toISOString() })}>
              <Check className="w-4 h-4 mr-1" /> Check
            </Button>
            <Button size="sm" variant="ghost" onClick={() => bulkUpdate({ visited: false, visited_at: null })}>
              Uncheck
            </Button>
            <Button size="sm" variant="ghost" onClick={() => bulkUpdate({ pinned: true })}>
              <Star className="w-4 h-4 mr-1" /> Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost"><Copy className="w-4 h-4 mr-1" /> Copy</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => bulkCopy("uidpass")}>UID|Pass</DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkCopy("uid")}>UID only</DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkCopy("pass")}>Password only</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={bulkDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={bulkFetch} disabled={fetching}>
              <RefreshCw className={`w-4 h-4 mr-1 ${fetching ? "animate-spin" : ""}`} /> Fetch
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSel} className="ml-auto">
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchMissing} disabled={fetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${fetching ? "animate-spin" : ""}`} /> Fetch missing
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmRecheck(true)} disabled={fetching || igProgress.total > 0}>
          <RefreshCw className={`w-4 h-4 mr-1 ${igProgress.total > 0 ? "animate-spin" : ""}`} /> Recheck IG
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={retryFailedInstagram}
          disabled={fetching || igProgress.total > 0 || failedIgCount === 0}
          title={`${failedIgCount} failed/rate-limited item(s)`}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${igProgress.total > 0 ? "animate-spin" : ""}`} /> Retry failed
          {failedIgCount > 0 && <span className="ml-1.5 text-[10px] bg-muted-foreground/20 rounded px-1">{failedIgCount}</span>}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" /> Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {(["all", "checked", "unchecked", "saved"] as const).map((scope) => (
              <div key={scope}>
                <DropdownMenuItem onClick={() => exportFile("txt", scope)}>{scope} → .txt</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFile("csv", scope)}>{scope} → .csv</DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-2">No items yet.</p>
          <a href="/import" className="text-primary underline underline-offset-4">Import some UIDs →</a>
        </div>
      ) : (
        <div className={viewMode === "compact" ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-2"}>
          {visible.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              onToggleSelect={toggleSel}
              onChange={updateLocal}
              onDelete={deleteOne}
              onOpenNote={openNote}
              onFetchProfile={fetchOne}
              onRecheckInstagram={recheckOne}
            />
          ))}
          <div ref={sentinelRef} />
          {visibleCount < filtered.length && (
            <div className="text-center py-4 text-xs text-muted-foreground">Loading more…</div>
          )}
        </div>
      )}

      <NoteDialog item={noteFor} onClose={() => setNoteFor(null)} onSaved={updateLocal} />

      <AlertDialog open={confirmRecheck} onOpenChange={setConfirmRecheck}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recheck Instagram for all?</AlertDialogTitle>
            <AlertDialogDescription>
              This will re-verify Instagram for {igCandidatesCount} item{igCandidatesCount === 1 ? "" : "s"} (max 20 per run).
              It may take a while and can hit rate limits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRecheck(false);
                recheckAllInstagram();
              }}
            >
              Recheck
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type RowProps = {
  item: FBId;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onChange: (next: FBId) => void;
  onDelete: (item: FBId) => void;
  onOpenNote: (item: FBId) => void;
  onFetchProfile: (uid: string) => void;
  onRecheckInstagram: (item: FBId) => void;
};
const Row = memo(function Row({ item, selected, onToggleSelect, onChange, onDelete, onOpenNote, onFetchProfile, onRecheckInstagram }: RowProps) {
  return (
    <FBIdItem
      item={item}
      selected={selected}
      onToggleSelect={() => onToggleSelect(item.id)}
      onChange={onChange}
      onDelete={() => onDelete(item)}
      onOpenNote={() => onOpenNote(item)}
      onFetchProfile={() => onFetchProfile(item.uid)}
      onRecheckInstagram={() => onRecheckInstagram(item)}
    />
  );
});
