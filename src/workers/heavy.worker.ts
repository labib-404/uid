// Heavy CPU work offloaded to a Web Worker so the UI thread stays responsive.
// Three operations:
//   - "compact": strip data:image/* base64 blobs from photo_url before persist
//   - "scan":    auto-retry candidate scan + status-bucket grouping
//   - "chunk":   batch grouping (split an array into fixed-size chunks)
//
// Worker is intentionally schema-loose ({uid, fetch_status, ...}) so we don't
// have to ship the FBId type into the worker bundle.

type WorkerItem = Record<string, unknown>;

type CompactReq = { id: number; kind: "compact"; items: WorkerItem[] };
type ScanReq = {
  id: number;
  kind: "scan";
  items: WorkerItem[];
  retryCounts: Array<[string, number]>;
  scheduledUids: string[]; // uids already waiting for a retry timer
  now: number;
  scanLimit: number;
  max: number;
  notFoundMax: number;
  cooldownMs: number;
};
type ChunkReq = { id: number; kind: "chunk"; items: unknown[]; size: number };
type Req = CompactReq | ScanReq | ChunkReq;

type ScanBuckets = {
  rate_limited: Array<{ uid: string; tries: number }>;
  not_found: Array<{ uid: string; tries: number }>;
  other: Array<{ uid: string; tries: number }>;
};
type WorkerResult = WorkerItem[] | ScanBuckets | unknown[][];

function compact(items: WorkerItem[]) {
  // Never persist large data:image blobs. A few thousand base64 avatars make
  // localStorage JSON parse/stringify block the UI for seconds on mobile.
  return items.map((item) => {
    const photo = item.photo_url;
    if (typeof photo !== "string" || !photo.startsWith("data:image/")) return item;
    const uid = typeof item.uid === "string" ? item.uid : "";
    return {
      ...item,
      photo_url: /^\d+$/.test(uid)
        ? `https://graph.facebook.com/${uid}/picture?type=large&width=200&height=200`
        : null,
    };
  });
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isComplete(i: WorkerItem) {
  return !!i.real_name && !!i.username && !!i.photo_url && !!i.follower_count;
}
function isIncomplete(i: WorkerItem) {
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
    const uid = asString(i.uid);
    if (!uid) continue;
    const lastAttemptAt = asString(i.fetch_last_attempt_at);
    if (collected >= req.scanLimit) break;
    if (i.instagram_checking || i.fetch_status === "pending" || i.fetch_status === "retrying") continue;
    if (isComplete(i)) continue;
    if (
      lastAttemptAt &&
      req.now - new Date(lastAttemptAt).getTime() < req.cooldownMs
    ) continue;

    let bucket: keyof typeof buckets | null = null;
    if (i.fetch_status === "not_found") {
      const t = tries.get(uid) ?? 0;
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
    if (scheduled.has(uid)) continue;
    const t = tries.get(uid) ?? 0;
    if (t >= req.max) continue;
    buckets[bucket].push({ uid, tries: t });
    collected++;
  }
  return buckets;
}

function chunk(items: unknown[], size: number) {
  const out: unknown[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const req = e.data;
  try {
    let result: WorkerResult;
    if (req.kind === "compact") result = compact(req.items);
    else if (req.kind === "scan") result = scan(req);
    else if (req.kind === "chunk") result = chunk(req.items, req.size);
    self.postMessage({ id: req.id, ok: true, result });
  } catch (err: unknown) {
    self.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};

export {};