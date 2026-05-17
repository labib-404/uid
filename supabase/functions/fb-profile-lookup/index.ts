const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FB_HEADERS: Record<string, string> = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "cache-control": "no-cache",
};

function formatFollowers(raw: string): string {
  const n = parseInt(raw.replace(/,/g, ""), 10);
  if (isNaN(n)) return raw;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

const MOBILE_HEADERS: Record<string, string> = {
  ...FB_HEADERS,
  "user-agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
};

async function tryFetch(
  url: string,
  headers: Record<string, string> = FB_HEADERS,
  attempts = 2,
): Promise<{ html: string | null; rateLimited: boolean }> {
  let rateLimited = false;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(9000),
      });
      if (res.status === 429) { rateLimited = true; }
      else if (res.ok) {
        const text = await res.text();
        if (text.length >= 500) return { html: text, rateLimited: false };
      }
    } catch { /* retry */ }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 350));
  }
  return { html: null, rateLimited };
}

async function fetchFb(uid: string) {
  const isNumeric = /^\d+$/.test(uid);
  const urls: { url: string; headers: Record<string, string> }[] = isNumeric
    ? [
        { url: `https://www.facebook.com/profile.php?id=${uid}`, headers: FB_HEADERS },
        { url: `https://m.facebook.com/profile.php?id=${uid}`, headers: MOBILE_HEADERS },
        { url: `https://www.facebook.com/${uid}`, headers: FB_HEADERS },
        { url: `https://mbasic.facebook.com/profile.php?id=${uid}`, headers: MOBILE_HEADERS },
      ]
    : [
        { url: `https://www.facebook.com/${uid}`, headers: FB_HEADERS },
        { url: `https://m.facebook.com/${uid}`, headers: MOBILE_HEADERS },
        { url: `https://www.facebook.com/profile.php?id=${uid}`, headers: FB_HEADERS },
        { url: `https://mbasic.facebook.com/${uid}`, headers: MOBILE_HEADERS },
      ];
  let anyRate = false;
  let anyNotFound = false;
  for (const { url, headers } of urls) {
    const r = await tryFetch(url, headers, 2);
    if (r.html) {
      // Detect FB's "page not found" / "content unavailable" interstitials inline.
      if (
        /This (?:page|content) isn['']?t available/i.test(r.html) ||
        /Sorry, this page isn['']?t available/i.test(r.html) ||
        /The link you followed may be broken/i.test(r.html)
      ) {
        anyNotFound = true;
        continue;
      }
      return { html: r.html, rateLimited: false, notFound: false };
    }
    if (r.rateLimited) anyRate = true;
  }
  return { html: null as string | null, rateLimited: anyRate, notFound: anyNotFound && !anyRate };
}

