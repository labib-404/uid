// Heavy CPU work offloaded to a Web Worker so the UI thread stays responsive.
// Three operations:
//   - "compact": strip data:image/* base64 blobs from photo_url before persist
//   - "scan":    auto-retry candidate scan + status-bucket grouping
//   - "chunk":   batch grouping (split an array into fixed-size chunks)
//
// Worker is intentionally schema-loose ({uid, fetch_status, ...}) so we don't
// have to ship the FBId type into the worker bundle.

type AnyItem = Record<string, any>;

type CompactReq = { id: number; kind: "compact"; items: AnyItem[] };
type ScanReq = {
  id: number;
  kind: "scan";
  items: AnyItem[];
  retryCounts: Array<[string, number]>;
  scheduledUids: string[]; // uids already waiting for a retry timer
  now: number;
  scanLimit: number;
  max: number;
  notFoundMax: number;
  cooldownMs: number;
};
type ChunkReq = { id: number; kind: "chunk"; items: any[]; size: number };
type Req = CompactReq | ScanReq | ChunkReq;

function compact(items: AnyItem[]) {
  return items.map((it) =>
    typeof it?.photo_url === "string" && it.photo_url.startsWith("data:image/")
      ? { ...it, photo_url: /^\d+$/.test(String(it.uid ?? "")) ? `https://graph.facebook.com/${it.uid}/picture?type=large&width=200&height=200` : it.photo_url }
      : it
  );
}

function isComplete(i: AnyItem) {
  return !!i.real_name && !!i.username && !!i.photo_url && !!i.follower_count;
}
function isIncomplete(i: AnyItem) {
  return !i.real_name || !i.username || !i.photo_url || !i.follower_count;
}

function scan(req: ScanReq) {
  const tries = new Map(req.retryCounts);
  const scheduled = new Set(req.scheduledUids);
  const buckets = {
    rate_limited: [] as Array<{ uid: string; tries: number }>,
    not_found: [] as Array<{ uid: string; tries: number }>,
    other: [] as Array<{ uid: string; tries: number }>,
  };
  let collected = 0;
  for (const i of req.items) {
    if (collected >= req.scanLimit) break;
    if (i.instagram_checking || i.fetch_status === "pending" || i.fetch_status === "retrying") continue;
    if (isComplete(i)) continue;
    if (
      i.fetch_last_attempt_at &&
      req.now - new Date(i.fetch_last_attempt_at).getTime() < req.cooldownMs
    ) continue;

    let bucket: keyof typeof buckets | null = null;
    if (i.fetch_status === "not_found") {
      const t = tries.get(i.uid) ?? 0;
      if (t >= req.notFoundMax) continue;
      bucket = "not_found";
    } else if (i.fetch_status === "failed" || i.fetch_status === "rate_limited") {
      bucket = i.fetch_status === "rate_limited" ? "rate_limited" : "other";
    } else if (!i.fetch_status && isIncomplete(i)) {
      bucket = "other";
    } else if (i.fetch_status === "done" && isIncomplete(i)) {
      bucket = "other";
    }
    if (!bucket) continue;
    if (scheduled.has(i.uid)) continue;
    const t = tries.get(i.uid) ?? 0;
    if (t >= req.max) continue;
    buckets[bucket].push({ uid: i.uid, tries: t });
    collected++;
  }
  return buckets;
}

function chunk(items: any[], size: number) {
  const out: any[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const req = e.data;
  try {
    let result: any;
    if (req.kind === "compact") result = compact(req.items);
    else if (req.kind === "scan") result = scan(req);
    else if (req.kind === "chunk") result = chunk(req.items, req.size);
    (self as any).postMessage({ id: req.id, ok: true, result });
  } catch (err: any) {
    (self as any).postMessage({ id: req.id, ok: false, error: String(err?.message ?? err) });
  }
};

export {};