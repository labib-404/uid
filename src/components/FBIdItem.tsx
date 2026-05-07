import { useState, memo } from "react";
import { motion, PanInfo, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Star, Check, Trash2, Copy, ExternalLink, Tag as TagIcon, StickyNote, MoreVertical, RefreshCw, Users, Instagram,
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

function formatCount(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  const num = typeof n === "number" ? n : parseInt(String(n).replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(num)) return String(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(num >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(num >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(num);
}

interface Props {
  item: FBId;
  selected: boolean;
  onToggleSelect: () => void;
  onChange: (next: FBId) => void;
  onDelete: () => void;
  onOpenNote: () => void;
  onFetchProfile?: () => void;
}

function Avatar({ uid, name, username, photo, size = 40 }: { uid: string; name?: string | null; username?: string | null; photo?: string | null; size?: number }) {
  const label = name?.trim() || (username ? `@${username}` : "") || uid || "Unknown user";
  const hasIdentity = Boolean(name?.trim() || username);
  if (photo) {
    return (
      <img
        src={photo}
        alt={label}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="rounded-full shrink-0 object-cover border border-border"
        style={{ width: size, height: size }}
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement & { dataset: DOMStringMap };
          if (!img.dataset.retried) {
            img.dataset.retried = "1";
            const sep = photo.includes("?") ? "&" : "?";
            img.src = `${photo}${sep}_r=${Date.now()}`;
            return;
          }
          img.style.display = "none";
          const hue = uid.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
          const grad = `linear-gradient(135deg, hsl(${hue},35%,38%), hsl(${(hue + 40) % 360},40%,48%))`;
          const initialsSrc = name?.trim() || username || uid;
          const initials =
            (hasIdentity ? initialsSrc.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2) : "?")
              .toUpperCase() || "?";
          toast.error(
            (
              <div className="flex items-start gap-3">
                <div
                  className="rounded-full shrink-0 flex items-center justify-center text-white text-xs font-semibold border border-border/50"
                  style={{ width: 36, height: 36, background: grad }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold leading-tight">Profile picture failed</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {hasIdentity ? label : "Unknown user"}
                  </div>
                  <div className="text-[11px] text-muted-foreground/80 font-mono truncate">
                    UID · {uid}
                  </div>
                </div>
              </div>
            ),
            { duration: 4000 }
          );
        }}
      />
    );
  }
  const initialsSource = name?.trim() || username || uid;
  const initials = hasIdentity
    ? initialsSource.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?"
    : "?";
  const hue = uid.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const grad = `linear-gradient(135deg, hsl(${hue},35%,38%), hsl(${(hue + 40) % 360},40%,48%))`;
  return (
    <div
      title={label}
      aria-label={label}
      className="rounded-full shrink-0 flex items-center justify-center text-white font-semibold border border-border"
      style={{ width: size, height: size, background: grad, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

function FBIdItemBase({ item, selected, onToggleSelect, onChange, onDelete, onOpenNote, onFetchProfile }: Props) {
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
    <div className="relative overflow-hidden rounded-xl touch-pan-y group">
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
        className={`relative bg-card border rounded-xl shadow-card transition-all duration-200 hover:border-border ${selected ? "border-primary ring-1 ring-primary/40 bg-primary/[0.03]" : "border-border/60"} ${compact ? "p-2.5" : "p-3.5"}`}
      >
        <div className="flex items-start gap-3">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-2" />

          <Avatar uid={item.uid} name={item.real_name} username={item.username} photo={item.photo_url} size={compact ? 52 : 64} />

          <div className="flex-1 min-w-0 space-y-1.5">
            {item.real_name && (
              <div className="flex items-center gap-1.5">
                <div className="text-[13px] font-semibold truncate">{item.real_name}</div>
                {item.follower_count && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                    <Users className="w-3 h-3" /> {formatCount(item.follower_count)}
                  </span>
                )}
                <button onClick={() => copy(item.real_name!, "Name")} className="text-muted-foreground hover:text-foreground shrink-0 ml-auto" title="Copy name">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {item.username && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground truncate">@{item.username}</span>
                <button onClick={() => copy(item.username!, "Username")} className="text-muted-foreground hover:text-foreground shrink-0" title="Copy username">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {item.instagram_username && (
                  <a
                    href={`https://instagram.com/${item.instagram_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Instagram @${item.instagram_username}`}
                    className="shrink-0 inline-flex items-center justify-center rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white"
                  >
                    <Instagram className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={openLink}
                className={`text-[15px] truncate hover:underline flex items-center gap-1 font-mono ${item.visited ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {item.uid}
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button onClick={() => copy(item.uid, "UID")} className="text-muted-foreground hover:text-foreground" title="Copy UID">
                <Copy className="w-3.5 h-3.5" />
              </button>
              {item.visited && <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--success))" }} />}
              {item.tag && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TAG_COLORS[item.tag as Tag] || ""}`}>
                  {item.tag}
                </span>
              )}
            </div>
            {!compact && item.password && (
              <div className="text-sm text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-secondary border border-border/60 truncate max-w-[180px] text-foreground/90">
                  {item.password}
                </span>
                <button onClick={() => copy(item.password!, "Password")} className="hover:text-foreground flex items-center gap-1" title="Copy password">
                  <Copy className="w-3.5 h-3.5" /> Pass
                </button>
                <button onClick={() => copy(`${item.uid}|${item.password}`, "UID|Pass")} className="hover:text-foreground flex items-center gap-1" title="Copy UID|Pass">
                  <Copy className="w-3.5 h-3.5" /> UID|Pass
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
            {onFetchProfile && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onFetchProfile} title="Fetch profile info">
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
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

export default memo(FBIdItemBase, (a, b) =>
  a.item === b.item &&
  a.selected === b.selected &&
  a.onToggleSelect === b.onToggleSelect &&
  a.onChange === b.onChange &&
  a.onDelete === b.onDelete &&
  a.onOpenNote === b.onOpenNote &&
  a.onFetchProfile === b.onFetchProfile
);
