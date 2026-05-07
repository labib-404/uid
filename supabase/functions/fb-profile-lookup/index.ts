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

async function tryFetch(url: string): Promise<{ html: string | null; rateLimited: boolean }> {
  try {
    const res = await fetch(url, {
      headers: FB_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
    });
    if (res.status === 429) return { html: null, rateLimited: true };
    if (!res.ok) return { html: null, rateLimited: false };
    const text = await res.text();
    if (text.length < 500) return { html: null, rateLimited: false };
    return { html: text, rateLimited: false };
  } catch {
    return { html: null, rateLimited: false };
  }
}

async function fetchFb(uid: string) {
  const isNumeric = /^\d+$/.test(uid);
  const a = isNumeric
    ? `https://www.facebook.com/profile.php?id=${uid}`
    : `https://www.facebook.com/${uid}`;
  const r1 = await tryFetch(a);
  if (r1.html) return r1;
  if (r1.rateLimited) return r1;
  const b = isNumeric
    ? `https://www.facebook.com/${uid}`
    : `https://www.facebook.com/profile.php?id=${uid}`;
  return await tryFetch(b);
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
  if (um && um[1] !== "profile.php") username = um[1];

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
  const igPatterns = [
    /instagram\.com\\?\/([a-zA-Z0-9_.]{2,30})/,
    /"linked_social_username"\s*:\s*"([a-zA-Z0-9_.]{2,30})"/,
  ];
  const IG_BL = new Set([
    "p","reel","reels","tv","stories","explore","accounts","web","login","signup","direct","ar","lite","challenge","graphql","static","legal","about","privacy","help","api","oauth","embed",
  ]);
  for (const p of igPatterns) {
    const m = html.match(p);
    if (m) {
      const v = m[1];
      if (!IG_BL.has(v.toLowerCase()) && /^[a-zA-Z0-9_.]+$/.test(v)) {
        instagramUsername = v;
        break;
      }
    }
  }

  return { name, username, userId, followerCount, nationality, photoUrl, instagramUsername };
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
  "p","reel","reels","tv","stories","explore","accounts","web","login","signup","direct","ar","lite","challenge","graphql","static","legal","about","privacy","help","api","oauth","embed","developer","press","jobs","blog","fragment",
]);

async function checkInstagramExists(username: string): Promise<boolean> {
  const u = username.trim().replace(/^@/, "");
  if (!u || !/^[a-zA-Z0-9_.]{2,30}$/.test(u)) return false;
  if (IG_RESERVED.has(u.toLowerCase())) return false;
  const key = u.toLowerCase();
  const now = Date.now();
  const cached = IG_CACHE.get(key);
  if (cached && now - cached.at < IG_TTL) return cached.exists;
  const inflight = IG_INFLIGHT.get(key);
  if (inflight) return inflight;
  const p = (async () => {
   try {
    const res = await fetch(`https://www.instagram.com/${u}/`, {
      headers: IG_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(7000),
    });
    if (res.status === 200) {
      const text = await res.text();
      // IG returns 200 even for missing users sometimes; check markers
      if (/"username":\s*"/.test(text) || /<meta property="og:title"/i.test(text)) {
        if (/Sorry, this page isn't available/i.test(text)) return false;
        return true;
      }
      return false;
    }
    if (res.status === 302 || res.status === 301) {
      const loc = res.headers.get("location") || "";
      // redirects to /accounts/login means exists (gated)
      if (loc.includes("/accounts/login")) return true;
      return false;
    }
    return false;
   } catch {
     return false;
   }
  })();
  IG_INFLIGHT.set(key, p);
  try {
    const exists = await p;
    IG_CACHE.set(key, { exists, at: Date.now() });
    return exists;
  } finally {
    IG_INFLIGHT.delete(key);
  }
}

const IG_TTL = 1000 * 60 * 60 * 12; // 12h
const IG_CACHE = new Map<string, { exists: boolean; at: number }>();
const IG_INFLIGHT = new Map<string, Promise<boolean>>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { uids } = (await req.json()) as { uids: string[] };
    if (!Array.isArray(uids) || uids.length === 0 || uids.length > 20) {
      return new Response(JSON.stringify({ error: "Provide 1-20 uids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, any> = {};
    await Promise.all(
      uids.map(async (uid) => {
        const cleanUid = String(uid).trim();
        if (!cleanUid) return;
        const { html, rateLimited } = await fetchFb(cleanUid);
        if (rateLimited) {
          results[cleanUid] = { error: "rate_limited" };
          return;
        }
        if (!html) {
          results[cleanUid] = { error: "not_found" };
          return;
        }
        const data = parseProfile(html, cleanUid);
        if (data.photoUrl) {
          const dataUrl = await fetchPhotoAsDataUrl(data.photoUrl);
          if (dataUrl) data.photoUrl = dataUrl;
        }
        // Verify Instagram presence using candidates: parsed IG username, then FB username
        const candidates = [data.instagramUsername, data.username].filter(
          (v): v is string => !!v && /^[a-zA-Z0-9_.]{2,30}$/.test(v)
        );
        let verifiedIg: string | null = null;
        for (const c of candidates) {
          if (await checkInstagramExists(c)) { verifiedIg = c; break; }
        }
        data.instagramUsername = verifiedIg;
        results[cleanUid] = data;
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});