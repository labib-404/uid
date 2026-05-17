import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FBId } from "@/types/fbid";

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

type ErrKind = "rate_limited" | "not_found" | "network" | "empty";
function classifyError(r?: ProfileResult | null): ErrKind | null {
  if (!r) return "network";
  if (r.error === "rate_limited") return "rate_limited";
  if (r.error === "not_found") return "not_found";
  if (r.error) return "network";
  if (!hasUsefulProfileResult(r)) return "empty";
  return null;
}

// Module-level lock to ensure same UID is not fetched concurrently across calls.
const FETCH_LOCKS = new Set<string>();
const EMPTY_PROGRESS = { done: 0, total: 0, processing: 0, success: 0, failed: 0 };
const PROFILE_BATCH_SIZE = 15;

// Global concurrency gate — keep one lookup request active so imports don't
// overwhelm the browser, the backend function, or Facebook's rate limits.
const MAX_CONCURRENT_BATCHES = 1;
let activeBatches = 0;
const waitQueue: Array<() => void> = [];
async function acquireSlot() {
  if (activeBatches < MAX_CONCURRENT_BATCHES) { activeBatches++; return; }
  await new Promise<void>((res) => waitQueue.push(res));
  activeBatches++;
}
function releaseSlot() {
  activeBatches = Math.max(0, activeBatches - 1);
  const next = waitQueue.shift();
  if (next) next();
}

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
  try { localStorage.setItem(COMPLETE_KEY, JSON.stringify([...COMPLETE_LOCKS])); } catch { /* localStorage may be unavailable */ }
}
export function unlockUid(uid: string) {
  COMPLETE_LOCKS.delete(uid);
  FETCH_LOCKS.delete(uid);
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
  const progressRef = useRef(EMPTY_PROGRESS);
  const [igProgress, setIgProgress] = useState<{
    done: number;
    total: number;
    processing: number;
    success: number;
    failed: number;
  }>(EMPTY_PROGRESS);

  const bumpStart = (n: number) => {
    progressRef.current = {
      ...progressRef.current,
      total: progressRef.current.total + n,
      processing: progressRef.current.processing + n,
    };
    setIgProgress(progressRef.current);
  };
  const bumpEnd = (n: number, ok = 0, fail = 0) => {
    const next = {
      ...progressRef.current,
      done: progressRef.current.done + n,
      processing: Math.max(0, progressRef.current.processing - n),
      success: progressRef.current.success + ok,
      failed: progressRef.current.failed + fail,
    };
    progressRef.current = next.done >= next.total ? EMPTY_PROGRESS : next;
    setIgProgress(progressRef.current);
  };

  const fetchProfiles = useCallback(
    async (uids: string[]) => {
      const requested = Array.from(new Set(uids.map((u) => u.trim()).filter(Boolean)));
      const skipped = requested.filter((u) => FETCH_LOCKS.has(u));
      const lockedComplete = requested.filter((u) => !FETCH_LOCKS.has(u) && COMPLETE_LOCKS.has(u));
      const list = requested
        .filter((u) => !FETCH_LOCKS.has(u) && !COMPLETE_LOCKS.has(u))
        .slice(0, PROFILE_BATCH_SIZE);
      if (!list.length) return;
      list.forEach((u) => FETCH_LOCKS.add(u));
      setLoading(true);
      await acquireSlot();
      const listSet = new Set(list);
      bumpStart(list.length);
      setItems((prev) =>
        prev.map((p) =>
          listSet.has(p.uid)
            ? {
                ...p,
                instagram_checking: true,
                fetch_status: "pending",
                fetch_attempts: 1,
                fetch_last_attempt_at: new Date().toISOString(),
              }
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
        // Smart retry: only re-attempt transient failures (rate-limited / network / empty).
        // Permanent "not_found" responses are NOT retried in-batch — saves time and avoids hammering FB.
        for (let attempt = 2; attempt <= 5; attempt++) {
          const retryable = list.filter((u) => {
            const k = classifyError(results[u]);
            return k === "rate_limited" || k === "network" || k === "empty";
          });
          if (!retryable.length) break;
          const retrySet = new Set(retryable);
          setItems((prev) =>
            prev.map((p) =>
              retrySet.has(p.uid)
                ? { ...p, fetch_status: "retrying", fetch_attempts: attempt }
                : p
            )
          );
          // Longer backoff when rate-limited is in the mix
          const hasRate = retryable.some((u) => classifyError(results[u]) === "rate_limited");
          const base = hasRate ? 2500 : 1200;
          await new Promise((r) => setTimeout(r, base * Math.pow(1.8, attempt - 2)));
          try {
            const retry = await supabase.functions.invoke("fb-profile-lookup", {
              body: { uids: retryable, force: true },
            });
            if (!retry.error) {
              const retryResults = (retry.data?.results ?? {}) as Record<string, ProfileResult>;
              results = { ...results, ...retryResults };
            }
          } catch { /* keep retrying */ }
        }
        setItems((prev) => {
          const nowIso = new Date().toISOString();
          return prev.map((p) => {
            const r = results[p.uid];
            if (!r) {
              return listSet.has(p.uid)
                ? { ...p, instagram_checking: false, fetch_status: "failed", fetch_error: "no response", fetch_last_attempt_at: nowIso }
                : p;
            }
            if (r.error || !hasUsefulProfileResult(r)) {
              failCount++;
              const kind = classifyError(r);
              const status: FBId["fetch_status"] =
                kind === "rate_limited" ? "rate_limited" : kind === "not_found" ? "not_found" : "failed";
              return {
                ...p,
                instagram_checking: false,
                fetch_status: status,
                fetch_error: r.error ?? "empty result",
                fetch_last_attempt_at: nowIso,
              };
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
              fetch_error: null,
              fetch_last_attempt_at: nowIso,
            };
          });
        });
        // Persist completion lock for any UID that now has all 4 core fields.
        for (const p of list) {
          const r = results[p];
          if (!r || r.error || !hasUsefulProfileResult(r)) continue;
          if (r.name && r.username && r.photoUrl && r.followerCount) {
            COMPLETE_LOCKS.add(p);
          }
        }
        persistCompletes();
      } catch {
        setItems((prev) =>
          prev.map((p) => (listSet.has(p.uid) ? { ...p, instagram_checking: false, fetch_status: "failed" } : p))
        );
        bumpEnd(list.length, 0, list.length);
        list.forEach((u) => FETCH_LOCKS.delete(u));
        setLoading(false);
        releaseSlot();
        return;
      list.forEach((u) => FETCH_LOCKS.delete(u));
      bumpEnd(list.length, okCount, failCount);
      setLoading(false);
      releaseSlot();
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
        bumpEnd(list.length, okCount, failCount);
        return;
      } catch {
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
