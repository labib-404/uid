import { startTransition, useEffect, useState, useCallback } from "react";
import { FBId } from "@/types/fbid";
import { compactInWorker } from "@/workers/heavyClient";

const STORAGE_KEY = "fb_ids_v1";

function restoreStablePhotoUrl(item: FBId): FBId {
  if (item.photo_url || !/^\d+$/.test(item.uid)) return item;
  if (!item.real_name && !item.username && !item.profile_fetched_at && item.fetch_status !== "done") return item;
  return {
    ...item,
    photo_url: `https://graph.facebook.com/${item.uid}/picture?type=large&width=200&height=200`,
  };
}

function load(): FBId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const items = (arr as FBId[]).map(restoreStablePhotoUrl);
    if (raw.includes('"photo_url":"data:image/')) {
      // Offload the strip-base64 pass to the worker, then re-persist.
      compactInWorker(items).then((compacted) => {
        memCache = compacted;
        writeStorage(compacted);
        listeners.forEach((l) => l(compacted));
      }).catch(() => {});
      return compactForStorage(items);
    }
    return items;
  } catch { return []; }
}

let memCache: FBId[] | null = null;
const listeners = new Set<(items: FBId[]) => void>();
let persistTimer: number | null = null;
let idlePersist: number | null = null;
let notifyTimer: number | null = null;

function notifyListeners() {
  if (notifyTimer !== null) return;
  notifyTimer = window.setTimeout(() => {
    notifyTimer = null;
    const snapshot = memCache ?? [];
    listeners.forEach((l) => l(snapshot));
  }, 120);
}

function compactForStorage(items: FBId[]) {
  return items.map((item) => {
    if (item.photo_url?.startsWith("data:image/")) {
      const stablePhotoUrl = /^\d+$/.test(item.uid)
        ? `https://graph.facebook.com/${item.uid}/picture?type=large&width=200&height=200`
        : item.photo_url;
      return { ...item, photo_url: stablePhotoUrl };
    }
    return item;
  });
}

function writeStorage(items: FBId[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* storage may be full or unavailable */ }
}

function scheduleStorageWrite(items: FBId[]) {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  if (idlePersist !== null && "cancelIdleCallback" in window) {
    window.cancelIdleCallback(idlePersist);
    idlePersist = null;
  }
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    const persistNow = () => {
      idlePersist = null;
      // Compact in a worker so big base64 stripping doesn't block the UI.
      compactInWorker(items)
        .then((compacted) => writeStorage(compacted))
        .catch(() => writeStorage(compactForStorage(items)));
    };
    if ("requestIdleCallback" in window) {
      idlePersist = window.requestIdleCallback(persistNow, { timeout: 2500 });
    } else {
      persistNow();
    }
  }, 1200);
}

function persist(items: FBId[]) {
  memCache = items;
  scheduleStorageWrite(items);
  notifyListeners();
}

export function useFBIds() {
  const [items, setItemsState] = useState<FBId[]>(() => memCache ?? (memCache = load()));
  const [loading] = useState(false);

  useEffect(() => {
    const l = (next: FBId[]) => startTransition(() => setItemsState(next));
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  useEffect(() => {
    const flush = () => {
      if (memCache) writeStorage(memCache);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const setItems = useCallback((updater: FBId[] | ((prev: FBId[]) => FBId[])) => {
    const next = typeof updater === "function" ? (updater as (p: FBId[]) => FBId[])(memCache ?? []) : updater;
    persist(next);
  }, []);

  const refresh = useCallback(() => { persist(load()); }, []);

  return { items, setItems, loading, refresh };
}

export function genId() {
  return (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
