import { useState } from "react";
import { motion, PanInfo, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Star, Check, Trash2, Copy, ExternalLink, Tag as TagIcon, StickyNote, MoreVertical,
} from "lucide-react";
import { FBId, TAGS, TAG_COLORS, Tag } from "@/types/fbid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";

interface Props {
  item: FBId;
  selected: boolean;
  onToggleSelect: () => void;
  onChange: (next: FBId) => void;
  onDelete: () => void;
  onOpenNote: () => void;
}

function Avatar({ uid, name, size = 40 }: { uid: string; name: string | null | undefined; size?: number }) {
  const initials = (name ?? uid).slice(0, 2).toUpperCase();
  const hue = uid.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const grad = `linear-gradient(135deg, hsl(${hue},65%,42%), hsl(${(hue + 50) % 360},70%,55%))`;
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center text-white font-bold border border-white/10"
      style={{ width: size, height: size, background: grad, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

export default function FBIdItem({ item, selected, onToggleSelect, onChange, onDelete, onOpenNote }: Props) {
  const { viewMode, swipeDelete } = useSettings();
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-160, -20, 0], [1, 0.15, 0]);
  const iconScale = useTransform(x, [-160, -60, 0], [1, 0.6, 0.4]);
  const [axisLocked, setAxisLocked] = useState<"x" | "y" | null>(null);

  const update = (patch: Partial<FBId>) => onChange({ ...item, ...patch });

  const openLink = () => {
    window.open(`https://facebook.com/${encodeURIComponent(item.uid)}`, "_blank", "noopener");
    if (!item.visited) update({ visited: true, visited_at: new Date().toISOString() });
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setAxisLocked(null);
    if (axisLocked === "y") { animate(x, 0, { type: "spring", stiffness: 500, damping: 40 }); return; }
    const shouldDelete = info.offset.x < -120 || info.velocity.x < -600;
    if (shouldDelete) animate(x, -window.innerWidth, { duration: 0.25, ease: "easeOut", onComplete: onDelete });
    else animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
  };

  const setTag = (t: Tag | null) => update({ tag: t });
  const confirmDelete = () => { if (window.confirm(`Delete ${item.uid}?`)) onDelete(); };
  const compact = viewMode === "compact";

  return (
    <div className="relative overflow-hidden rounded-xl touch-pan-y">
      {swipeDelete && (
        <motion.div
          style={{ opacity: bgOpacity }}
          className="absolute inset-0 bg-destructive rounded-xl flex items-center justify-end pr-6 pointer-events-none"
        >
          <motion.div style={{ scale: iconScale }}>
            <Trash2 className="text-destructive-foreground w-5 h-5" />
          </motion.div>
        </motion.div>
      )}
      <motion.div
        {...(swipeDelete
          ? {
              drag: "x" as const,
              dragDirectionLock: true,
              onDirectionLock: (axis: "x" | "y") => setAxisLocked(axis),
              dragConstraints: { left: -200, right: 0 },
              dragElastic: { left: 0.2, right: 0 },
              style: { x },
              onDragEnd,
            }
          : {})}
        className={`relative bg-card border rounded-xl shadow-card transition-colors ${selected ? "border-primary ring-1 ring-primary/40" : "border-border/60"} ${compact ? "p-2" : "p-3"}`}
      >
        <div className="flex items-start gap-2.5">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1.5" />

          <Avatar uid={item.uid} name={item.real_name} size={compact ? 32 : 40} />

          <div className="flex-1 min-w-0">
            {item.real_name && (
              <div className="flex items-center gap-1.5">
                <div className="text-sm font-semibold truncate">{item.real_name}</div>
                <button onClick={() => copy(item.real_name!, "Name")} className="text-muted-foreground hover:text-foreground shrink-0" title="Copy name">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={openLink}
                className={`text-sm truncate hover:underline flex items-center gap-1 font-mono ${item.visited ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {item.uid}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </button>
              <button onClick={() => copy(item.uid, "UID")} className="text-muted-foreground hover:text-foreground" title="Copy UID">
                <Copy className="w-3 h-3" />
              </button>
              {item.visited && <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--success))" }} />}
              {item.tag && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TAG_COLORS[item.tag as Tag] || ""}`}>
                  {item.tag}
                </span>
              )}
            </div>
            {!compact && item.password && (
              <div className="text-xs text-muted-foreground font-mono mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-secondary border border-border/60 truncate max-w-[160px] text-foreground/80">
                  {item.password}
                </span>
                <button onClick={() => copy(item.password!, "Password")} className="hover:text-foreground flex items-center gap-1" title="Copy password">
                  <Copy className="w-3 h-3" /> Pass
                </button>
                <button onClick={() => copy(`${item.uid}|${item.password}`, "UID|Pass")} className="hover:text-foreground flex items-center gap-1" title="Copy UID|Pass">
                  <Copy className="w-3 h-3" /> UID|Pass
                </button>
              </div>
            )}
            {!compact && item.note && (
              <button onClick={onOpenNote} className="text-xs text-muted-foreground mt-1.5 line-clamp-2 text-left hover:text-foreground flex items-start gap-1">
                <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{item.note}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => update({ pinned: !item.pinned })} title="Save">
              <Star className={`w-4 h-4 ${item.pinned ? "fill-amber-400 text-amber-400" : ""}`} />
            </Button>

            {!swipeDelete && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={confirmDelete} title="Delete">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}

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
                <DropdownMenuItem className="text-destructive" onClick={confirmDelete}>
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
