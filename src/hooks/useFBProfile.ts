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
  error?: string;
};

export function useFBProfile(setItems: (u: (prev: FBId[]) => FBId[]) => void) {
  const [loading, setLoading] = useState(false);

  const fetchProfiles = useCallback(
    async (uids: string[]) => {
      const list = Array.from(new Set(uids.map((u) => u.trim()).filter(Boolean))).slice(0, 20);
      if (!list.length) return;
      setLoading(true);
      const listSet = new Set(list);
      // Mark items as IG-checking so the card can show a loading state
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
              // Trust the server's verification result (null means not on IG)
              instagram_username: r.instagramUsername ?? null,
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
        setLoading(false);
      }
    },
    [setItems]
  );

  return { fetchProfiles, loading };
}