function meta(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  if (m) return decodeEntities(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`,
    "i"
  );
  const m2 = html.match(re2);
  return m2 ? decodeEntities(m2[1]) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function parseProfile(html: string, uid: string) {
  const rawName = meta(html, "og:title");
  const name = rawName
    ? rawName.replace(/\s*[|\-–—]\s*(?:Facebook|FB).*$/i, "").trim() || null
    : null;

  const ogUrl = meta(html, "og:url") ?? "";
  let username: string | null = null;
  const um = ogUrl.match(/facebook\.com\/([^/?]+)/);
  if (um && um[1] !== "profile.php" && um[1] !== "people") username = um[1];
  // Handle /people/Name/<id> URLs — extract the slug after /people/
  if (!username) {
    const pm = ogUrl.match(/facebook\.com\/people\/([^/?]+)/);
    if (pm) username = decodeURIComponent(pm[1]).replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 30) || null;
  }

  let userId = uid;
  const androidUrl = meta(html, "al:android:url") ?? "";
  const aim = androidUrl.match(/profile\/(\d+)/);
  if (aim) userId = aim[1];
  else {
    const im = ogUrl.match(/[?&]id=(\d+)/);
    if (im) userId = im[1];
  }

  let followerCount: string | null = null;
  const desc = meta(html, "og:description") ?? "";
  const fm = desc.match(/([\d,]+)\s*(?:followers|likes)/i);
  if (fm) followerCount = formatFollowers(fm[1]);
  if (!followerCount) {
    // body-text / JSON fallback
    const bm = html.match(/>([\d,]+)\s*(?:followers|likes)</i)
      || html.match(/"follower_count"\s*:\s*(\d+)/)
      || html.match(/"subscribers_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
    if (bm) followerCount = formatFollowers(bm[1]);
  }

  // Friends count — try og:description first, then JSON keys, then body
  let friendCount: string | null = null;
  const fdm = desc.match(/([\d,]+)\s*friends/i);
  if (fdm) friendCount = formatFollowers(fdm[1]);
  if (!friendCount) {
    const fjm = html.match(/"friend_count"\s*:\s*(\d+)/)
      || html.match(/"friends_count"\s*:\s*(\d+)/)
      || html.match(/"friends"\s*:\s*\{\s*"count"\s*:\s*(\d+)/)
      || html.match(/>([\d,]+)\s*friends</i);
    if (fjm) friendCount = formatFollowers(fjm[1]);
  }

  let nationality: string | null = null;
  for (const p of [
    /"location":\s*\{[^}]*"name":\s*"([^"]+)"/,
    /"hometown":\s*\{[^}]*"name":\s*"([^"]+)"/,
    /Lives in ([^<"]+)/i,
    /From ([^<"]+)/i,
  ]) {
    const m = html.match(p);
    if (m) {
      nationality = m[1].trim();
      break;
    }
  }

  let photoUrl: string | null = null;
  const ogImage = meta(html, "og:image");
  if (ogImage && /^https?:\/\//.test(ogImage)) photoUrl = ogImage;
  // Fallback to graph endpoint only if og:image is missing
  if (!photoUrl && /^\d+$/.test(userId)) {
    photoUrl = `https://graph.facebook.com/${userId}/picture?type=large&width=200&height=200`;
  }

  let instagramUsername: string | null = null;
  const IG_BL = new Set([
    "p","reel","reels","tv","stories","explore","accounts","sharedfiles","web","login","signup","direct","ar","lite","challenge","graphql","static","legal","about","privacy","help","api","oauth","embed",
  ]);
  const validIg = (raw: string): string | null => {
    const c = raw.replace(/\/$/, "").trim();
    if (!c || c.length < 2 || c.length > 30) return null;
    if (IG_BL.has(c.toLowerCase())) return null;
    if (!/^[a-zA-Z0-9_.]+$/.test(c)) return null;
    return c;
  };
  const igStrategies: RegExp[] = [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]{1,30})\/?(?:["'?#\s\\]|$)/gi,
    /instagram\.com\\\/([a-zA-Z0-9_.]{1,30})(?:\\\/|["'\s]|$)/g,
    /"linked_social_username"\s*:\s*"([a-zA-Z0-9_.]{2,30})"/g,
    /"instagram"\s*:\s*"([a-zA-Z0-9_.]{2,30})"/g,
    /"INSTAGRAM"[^}]{0,120}"username"\s*:\s*"([a-zA-Z0-9_.]{2,30})"/g,
    /"username"\s*:\s*"([a-zA-Z0-9_.]{2,30})"[^}]{0,120}"INSTAGRAM"/g,
    /instagram\.com(?:%2F|\/)([a-zA-Z0-9_.]{1,30})(?:%2F|\/|&|"|'|\s|\\|$)/gi,
    /"url"\s*:\s*"https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]{1,30})(?:\/|"|$)/g,
    /instagram[^<"]{0,80}@([a-zA-Z0-9_.]{2,30})/gi,
  ];
  outer: for (const re of igStrategies) {
    for (const m of html.matchAll(re)) {
      const v = validIg(m[1]);
      if (v) { instagramUsername = v; break outer; }
    }
  }

  return { name, username, userId, followerCount, friendCount, nationality, photoUrl, instagramUsername };
}

async function fetchPhotoAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": FB_HEADERS["user-agent"], accept: "image/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 200 || buf.length > 600_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:${ct};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const IG_HEADERS: Record<string, string> = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
};

