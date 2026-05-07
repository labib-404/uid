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
  if (m) return m[1];
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`,
    "i"
  );
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
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