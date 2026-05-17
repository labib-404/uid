import { memo, useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
 Star, Check, Trash2, Copy, ExternalLink, Tag as TagIcon, StickyNote, MoreVertical, RefreshCw, Users, UserPlus, Instagram, Loader2, AlertTriangle, Clock,
} from "lucide-react";
import { FBId, TAGS, TAG_COLORS, Tag } from "@/types/fbid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { useSettings } from "@/hooks/useSettings";
import { Skeleton } from "@/components/ui/skeleton";

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
  onRecheckInstagram?: () => void;
}

function Avatar({ uid, name, username, photo, size = 40, loading = false }: { uid: string; name?: string | null; username?: string | null; photo?: string | null; size?: number; loading?: boolean }) {
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
        }}
      />
    );
  }
  if (loading) {
    return (
      <Skeleton
        className="rounded-full shrink-0 border border-white/10"
        style={{ width: size, height: size }}
        aria-label="Loading avatar"
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

function FBIdItemBase({ item, selected, onToggleSelect, onChange, onDelete, onOpenNote, onFetchProfile, onRecheckInstagram }: Props) {
  const { viewMode, swipeDelete } = useSettings();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const deleteBgRef = useRef<HTMLDivElement | null>(null);
  const deleteIconRef = useRef<HTMLDivElement | null>(null);

  const update = (patch: Partial<FBId>) => onChange({ ...item, ...patch });

  const openLink = () => {
    window.open(`https://facebook.com/${encodeURIComponent(item.uid)}`, "_blank", "noopener");
    if (!item.visited) update({ visited: true, visited_at: new Date().toISOString() });
  };

  const copy = (text: string, _label: string) => {
    navigator.clipboard.writeText(text);
  };

  const resetSwipe = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)";
    card.style.transform = "translate3d(0,0,0)";
    if (deleteBgRef.current) deleteBgRef.current.style.opacity = "0";
    if (deleteIconRef.current) deleteIconRef.current.style.transform = "scale(0.4)";
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeDelete || (event.pointerType === "mouse" && event.button !== 0)) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button,a,input,textarea,[role='button'],[role='checkbox']")) return;
    const card = cardRef.current;
    if (!card) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startTime = performance.now();
    let axis: "x" | "y" | null = null;
    card.style.transition = "none";

    const move = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dx) > Math.abs(dy) * 1.25 ? "x" : "y";
      if (axis !== "x") return;
      if (e.cancelable) e.preventDefault();
      const x = Math.min(0, Math.max(-220, dx));
      const progress = Math.min(1, Math.abs(x) / 160);
      card.style.transform = `translate3d(${x}px,0,0)`;
      if (deleteBgRef.current) deleteBgRef.current.style.opacity = String(progress);
      if (deleteIconRef.current) deleteIconRef.current.style.transform = `scale(${0.4 + progress * 0.6})`;
    };

    const up = (e: PointerEvent) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      if (axis !== "x") { resetSwipe(); return; }
      const dx = e.clientX - startX;
      const velocity = dx / Math.max(1, performance.now() - startTime);
      if (dx < -120 || velocity < -0.6) {
        card.style.transition = "transform 180ms ease-out";
        card.style.transform = `translate3d(${-window.innerWidth}px,0,0)`;
        window.setTimeout(onDelete, 180);
        return;
      }
      resetSwipe();
    };
    const cancel = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      resetSwipe();
    };

    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
  }, [onDelete, resetSwipe, swipeDelete]);

  const setTag = (t: Tag | null) => update({ tag: t });
  const confirmDelete = () => { if (window.confirm(`Delete ${item.uid}?`)) onDelete(); };
  const compact = viewMode === "compact";
  // Profile/photo data is still in-flight when there's no identity yet and a
  // fetch is pending/retrying — or right after import before the first attempt
  // resolves (status === "pending"). Show shimmer rows in place of the
  // missing name/username so virtualized rows don't look empty.
  const isFetching =
    item.fetch_status === "pending" || item.fetch_status === "retrying";
  const showSkeleton = isFetching && !item.real_name && !item.username;

  return (
    <div className="relative overflow-hidden touch-pan-y group">
      {swipeDelete && (
        <div
          ref={deleteBgRef}
          style={{ opacity: 0 }}
          className="absolute inset-0 bg-destructive rounded-md flex items-center justify-end pr-6 pointer-events-none"
        >
          <div ref={deleteIconRef} style={{ transform: "scale(0.4)" }}>
            <Trash2 className="text-destructive-foreground w-5 h-5" />
          </div>
        </div>
      )}
      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        style={swipeDelete ? { touchAction: "pan-y", willChange: "transform" } : undefined}
        className={`relative bg-card border border-border rounded-md shadow-card transition-colors hover:bg-secondary/30 ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""} ${compact ? "p-2.5" : "p-3.5"}`}
      >
        <div className="flex items-start gap-3">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-2" />

          <Avatar
            uid={item.uid}
            name={item.real_name}
            username={item.username}
            photo={item.photo_url}
            size={compact ? 64 : 80}
            loading={showSkeleton}
          />

          <div className="flex-1 min-w-0 space-y-1.5">
            {showSkeleton && (
              <div className="space-y-1.5" aria-busy="true" aria-label="Loading profile">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            )}
            {item.real_name && (
              <div className="flex items-center gap-1.5">
                <div className="text-[13px] font-semibold truncate">{item.real_name}</div>
                {item.follower_count && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                    <Users className="w-3 h-3" /> {formatCount(item.follower_count)}
                  </span>
                )}
                {item.friend_count && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                    <UserPlus className="w-3 h-3" /> {formatCount(item.friend_count)}
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
                {item.instagram_checking ? (
                  <span
                    title="Checking Instagram…"
                    className="shrink-0 inline-flex items-center justify-center rounded-full p-0.5 bg-muted text-muted-foreground animate-pulse"
                  >
                    <Instagram className="w-3 h-3" />
                  </span>
                ) : item.instagram_username ? (
                  <a
                    href={`https://instagram.com/${item.instagram_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Instagram @${item.instagram_username}`}
                    className="shrink-0 inline-flex items-center justify-center rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white"
                  >
                    <Instagram className="w-3 h-3" />
                  </a>
                ) : item.instagram_rate_limited ? (
                  <button
                    onClick={onRecheckInstagram}
                    title="Instagram rate-limited — tap to retry"
                    className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  >
                    <Instagram className="w-2.5 h-2.5" /> Limited
                  </button>
                ) : null}
                {onRecheckInstagram && !item.instagram_checking && (item.instagram_username || item.instagram_rate_limited) && (
                  <button
                    onClick={onRecheckInstagram}
                    title="Re-check Instagram"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
                {!item.instagram_checking && item.instagram_verify_status && (
                  <span
                    title={`${item.instagram_verify_reason ?? ""}${item.instagram_checked_at ? ` · ${new Date(item.instagram_checked_at).toLocaleString()}` : ""}`}
                    className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border ${
                      item.instagram_verify_status === "success"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : item.instagram_verify_status === "rate_limited"
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {item.instagram_verify_status === "success" ? "OK" : item.instagram_verify_status === "rate_limited" ? "Limit" : "Fail"}
                  </span>
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
              {item.fetch_status === "pending" && (
                <span title={`Fetching profile (attempt ${item.fetch_attempts ?? 1})`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/30">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Fetching · #{item.fetch_attempts ?? 1}
                </span>
              )}
              {item.fetch_status === "retrying" && (
                <span title={`Retrying — attempt ${item.fetch_attempts ?? 2} of 4`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Retry · {item.fetch_attempts ?? 2}/4
                </span>
              )}
              {item.fetch_status === "rate_limited" && (
                <span title={`Rate limited by Facebook after ${item.fetch_attempts ?? 1} attempt(s) — tap refresh to retry`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/30">
                  <Clock className="w-2.5 h-2.5" /> Limited · {item.fetch_attempts ?? 1}×
                </span>
              )}
              {item.fetch_status === "failed" && (
                <span title={`Failed after ${item.fetch_attempts ?? 1} attempt(s) — tap refresh to retry`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-rose-500/10 text-rose-400 border-rose-500/30">
                  <AlertTriangle className="w-2.5 h-2.5" /> Failed · {item.fetch_attempts ?? 1}×
                </span>
              )}
              {item.fetch_status === "not_found" && (
                <span title={`Profile not found${item.fetch_error ? ` — ${item.fetch_error}` : ""} — auto-retries reduced`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-zinc-500/10 text-zinc-400 border-zinc-500/30">
                  <AlertTriangle className="w-2.5 h-2.5" /> Not found
                </span>
              )}
              {item.fetch_status === "done" && (
                <span title={`Fetched successfully${(item.fetch_attempts ?? 1) > 1 ? ` after ${item.fetch_attempts} attempts` : ""}${item.profile_fetched_at ? ` · ${new Date(item.profile_fetched_at).toLocaleString()}` : ""}`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  <Check className="w-2.5 h-2.5" /> Done{(item.fetch_attempts ?? 1) > 1 ? ` · ${item.fetch_attempts}×` : ""}
                </span>
              )}
            </div>
            {item.password && (
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
      </div>
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
