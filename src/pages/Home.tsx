import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Trash2, Check, Star, Copy, Download, X, RefreshCw } from "lucide-react";
import { useFBIds } from "@/hooks/useFBIds";
import { useFBProfile } from "@/hooks/useFBProfile";
import { useSettings } from "@/hooks/useSettings";
import FBIdItem from "@/components/FBIdItem";
import NoteDialog from "@/components/NoteDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FBId } from "@/types/fbid";
import { toast } from "sonner";

type Filter = "all" | "checked" | "unchecked" | "saved" | "noted" | "tagged";
type Sort = "newest" | "oldest" | "checked" | "unchecked" | "saved";

export default function Home() {
  const { items, setItems, loading } = useFBIds();
  const { fetchProfiles, recheckInstagram, loading: fetching, igProgress } = useFBProfile(setItems);
  const { viewMode } = useSettings();
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

  useEffect(() => setVisibleCount(50), [filter, search, sort]);

  // Auto-fetch profiles for any items missing data (runs once per session per uid)
  const autoFetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const missing = items
      .filter((i) => !i.real_name && !i.username && !i.photo_url && i.fetch_status !== "done" && !autoFetchedRef.current.has(i.uid))
      .map((i) => i.uid);
    if (!missing.length) return;
    missing.forEach((u) => autoFetchedRef.current.add(u));
    (async () => {
      for (let i = 0; i < missing.length; i += 20) {
        await fetchProfiles(missing.slice(i, i + 20));
      }
    })();
  }, [items, fetchProfiles]);

  // Background IG re-verification after 12h cache expiry
  const igRecheckedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const TTL = 12 * 60 * 60 * 1000;
    const now = Date.now();
    const stale = items.filter((i) => {
      if (igRecheckedRef.current.has(i.uid)) return false;
      if (!i.username && !i.instagram_username) return false;
      const ts = i.instagram_checked_at ? Date.parse(i.instagram_checked_at) : 0;
      return !ts || now - ts > TTL;
    });
    if (!stale.length) return;
    stale.forEach((i) => igRecheckedRef.current.add(i.uid));
    (async () => {
      for (let i = 0; i < stale.length; i += 20) {
        await recheckInstagram(
          stale.slice(i, i + 20).map((s) => ({
            uid: s.uid,
            username: s.username,
            instagram_username: s.instagram_username,
          })),
          false
        );
      }
    })();
  }, [items, recheckInstagram]);

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
    { label: "Total", val: items.length, color: "text-foreground" },
    { label: "Checked", val: items.filter((i) => i.visited).length, color: "text-emerald-400" },
    { label: "Left", val: items.filter((i) => !i.visited).length, color: "text-blue-400" },
    { label: "Saved", val: items.filter((i) => i.pinned).length, color: "text-amber-400" },
  ], [items]);

  return (
    <div className="space-y-3">
      {igProgress.total > 0 && (
        <div className="sticky top-0 z-30 -mx-1">
          <div className="glass rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
            <RefreshCw className="w-3 h-3 animate-spin text-primary" />
            <span className="text-muted-foreground">
              Verifying Instagram… {igProgress.done}/{igProgress.total}
            </span>
            <div className="ml-auto w-24 h-1 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (igProgress.done / igProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-2.5 text-center transition-all hover:border-primary/50 hover:shadow-glow hover:-translate-y-0.5">
            <div className={`font-display text-xl font-bold tabular-nums ${s.color}`}>{s.val}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mt-0.5">{s.label}</div>
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
