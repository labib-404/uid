import { useState } from "react";
import { motion, PanInfo, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Star, Check, Trash2, Copy, ExternalLink, Tag as TagIcon, StickyNote, MoreVertical,
  RefreshCw, Users, MapPin, Instagram
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  item: FBId;
  selected: boolean;
  onToggleSelect: () => void;
  onChange: (next: FBId) => void;
  onDelete: () => void;
  onOpenNote: () => void;
}

export default function FBIdItem({ item, selected, onToggleSelect, onChange, onDelete, onOpenNote }: Props) {
  const { viewMode, swipeDelete } = useSettings();
  const [fetching, setFetching] = useState(false);
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-160, -20, 0], [1, 0.15, 0]);
  const iconScale = useTransform(x, [-160, -60, 0], [1, 0.6, 0.4]);
  const [axisLocked, setAxisLocked] = useState<"x" | "y" | null>(null);

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
    setAxisLocked(null);
    if (axisLocked === "y") {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
      return;
    }
    const shouldDelete = info.offset.x < -120 || info.velocity.x < -600;
    if (shouldDelete) {
      animate(x, -window.innerWidth, { duration: 0.25, ease: "easeOut", onComplete: onDelete });
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
    }
  };

  const setTag = (t: Tag | null) => update({ tag: t });

  const fetchProfile = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fb-profile-lookup", {
        body: { uids: [item.uid] },
      });
      if (error) throw error;
      const r = data?.results?.[item.uid];
      if (!r || r.error) {
        toast.error(r?.error === "rate_limited" ? "Rate limited, try later" : "Profile not found");
      } else {
        onChange({
          ...item,
          real_name: r.name,
          username: r.username,
          photo_url: r.photoUrl,
          follower_count: r.followerCount,
          nationality: r.nationality,
          instagram_username: r.instagramUsername,
          profile_fetched_at: new Date().toISOString(),
        });
        toast.success("Profile fetched");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setFetching(false);
    }
  };

  const confirmDelete = () => {
    if (window.confirm(`Delete ${item.uid}?`)) onDelete();
  };

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
        className={`relative bg-card border border-border/60 rounded-xl shadow-card p-3 ${selected ? "ring-2 ring-primary" : ""} ${compact ? "p-2" : ""}`}
      >
        <div className="flex items-start gap-2">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1" />

          <Avatar className="h-10 w-10 shrink-0">
            {item.photo_url && (
              <AvatarImage
                src={`https://images.weserv.nl/?url=${encodeURIComponent(item.photo_url.replace(/^https?:\/\//, ""))}&w=80&h=80&fit=cover`}
                alt={item.real_name ?? item.uid}
              />
            )}
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              {(item.real_name ?? item.uid).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {item.real_name && (
              <div className="text-sm font-semibold truncate">{item.real_name}</div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={openLink}
                className={`text-sm truncate hover:underline flex items-center gap-1 ${item.visited ? "text-muted-foreground line-through" : item.real_name ? "text-muted-foreground" : "text-foreground font-semibold"}`}
              >
                {item.username ?? item.uid}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </button>
              {item.visited && <Check className="w-3.5 h-3.5 text-success" style={{ color: "hsl(var(--success))" }} />}
              {item.tag && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TAG_COLORS[item.tag as Tag] || ""}`}>
                  {item.tag}
                </span>
              )}
            </div>
            {!compact && (item.follower_count || item.nationality || item.instagram_username) && (
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                {item.follower_count && (
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{item.follower_count}</span>
                )}
                {item.nationality && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.nationality}</span>
                )}
                {item.instagram_username && (
                  <a
                    href={`https://instagram.com/${item.instagram_username}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <Instagram className="w-3 h-3" />@{item.instagram_username}
                  </a>
                )}
              </div>
            )}
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

            {!swipeDelete && (
              <Button
                size="icon" variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={confirmDelete}
                title="Delete"
                aria-label={`Delete ${item.uid}`}
              >
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
                <DropdownMenuItem onClick={fetchProfile} disabled={fetching}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? "animate-spin" : ""}`} />
                  {item.profile_fetched_at ? "Refresh profile" : "Fetch profile"}
                </DropdownMenuItem>
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