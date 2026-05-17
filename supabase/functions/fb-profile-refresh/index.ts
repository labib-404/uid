import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Refreshes facebook_ids rows whose profile_fetched_at is missing or older than STALE_AFTER.
// Designed to be invoked by pg_cron on a schedule. Processes a small batch per run.
const STALE_AFTER_HOURS = 11; // refresh just before 12h cache TTL elapses
const BATCH_SIZE = 15;
type LookupResult = {
  name?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  followerCount?: string | null;
  friendCount?: string | null;
  nationality?: string | null;
  instagramUsername?: string | null;
  error?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require shared cron secret — this function reads ALL users' rows via service role
    const expected = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (!expected || provided !== expected) {
      return json({ error: "Forbidden" }, 403);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600 * 1000).toISOString();

    // Pick stale rows: never fetched, or fetched before cutoff. Oldest first.
    const { data: rows, error } = await admin
      .from("facebook_ids")
      .select("id, uid, profile_fetched_at")
      .or(`profile_fetched_at.is.null,profile_fetched_at.lt.${cutoff}`)
      .order("profile_fetched_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (error) throw error;
    const list = rows ?? [];
    if (list.length === 0) {
      return json({ refreshed: 0, message: "no stale rows" });
    }

    const uids = list.map((r) => r.uid);

    // Reuse the existing lookup function (force=true bypasses in-memory cache)
    const lookupRes = await fetch(`${SUPABASE_URL}/functions/v1/fb-profile-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ uids, force: true }),
    });
    if (!lookupRes.ok) {
      const t = await lookupRes.text();
      throw new Error(`lookup failed: ${lookupRes.status} ${t}`);
    }
    const { results = {} } = (await lookupRes.json()) as {
      results: Record<string, LookupResult>;
    };

    let updated = 0;
    const now = new Date().toISOString();
    await Promise.all(
      list.map(async (row) => {
        const r = results[row.uid];
        if (!r || r.error) return;
        const patch: Record<string, string | null> = { profile_fetched_at: now };
        if (r.name != null) patch.real_name = r.name;
        if (r.username != null) patch.username = r.username;
        if (r.photoUrl != null) patch.photo_url = r.photoUrl;
        if (r.followerCount != null) patch.follower_count = r.followerCount;
        if (r.friendCount != null) patch.friend_count = r.friendCount;
        if (r.nationality != null) patch.nationality = r.nationality;
        patch.instagram_username = r.instagramUsername ?? null;
        const { error: upErr } = await admin
          .from("facebook_ids")
          .update(patch)
          .eq("id", row.id);
        if (!upErr) updated++;
      })
    );

    return json({ refreshed: updated, scanned: list.length });
  } catch (e) {
    console.error("fb-profile-refresh error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}