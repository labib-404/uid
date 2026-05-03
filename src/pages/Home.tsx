import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Trash2, Check, Star, Copy, Download, X } from "lucide-react";
import { useFBIds } from "@/hooks/useFBIds";
import { useSettings } from "@/hooks/useSettings";
import FBIdItem from "@/components/FBIdItem";
import NoteDialog from "@/components/NoteDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { FBId } from "@/types/fbid";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Filter = "all" | "checked" | "unchecked" | "saved" | "noted" | "tagged";
type Sort = "newest" | "oldest" | "checked" | "unchecked" | "saved";

export default function Home() {
  const { items, setItems, loading, refresh } = useFBIds();
  const { viewMode } = useSettings();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteFor, setNoteFor] = useState<FBId | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => setVisibleCount(50), [filter, search, sort]);

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

  // infinite scroll
  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        setVisibleCount((c) => Math.min(c + 50, filtered.length));
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [filtered.length]);

  const toggleSel = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const clearSel = () => setSelected(new Set());

  const updateLocal = (next: FBId) => {
    setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  };

  const deleteOne = async (item: FBId) => {
    setItems((prev) => prev.filter((p) => p.id !== item.id));
    const { error } = await supabase.from("facebook_ids").delete().eq("id", item.id);
    if (error) {
      toast.error("Delete failed");
      refresh();
      return;
    }
    toast("Deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          const { error: e2 } = await supabase.from("facebook_ids").insert({
            id: item.id, user_id: item.user_id, uid: item.uid, password: item.password,
            pinned: item.pinned, visited: item.visited, note: item.note, tag: item.tag,
            visited_at: item.visited_at, created_at: item.created_at,
          });
          if (e2) return toast.error("Undo failed");
          refresh();
        },
      },
      duration: 6000,
    });
  };

  const bulkUpdate = async (patch: Partial<FBId>) => {
    if (!selected.size) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("facebook_ids").update(patch).in("id", ids);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, ...patch } : p)));
    toast.success(`Updated ${ids.length} item(s)`);
    clearSel();
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    const ids = Array.from(selected);
    const removed = items.filter((p) => selected.has(p.id));
    setItems((prev) => prev.filter((p) => !selected.has(p.id)));
    const { error } = await supabase.from("facebook_ids").delete().in("id", ids);
    if (error) {
      toast.error("Delete failed");
      refresh();
      return;
    }
    clearSel();
    toast(`Deleted ${ids.length}`, {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: async () => {
          const { error: e2 } = await supabase.from("facebook_ids").insert(
            removed.map((r) => ({
              id: r.id, user_id: r.user_id, uid: r.uid, password: r.password,
              pinned: r.pinned, visited: r.visited, note: r.note, tag: r.tag,
              visited_at: r.visited_at, created_at: r.created_at,
            }))
          );
          if (e2) return toast.error("Undo failed");
          refresh();
        },
      },
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

  return (
    <div className="space-y-3">
      {/* stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Total", val: items.length },
          { label: "Checked", val: items.filter((i) => i.visited).length },
          { label: "Left", val: items.filter((i) => !i.visited).length },
          { label: "Saved", val: items.filter((i) => i.pinned).length },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-2 text-center">
            <div className="text-lg font-bold text-gradient">{s.val}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search UID or note…"
          className="pl-10"
        />
      </div>

      {/* filters + sort */}
      <div className="flex gap-2 items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="flex-1 overflow-x-auto">
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

      {/* bulk bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="glass rounded-xl p-2 flex items-center gap-1 flex-wrap sticky top-14 z-20"
          >
            <span className="text-sm font-medium px-2">{selected.size}</span>
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
            <Button size="sm" variant="ghost" onClick={clearSel} className="ml-auto">
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* export */}
      <div className="flex justify-end">
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

      {/* list */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          No items. <a href="/import" className="text-primary underline">Import some UIDs</a>.
        </div>
      ) : (
        <div className={viewMode === "compact" ? "grid grid-cols-2 gap-2" : "space-y-2"}>
          <AnimatePresence initial={false}>
            {visible.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
              >
                <FBIdItem
                  item={item}
                  selected={selected.has(item.id)}
                  onToggleSelect={() => toggleSel(item.id)}
                  onChange={updateLocal}
                  onDelete={() => deleteOne(item)}
                  onOpenNote={() => setNoteFor(item)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {visibleCount < filtered.length && (
            <div className="text-center py-4 text-xs text-muted-foreground">Loading more…</div>
          )}
        </div>
      )}

      <NoteDialog item={noteFor} onClose={() => setNoteFor(null)} onSaved={updateLocal} />
    </div>
  );
}