const IG_RESERVED = new Set([
  "p","reel","reels","tv","stories","explore","accounts","web","login","signup","direct","ar","lite","challenge","graphql","static","legal","about","privacy","help","api","oauth","embed","developer","press","jobs","blog","fragment","people","profile","pages","groups","watch","marketplace","gaming","events",
]);

type IgCheck = { exists: boolean; rateLimited?: boolean };

const IG_TTL = 1000 * 60 * 60 * 12; // 12h
const IG_CACHE = new Map<string, { exists: boolean; at: number; canonical?: string }>();
const IG_INFLIGHT = new Map<string, Promise<IgCheck>>();

// FB profile cache — stores parsed identifiers + raw meta snapshot for fast rechecks
const FB_TTL = 1000 * 60 * 60 * 12; // 12h
type FbCacheEntry = {
  at: number;
  parsed: ReturnType<typeof parseProfile>;
  metaRaw: { ogTitle: string | null; ogUrl: string | null; ogImage: string | null; ogDescription: string | null; alAndroid: string | null };
  photoDataUrl?: string | null;
};
const FB_CACHE = new Map<string, FbCacheEntry>();
const FB_INFLIGHT = new Map<string, Promise<FbCacheEntry | null>>();

function hasUsefulProfile(entry: FbCacheEntry | null): entry is FbCacheEntry {
  if (!entry) return false;
  return true;
}

function extractMetaRaw(html: string) {
  return {
    ogTitle: meta(html, "og:title"),
    ogUrl: meta(html, "og:url"),
    ogImage: meta(html, "og:image"),
    ogDescription: meta(html, "og:description"),
    alAndroid: meta(html, "al:android:url"),
  };
}

async function getFbProfile(uid: string, force = false): Promise<{ entry: FbCacheEntry | null; rateLimited: boolean; notFound: boolean }> {
  const key = uid.toLowerCase();
  const now = Date.now();
  if (!force) {
    const cached = FB_CACHE.get(key);
    if (cached && now - cached.at < FB_TTL) return { entry: cached, rateLimited: false, notFound: false };
  }
  const inflight = FB_INFLIGHT.get(key);
  if (inflight) {
    const entry = await inflight;
    return { entry, rateLimited: false, notFound: false };
  }
  let rateLimited = false;
  let notFound = false;
  const p: Promise<FbCacheEntry | null> = (async () => {
    const { html, rateLimited: rl, notFound: nf } = await fetchFb(uid);
    if (rl) { rateLimited = true; return null; }
    if (nf) { notFound = true; return null; }
    if (!html) return null;
    const parsed = parseProfile(html, uid);
    const metaRaw = extractMetaRaw(html);
    const entryWithoutPhoto: FbCacheEntry = { at: Date.now(), parsed, metaRaw, photoDataUrl: null };
    if (!hasUsefulProfile(entryWithoutPhoto)) return null;
    let photoDataUrl: string | null = null;
    if (parsed.photoUrl) {
      photoDataUrl = await fetchPhotoAsDataUrl(parsed.photoUrl);
    }
    const entry: FbCacheEntry = { at: Date.now(), parsed, metaRaw, photoDataUrl };
    FB_CACHE.set(key, entry);
    return entry;
  })();
  FB_INFLIGHT.set(key, p);
  try {
    const entry = await p;
    return { entry, rateLimited, notFound };
  } finally {
    FB_INFLIGHT.delete(key);
  }
}

