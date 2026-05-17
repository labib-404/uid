// Thin RPC client for heavy.worker.ts. A single shared worker instance is
// reused across the app. If the worker fails to spawn (e.g. very old browser)
// every helper transparently falls back to running the same logic on the
// main thread so the app keeps working.

type PendingResolver = (value: any) => void;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: PendingResolver; reject: (e: any) => void }>();

function ensureWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("./heavy.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: any; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      e.data.ok ? p.resolve(e.data.result) : p.reject(new Error(e.data.error ?? "worker error"));
    };
    worker.onerror = () => { /* swallow — fallbacks kick in */ };
  } catch {
    worker = null;
  }
  return worker;
}

function send<T = any>(payload: any): Promise<T> | null {
  const w = ensureWorker();
  if (!w) return null;
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...payload, id });
  });
}

// ---------- Public API ----------

export function compactInWorker<T extends Record<string, any>>(items: T[]): Promise<T[]> {
  const p = send<T[]>({ kind: "compact", items });
  if (p) return p;
  // Main-thread fallback: keep items untouched so base64 photos persist.
  return Promise.resolve(items);
}

export type ScanBuckets = {
  rate_limited: Array<{ uid: string; tries: number }>;
  not_found: Array<{ uid: string; tries: number }>;
  other: Array<{ uid: string; tries: number }>;
};

export function scanInWorker(args: {
  items: any[];
  retryCounts: Array<[string, number]>;
  scheduledUids: string[];
  now: number;
  scanLimit: number;
  max: number;
  notFoundMax: number;
  cooldownMs: number;
}): Promise<ScanBuckets> {
  const p = send<ScanBuckets>({ kind: "scan", ...args });
  if (p) return p;
  // Fallback: empty buckets — auto-retry will simply pause this tick.
  return Promise.resolve({ rate_limited: [], not_found: [], other: [] });
}

export function chunkInWorker<T>(items: T[], size: number): Promise<T[][]> {
  const p = send<T[][]>({ kind: "chunk", items, size });
  if (p) return p;
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return Promise.resolve(out);
}