import { useState, useRef } from "react";
import { motion, PanInfo, useAnimation } from "framer-motion";
import {
  Star, Check, Trash2, Copy, ExternalLink, Tag as TagIcon, StickyNote, MoreVertical
} from "lucide-react";
import { FBId, TAGS, TAG_COLORS, Tag } from "@/types/fbid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";

interface Props {
  item: FBId;
  selected: boolean;
  onToggleSelect: () => void;
  onChange: (next: FBId) => void;
  onDelete: () => void;
  onOpenNote: () => void;
}

export default function FBIdItem({ item, selected, onToggleSelect, onChange, onDelete, onOpenNote }: Props) {
  const { viewMode } = useSettings();
  const controls = useAnimation();
  const [showDelete, setShowDelete] = useState(false);

  const update = async (patch: Partial<FBId>) => {
    const optimistic = { ...item, ...patch };
    onChange(optimistic);
    const { error } = await supabase.from("facebook_ids").update(patch).eq("id", item.id);
    if (error) toast.error(error.message);
  };

  const openLink = async () => {
    window.open(`https://facebook.com/${encodeURIComponent(item.uid)}`, "_blank", "noopener");
    if (!item.visited) {
      await update({ visited: true, visited_at: new Date().toISOString() });
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -120) {
      controls.start({ x: -1000, opacity: 0 });
      setTimeout(onDelete, 200);
    } else {
      controls.start({ x: 0 });
      setShowDelete(false);
    }
  };

  const setTag = (t: Tag | null) => update({ tag: t });

  const compact = viewMode === "compact";

  return (
    <div className="relative">
      {/* swipe-delete background */}
      <div className="absolute inset-0 bg-destructive rounded-xl flex items-center justify-end pr-6">
        <Trash2 className="text-destructive-foreground w-5 h-5" />
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={0.1}
        animate={controls}
        onDrag={(_, info) => setShowDelete(info.offset.x < -60)}
        onDragEnd={onDragEnd}
        className={`relative glass rounded-xl shadow-card p-3 ${selected ? "ring-2 ring-primary" : ""} ${compact ? "p-2" : ""}`}
      >
        <div className="flex items-start gap-2">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={openLink}
                className={`font-semibold truncate hover:underline flex items-center gap-1 ${item.visited ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {item.uid}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </button>
              {item.visited && <Check className="w-3.5 h-3.5 text-success" style={{ color: "hsl(var(--success))" }} />}
              {item.tag && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TAG_COLORS[item.tag as Tag] || ""}`}>
                  {item.tag}
                </span>
              )}
            </div>
            {!compact && item.password && (
              <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
                <span>••••••••</span>
                <button onClick={() => copy(item.password!, "Password")} className="hover:text-foreground">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            )}
            {!compact && item.note && (
              <button
                onClick={onOpenNote}
                className="text-xs text-muted-foreground mt-1 line-clamp-2 text-left hover:text-foreground"
              >
                <StickyNote className="w-3 h-3 inline mr-1" />
                {item.note}
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              size="icon" variant="ghost"
              className="h-8 w-8"
              onClick={() => update({ pinned: !item.pinned })}
              title="Save"
            >
              <Star className={`w-4 h-4 ${item.pinned ? "fill-yellow-400 text-yellow-400" : ""}`} />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => update({ visited: !item.visited, visited_at: !item.visited ? new Date().toISOString() : null })}>
                  <Check className="w-4 h-4 mr-2" /> Mark {item.visited ? "unchecked" : "checked"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenNote}>
                  <StickyNote className="w-4 h-4 mr-2" /> Edit note
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copy(`${item.uid}${item.password ? "|" + item.password : ""}`, "UID|Pass")}>
                  <Copy className="w-4 h-4 mr-2" /> Copy UID|Pass
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copy(item.uid, "UID")}>
                  <Copy className="w-4 h-4 mr-2" /> Copy UID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">
                  <TagIcon className="w-3 h-3 inline mr-1" /> Tag
                </DropdownMenuLabel>
                {TAGS.map((t) => (
                  <DropdownMenuItem key={t} onClick={() => setTag(t)}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${TAG_COLORS[t].split(" ")[0]}`} />
                    {t}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setTag(null)}>Clear tag</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>
    </div>
  );
}