async function checkInstagramExists(username: string, force = false): Promise<IgCheck> {
  const u = username.trim().replace(/^@/, "");
  if (!u || !/^[a-zA-Z0-9_.]{2,30}$/.test(u)) return { exists: false };
  if (IG_RESERVED.has(u.toLowerCase())) return { exists: false };
  const key = u.toLowerCase();
  const now = Date.now();
  if (!force) {
    const cached = IG_CACHE.get(key);
    if (cached && now - cached.at < IG_TTL) return { exists: cached.exists };
  }
  const inflight = IG_INFLIGHT.get(key);
  if (inflight) return inflight;
  const p: Promise<IgCheck> = (async () => {
   try {
    const res = await fetch(`https://www.instagram.com/${u}/`, {
      headers: IG_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(7000),
    });
    if (res.status === 429) return { exists: false, rateLimited: true };
    if (res.status === 200) {
      const text = await res.text();
      if (/"username":\s*"/.test(text) || /<meta property="og:title"/i.test(text)) {
        if (/Sorry, this page isn't available/i.test(text)) return { exists: false };
        return { exists: true };
      }
      return { exists: false };
    }
    if (res.status === 302 || res.status === 301) {
      const loc = res.headers.get("location") || "";
      if (loc.includes("/accounts/login")) return { exists: true };
      return { exists: false };
    }
    return { exists: false };
   } catch {
     return { exists: false };
   }
  })();
  IG_INFLIGHT.set(key, p);
  try {
    const r = await p;
    if (!r.rateLimited) IG_CACHE.set(key, { exists: r.exists, at: Date.now(), canonical: u });
    return r;
  } finally {
    IG_INFLIGHT.delete(key);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as {
      uids: string[];
      igOnly?: boolean;
      igCandidates?: Record<string, string[]>;
      force?: boolean;
    };
    const { uids, igOnly, igCandidates, force } = body;
    if (!Array.isArray(uids) || uids.length === 0 || uids.length > 50) {
      return new Response(JSON.stringify({ error: "Provide 1-50 uids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, any> = {};
    // Limit concurrency aggressively to avoid partial fetches and rate-limits.
    const CONCURRENCY = 3;
    const queue = [...uids];
    const workers: Promise<void>[] = [];
    const processOne = async (uid: string) => {
        const cleanUid = String(uid).trim();
        if (!cleanUid) return;
        if (igOnly) {
          const cands = (igCandidates?.[cleanUid] ?? []).filter(
            (v) => !!v && /^[a-zA-Z0-9_.]{2,30}$/.test(v)
          );
          let verified: string | null = null;
          let rate = false;
          for (const c of cands) {
            const r = await checkInstagramExists(c, !!force);
            if (r.rateLimited) { rate = true; break; }
            if (r.exists) { verified = c; break; }
          }
          results[cleanUid] = { instagramUsername: verified, instagramRateLimited: rate };
          return;
        }
        const { entry, rateLimited, notFound } = await getFbProfile(cleanUid, !!force);
        if (rateLimited) {
          results[cleanUid] = { error: "rate_limited" };
          return;
        }
        if (notFound) {
          results[cleanUid] = { error: "not_found" };
          return;
        }
        if (!entry) {
          results[cleanUid] = { error: "no_data" };
          return;
        }
        const data = { ...entry.parsed };
        if (entry.photoDataUrl) data.photoUrl = entry.photoDataUrl;
        // Verify Instagram presence using candidates: parsed IG username, then FB username
        const candidates = [data.instagramUsername, data.username].filter(
          (v): v is string => !!v && /^[a-zA-Z0-9_.]{2,30}$/.test(v)
        );
        let verifiedIg: string | null = null;
        let igRate = false;
        for (const c of candidates) {
          const r = await checkInstagramExists(c, !!force);
          if (r.rateLimited) { igRate = true; break; }
          if (r.exists) { verifiedIg = c; break; }
        }
        data.instagramUsername = verifiedIg;
        results[cleanUid] = { ...data, instagramRateLimited: igRate };
    };
    const worker = async () => {
      while (queue.length) {
        const u = queue.shift();
        if (u === undefined) break;
        await processOne(u);
      }
    };
    for (let i = 0; i < Math.min(CONCURRENCY, uids.length); i++) workers.push(worker());
    await Promise.all(workers);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fb-profile-lookup error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});