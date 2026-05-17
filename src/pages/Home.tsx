import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Trash2, Check, Star, Copy, Download, X, RefreshCw } from "lucide-react";
import { useFBIds } from "@/hooks/useFBIds";
import { useFBProfile, unlockUid, lockUidsComplete } from "@/hooks/useFBProfile";
import { useSettings } from "@/hooks/useSettings";
import { scanInWorker } from "@/workers/heavyClient";
import NoteDialog from "@/components/NoteDialog";
import VirtualFBList from "@/components/VirtualFBList";
import TopLoadingBar from "@/components/TopLoadingBar";
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
    const completeUids = items
      .filter((i) => i.real_name && i.username && i.photo_url && i.follower_count)
      .map((i) => i.uid);
    if (completeUids.length) lockUidsComplete(completeUids);
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
  const [confirmRecheck, setConfirmRecheck] = useState(false);

  // Auto-retry failed/rate-limited/never-fetched/incomplete UIDs.
  // Per-UID cap at 12 retries with exponential backoff.
  const retryCountsRef = useRef<Map<string, number>>(new Map());
  const retryTimersRef = useRef<Map<string, number>>(new Map());
  // Tracks the wall-clock time each scheduled retry will fire, used to
  // surface a "next retry in Xs" countdown on the import progress bar.
  const retryEtaRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!autoRetry) return;
    const MAX = 15;
    const NOT_FOUND_MAX = 3;
    const COOLDOWN_MS = 30_000;
    let cancelled = false;

    const scheduleBatch = (
      group: Array<{ uid: string; tries: number }>,
      delay: number,
    ) => {
      if (!group.length) return;
      const batch = group.slice(0, 25);
      const eta = Date.now() + delay;
      for (const it of batch) {
        retryEtaRef.current.set(it.uid, eta);
        retryTimersRef.current.set(it.uid, 0 as unknown as number);
        retryCountsRef.current.set(it.uid, it.tries + 1);
      }
      const timer = window.setTimeout(() => {
        for (const it of batch) {
          retryTimersRef.current.delete(it.uid);
          retryEtaRef.current.delete(it.uid);
        }
        fetchProfiles(batch.map((b) => b.uid));
      }, delay);
      if (batch[0]) retryTimersRef.current.set(batch[0].uid, timer);
    };
    const bucketDelay = (
      status: "rate_limited" | "not_found" | "other",
      group: Array<{ uid: string; tries: number }>,
    ) => {
      const minTries = Math.min(...group.map((g) => g.tries));
      if (status === "rate_limited") return Math.min(15_000 * Math.pow(1.8, minTries), 600_000);
      if (status === "not_found") return Math.min(60_000 * Math.pow(2, minTries), 900_000);
      return Math.min(2000 * Math.pow(2, minTries), 300_000);
    };

    scanInWorker({
      items,
      retryCounts: Array.from(retryCountsRef.current.entries()),
      scheduledUids: Array.from(retryTimersRef.current.keys()),
      now: Date.now(),
      scanLimit: 300,
      max: MAX,
      notFoundMax: NOT_FOUND_MAX,
      cooldownMs: COOLDOWN_MS,
    }).then((buckets) => {
      if (cancelled) return;
      if (buckets.other.length) scheduleBatch(buckets.other, bucketDelay("other", buckets.other));
      if (buckets.rate_limited.length) scheduleBatch(buckets.rate_limited, bucketDelay("rate_limited", buckets.rate_limited));
      if (buckets.not_found.length) scheduleBatch(buckets.not_found, bucketDelay("not_found", buckets.not_found));
    }).catch(() => { /* ignore */ });

    return () => {
      cancelled = true;
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
  }, [setItems]);

  const bulkUpdate = (patch: Partial<FBId>) => {
    if (!selected.size) return;
    setItems((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, ...patch } : p)));
    clearSel();
  };

  const bulkDelete = () => {
    if (!selected.size) return;
    const removed = items.filter((p) => selected.has(p.id));
    setItems((prev) => prev.filter((p) => !selected.has(p.id)));
    clearSel();
  };

  const bulkCopy = (fmt: "uidpass" | "uid" | "pass") => {
    const sel = items.filter((i) => selected.has(i.id));
    const text = sel.map((i) =>
      fmt === "uid" ? i.uid : fmt === "pass" ? i.password ?? "" : `${i.uid}${i.password ? "|" + i.password : ""}`
    ).join("\n");
    navigator.clipboard.writeText(text);
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
    if (!missing.length) return;
    fetchProfiles(missing);
  };

  // Retry every UID in a failure state. Mark them as "retrying" immediately
  // so the import progress bar updates before the network call resolves.
  const retryFailedFetches = () => {
    const failed = items.filter(
      (i) =>
        i.fetch_status === "failed" ||
        i.fetch_status === "rate_limited" ||
        i.fetch_status === "not_found"
    );
    if (!failed.length) return;
    const uids = failed.map((i) => i.uid);
    // Reset per-UID retry counters so the auto-retry loop will pick up
    // anything beyond the first batch slice.
    for (const u of uids) {
      retryCountsRef.current.delete(u);
      unlockUid(u);
    }
    const failSet = new Set(uids);
    setItems((prev) =>
      prev.map((p) =>
        failSet.has(p.uid)
          ? { ...p, fetch_status: "retrying", fetch_error: null, fetch_last_attempt_at: null }
          : p
      )
    );
    // Kick the first slice now; the auto-retry loop drains the rest under
    // the global concurrency gate.
    fetchProfiles(uids.slice(0, 50));
  };

  const recheckAllInstagram = () => {
    const candidates = items.filter((i) => i.username || i.instagram_username);
    if (!candidates.length) return;
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
    if (!failed.length) return;
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

  // Import / fetch progress derived from item state — reflects the true
  // pipeline (done / retrying / failed) across all imported UIDs.
  const importProgress = useMemo(() => {
    const isComplete = (i: FBId) =>
      !!i.real_name && !!i.username && !!i.photo_url && !!i.follower_count;
    let done = 0, retrying = 0, failed = 0, tracked = 0;
    for (const i of items) {
      const hasState = !!i.fetch_status || isComplete(i);
      if (!hasState) continue;
      tracked++;
      if (isComplete(i) || i.fetch_status === "done") done++;
      else if (i.fetch_status === "pending" || i.fetch_status === "retrying") retrying++;
      else if (
        i.fetch_status === "failed" ||
        i.fetch_status === "rate_limited" ||
        i.fetch_status === "not_found"
      ) failed++;
    }
    return { tracked, done, retrying, failed };
  }, [items]);
  const showImportBar = importProgress.retrying > 0 || igProgress.total > 0;
  // Global thin loader: visible while we're still fetching profile data,
  // OR while items exist but none have resolved any profile fields yet
  // (covers the gap between "just imported" and "first batch returns").
  const firstResolved = useMemo(
    () => items.some((i) => i.real_name || i.username || i.photo_url),
    [items]
  );
  const showTopLoader =
    importProgress.retrying > 0 ||
    igProgress.processing > 0 ||
    (items.length > 0 && !firstResolved);

  // 1Hz tick that drives the next-retry countdown while the bar is visible.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!showImportBar) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showImportBar]);
  const nextRetryInfo = useMemo(() => {
    let soonest = Infinity;
    let queued = 0;
    for (const eta of retryEtaRef.current.values()) {
      queued++;
      if (eta < soonest) soonest = eta;
    }
    if (!queued || !isFinite(soonest)) return { queued: 0, secs: 0 };
    return { queued, secs: Math.max(0, Math.ceil((soonest - nowTick) / 1000)) };
  }, [nowTick, importProgress.retrying]);
  const fmtSecs = (s: number) =>
    s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

  return (
    <div className="space-y-3">
      <TopLoadingBar show={showTopLoader} label="Loading profiles" />
      <div className="border-b border-border pb-3">
        <h1 className="text-2xl font-semibold">Home</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {items.length} item{items.length === 1 ? "" : "s"} · track, tag and verify accounts
        </p>
      </div>
      {showImportBar && (
        <div
          className="sticky z-20 -mx-1"
          style={{ top: "var(--header-h, 56px)" }}
        >
          <div className="brutal px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <RefreshCw className="w-3 h-3 animate-spin text-primary" />
              <span className="text-[11px] text-muted-foreground">
                Import · {importProgress.done}/{importProgress.tracked}
              </span>
              <div className="ml-auto flex items-center gap-2 text-[11px]">
                <span className="text-primary">{importProgress.done} done</span>
                <span className="text-amber-400">{importProgress.retrying} retrying</span>
                <span className="text-destructive">{importProgress.failed} failed</span>
              </div>
            </div>
            {nextRetryInfo.queued > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Next retry in <span className="text-foreground tabular-nums">{fmtSecs(nextRetryInfo.secs)}</span></span>
                <span className="opacity-60">·</span>
                <span>{nextRetryInfo.queued} queued</span>
              </div>
            )}
            <div className="w-full h-1.5 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${
                    importProgress.tracked
                      ? Math.min(100, (importProgress.done / importProgress.tracked) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="brutal p-3 text-left">
            <div className={`text-2xl font-semibold tabular-nums leading-none ${s.color}`}>{s.val}</div>
            <div className="text-[11px] text-muted-foreground mt-1.5">{s.label}</div>
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
        <Button
          variant="outline"
          size="sm"
          onClick={retryFailedFetches}
          disabled={fetching || importProgress.failed === 0}
          title={`${importProgress.failed} failed item(s)`}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${fetching ? "animate-spin" : ""}`} /> Retry failed
          {importProgress.failed > 0 && (
            <span className="ml-1.5 text-[10px] bg-muted-foreground/20 rounded px-1">{importProgress.failed}</span>
          )}
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-2">No items yet.</p>
          <a href="/import" className="text-primary underline underline-offset-4">Import some UIDs →</a>
        </div>
      ) : (
        <VirtualFBList
          items={filtered}
          compact={viewMode === "compact"}
          selected={selected}
          onToggleSelect={toggleSel}
          onChange={updateLocal}
          onDelete={deleteOne}
          onOpenNote={openNote}
          onFetchProfile={fetchOne}
          onRecheckInstagram={recheckOne}
        />
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
