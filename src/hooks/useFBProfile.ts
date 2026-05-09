import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FBId } from "@/types/fbid";
import { toast } from "sonner";

type ProfileResult = {
  name?: string | null;
  username?: string | null;
  userId?: string | null;
  followerCount?: string | null;
  friendCount?: string | null;
  nationality?: string | null;
  photoUrl?: string | null;
  instagramUsername?: string | null;
  instagramRateLimited?: boolean;
  error?: string;
};

// Module-level lock to ensure same UID is not fetched concurrently across calls.
const FETCH_LOCKS = new Set<string>();

// Per-UID completion lock — once a profile has all core fields, skip re-fetch.
// Persisted across the session in localStorage so it survives reloads.
const COMPLETE_KEY = "fb_complete_uids_v1";
const COMPLETE_LOCKS: Set<string> = (() => {
  try {
    const raw = localStorage.getItem(COMPLETE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
})();
function persistCompletes() {
  try { localStorage.setItem(COMPLETE_KEY, JSON.stringify([...COMPLETE_LOCKS])); } catch {}
}
export function unlockUid(uid: string) {
  COMPLETE_LOCKS.delete(uid);
  persistCompletes();
}
export function lockUidsComplete(uids: string[]) {
  let changed = false;
  for (const u of uids) {
    if (u && !COMPLETE_LOCKS.has(u)) { COMPLETE_LOCKS.add(u); changed = true; }
  }
  if (changed) persistCompletes();
}

function hasUsefulProfileResult(result?: ProfileResult | null) {
  if (!result || result.error) return false;
  return Boolean(
    result.name?.trim() ||
      result.username?.trim() ||
      result.followerCount ||
      result.friendCount ||
      result.nationality ||
      result.instagramUsername
  );
}

export function useFBProfile(setItems: (u: (prev: FBId[]) => FBId[]) => void) {
  const [loading, setLoading] = useState(false);
  const [igProgress, setIgProgress] = useState<{
    done: number;
    total: number;
    processing: number;
    success: number;
    failed: number;
  }>({ done: 0, total: 0, processing: 0, success: 0, failed: 0 });

  const bumpStart = (n: number) =>
    setIgProgress((p) => ({ ...p, total: p.total + n, processing: p.processing + n }));
  const bumpEnd = (n: number, ok = 0, fail = 0) =>
    setIgProgress((p) => {
      const next = {
        ...p,
        done: p.done + n,
        processing: Math.max(0, p.processing - n),
        success: p.success + ok,
        failed: p.failed + fail,
      };
      return next.done >= next.total
        ? { done: 0, total: 0, processing: 0, success: 0, failed: 0 }
        : next;
    });

  const fetchProfiles = useCallback(
    async (uids: string[]) => {
      const requested = Array.from(new Set(uids.map((u) => u.trim()).filter(Boolean)));
      const skipped = requested.filter((u) => FETCH_LOCKS.has(u));
      const lockedComplete = requested.filter((u) => !FETCH_LOCKS.has(u) && COMPLETE_LOCKS.has(u));
      const list = requested
        .filter((u) => !FETCH_LOCKS.has(u) && !COMPLETE_LOCKS.has(u))
        .slice(0, 50);
      if (skipped.length) toast.message(`${skipped.length} already fetching — skipped`);
      if (lockedComplete.length) toast.message(`${lockedComplete.length} already complete — locked`);
      if (!list.length) return;
      list.forEach((u) => FETCH_LOCKS.add(u));
      setLoading(true);
      const listSet = new Set(list);
      bumpStart(list.length);
      setItems((prev) =>
        prev.map((p) =>
          listSet.has(p.uid)
            ? { ...p, instagram_checking: true, fetch_status: "pending", fetch_attempts: 1 }
            : p
        )
      );
      const runOnce = async (force = false) => {
        const { data, error } = await supabase.functions.invoke("fb-profile-lookup", {
          body: { uids: list, force },
        });
        if (error) throw error;
        return (data?.results ?? {}) as Record<string, ProfileResult>;
      };
      let okCount = 0;
      let failCount = 0;
      try {
        let results = await runOnce(false);
        // Auto-retry UIDs that failed (including rate-limited) — up to 3 retries with backoff
        for (let attempt = 2; attempt <= 4; attempt++) {
          const failedUids = list.filter((u) => !hasUsefulProfileResult(results[u]));
          if (!failedUids.length) break;
          setItems((prev) =>
            prev.map((p) =>
              failedUids.includes(p.uid)
                ? { ...p, fetch_status: "retrying", fetch_attempts: attempt }
                : p
            )
          );
          await new Promise((r) => setTimeout(r, 1200 * Math.pow(1.7, attempt - 2)));
          try {
            const retry = await supabase.functions.invoke("fb-profile-lookup", {
              body: { uids: failedUids, force: true },
            });
            if (!retry.error) {
              const retryResults = (retry.data?.results ?? {}) as Record<string, ProfileResult>;
              results = { ...results, ...retryResults };
            }
          } catch { /* keep retrying */ }
        }
        setItems((prev) =>
          prev.map((p) => {
            const r = results[p.uid];
            if (!r) return listSet.has(p.uid) ? { ...p, instagram_checking: false, fetch_status: "failed" } : p;
            if (r.error || !hasUsefulProfileResult(r)) {
              failCount++;
              return { ...p, instagram_checking: false, fetch_status: r.error === "rate_limited" ? "rate_limited" : "failed" };
            }
            okCount++;
            return {
              ...p,
              real_name: r.name ?? p.real_name ?? null,
              username: r.username ?? p.username ?? null,
              photo_url: r.photoUrl || p.photo_url || null,
              follower_count: r.followerCount ?? p.follower_count ?? null,
              friend_count: r.friendCount ?? p.friend_count ?? null,
              nationality: r.nationality ?? p.nationality ?? null,
              instagram_username: r.instagramUsername ?? null,
              instagram_rate_limited: !!r.instagramRateLimited,
              instagram_checked_at: new Date().toISOString(),
              instagram_checking: false,
              profile_fetched_at: new Date().toISOString(),
              fetch_status: "done",
            };
          })
        );
        // Persist completion lock for any UID that now has all 4 core fields.
        for (const p of list) {
          const r = results[p];
          if (!r || r.error || !hasUsefulProfileResult(r)) continue;
          if (r.name && r.username && r.photoUrl && r.followerCount) {
            COMPLETE_LOCKS.add(p);
          }
        }
        persistCompletes();
        if (okCount) toast.success(`Fetched ${okCount} profile${okCount > 1 ? "s" : ""}`);
        if (failCount) toast.error(`${failCount} not found / rate limited`);
      } catch (e: any) {
        toast.error(e?.message ?? "Fetch failed");
        setItems((prev) =>
          prev.map((p) => (listSet.has(p.uid) ? { ...p, instagram_checking: false, fetch_status: "failed" } : p))
        );
        bumpEnd(list.length, 0, list.length);
        list.forEach((u) => FETCH_LOCKS.delete(u));
        setLoading(false);
        return;
      } finally {
      }
      list.forEach((u) => FETCH_LOCKS.delete(u));
      bumpEnd(list.length, okCount, failCount);
      setLoading(false);
    },
    [setItems]
  );

  const recheckInstagram = useCallback(
    async (
      items: { uid: string; username?: string | null; instagram_username?: string | null }[],
      force = true
    ) => {
      const list = items.slice(0, 20);
      if (!list.length) return;
      const listSet = new Set(list.map((i) => i.uid));
      const igCandidates: Record<string, string[]> = {};
      for (const it of list) {
        igCandidates[it.uid] = [it.instagram_username, it.username].filter((v): v is string => !!v);
      }
      bumpStart(list.length);
      setItems((prev) => prev.map((p) => (listSet.has(p.uid) ? { ...p, instagram_checking: true } : p)));
      try {
        const { data, error } = await supabase.functions.invoke("fb-profile-lookup", {
          body: { uids: list.map((i) => i.uid), igOnly: true, igCandidates, force },
        });
        if (error) throw error;
        const results = (data?.results ?? {}) as Record<string, ProfileResult>;
        let rateCount = 0;
        let okCount = 0;
        let failCount = 0;
        setItems((prev) =>
          prev.map((p) => {
            const r = results[p.uid];
            if (!r) return listSet.has(p.uid) ? { ...p, instagram_checking: false } : p;
            let status: "success" | "failed" | "rate_limited";
            let reason: string;
            if (r.instagramRateLimited) {
              status = "rate_limited";
              reason = "Instagram rate-limited";
              rateCount++;
              failCount++;
            } else if (r.instagramUsername) {
              status = "success";
              reason = `Verified @${r.instagramUsername}`;
              okCount++;
            } else {
              status = "failed";
              reason = r.error ? `Error: ${r.error}` : "No matching Instagram account";
              failCount++;
            }
            return {
              ...p,
              instagram_username: r.instagramUsername ?? null,
              instagram_rate_limited: !!r.instagramRateLimited,
              instagram_checked_at: new Date().toISOString(),
              instagram_checking: false,
              instagram_verify_status: status,
              instagram_verify_reason: reason,
            };
          })
        );
        if (okCount) toast.success(`IG verified: ${okCount}`);
        if (rateCount) toast.error(`Instagram rate-limited on ${rateCount}`);
        else if (failCount) toast.error(`IG failed: ${failCount}`);
        bumpEnd(list.length, okCount, failCount);
        return;
      } catch (e: any) {
        toast.error(e?.message ?? "Re-check failed");
        setItems((prev) => prev.map((p) => (listSet.has(p.uid) ? { ...p, instagram_checking: false } : p)));
        bumpEnd(list.length, 0, list.length);
        return;
      } finally {
        // counts handled in try/catch
      }
    },
    [setItems]
  );

  return { fetchProfiles, recheckInstagram, loading, igProgress };
}
