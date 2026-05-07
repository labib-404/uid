import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FBId } from "@/types/fbid";
import { toast } from "sonner";

type ProfileResult = {
  name?: string | null;
  username?: string | null;
  userId?: string | null;
  followerCount?: string | null;
  nationality?: string | null;
  photoUrl?: string | null;
  instagramUsername?: string | null;
  instagramRateLimited?: boolean;
  error?: string;
};

export function useFBProfile(setItems: (u: (prev: FBId[]) => FBId[]) => void) {
  const [loading, setLoading] = useState(false);
  const [igProgress, setIgProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const bumpStart = (n: number) =>
    setIgProgress((p) => ({ done: p.done, total: p.total + n }));
  const bumpEnd = (n: number) =>
    setIgProgress((p) => {
      const next = { done: p.done + n, total: p.total };
      return next.done >= next.total ? { done: 0, total: 0 } : next;
    });

  const fetchProfiles = useCallback(
    async (uids: string[]) => {
      const list = Array.from(new Set(uids.map((u) => u.trim()).filter(Boolean))).slice(0, 20);
      if (!list.length) return;
      setLoading(true);
      const listSet = new Set(list);
      bumpStart(list.length);
      setItems((prev) => prev.map((p) => (listSet.has(p.uid) ? { ...p, instagram_checking: true } : p)));
      try {
        const { data, error } = await supabase.functions.invoke("fb-profile-lookup", {
          body: { uids: list },
        });
        if (error) throw error;
        const results = (data?.results ?? {}) as Record<string, ProfileResult>;
        let okCount = 0;
        let failCount = 0;
        setItems((prev) =>
          prev.map((p) => {
            const r = results[p.uid];
            if (!r) return listSet.has(p.uid) ? { ...p, instagram_checking: false } : p;
            if (r.error) { failCount++; return { ...p, instagram_checking: false }; }
            okCount++;
            return {
              ...p,
              real_name: r.name ?? p.real_name ?? null,
              username: r.username ?? p.username ?? null,
              photo_url: r.photoUrl || p.photo_url || null,
              follower_count: r.followerCount ?? p.follower_count ?? null,
              nationality: r.nationality ?? p.nationality ?? null,
              instagram_username: r.instagramUsername ?? null,
              instagram_rate_limited: !!r.instagramRateLimited,
              instagram_checked_at: new Date().toISOString(),
              instagram_checking: false,
              profile_fetched_at: new Date().toISOString(),
            };
          })
        );
        if (okCount) toast.success(`Fetched ${okCount} profile${okCount > 1 ? "s" : ""}`);
        if (failCount) toast.error(`${failCount} not found / rate limited`);
      } catch (e: any) {
        toast.error(e?.message ?? "Fetch failed");
        setItems((prev) => prev.map((p) => (listSet.has(p.uid) ? { ...p, instagram_checking: false } : p)));
      } finally {
        bumpEnd(list.length);
        setLoading(false);
      }
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
        setItems((prev) =>
          prev.map((p) => {
            const r = results[p.uid];
            if (!r) return listSet.has(p.uid) ? { ...p, instagram_checking: false } : p;
            if (r.instagramRateLimited) rateCount++;
            return {
              ...p,
              instagram_username: r.instagramUsername ?? null,
              instagram_rate_limited: !!r.instagramRateLimited,
              instagram_checked_at: new Date().toISOString(),
              instagram_checking: false,
            };
          })
        );
        if (rateCount) toast.error(`Instagram rate-limited on ${rateCount}`);
      } catch (e: any) {
        toast.error(e?.message ?? "Re-check failed");
        setItems((prev) => prev.map((p) => (listSet.has(p.uid) ? { ...p, instagram_checking: false } : p)));
      } finally {
        bumpEnd(list.length);
      }
    },
    [setItems]
  );

  return { fetchProfiles, recheckInstagram, loading, igProgress };
}
