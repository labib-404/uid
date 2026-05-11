import { useEffect, useState, useCallback } from "react";
import { FBId } from "@/types/fbid";

const STORAGE_KEY = "fb_ids_v1";

function load(): FBId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const compacted = compactForStorage(arr as FBId[]);
    if (raw.includes('"photo_url":"data:image/')) {
      window.setTimeout(() => writeStorage(compacted), 0);
    }
    return compacted;
  } catch { return []; }
}

let memCache: FBId[] | null = null;
const listeners = new Set<(items: FBId[]) => void>();
let persistTimer: number | null = null;

function compactForStorage(items: FBId[]) {
  return items.map((item) => {
    if (item.photo_url?.startsWith("data:image/")) {
      return { ...item, photo_url: null };
    }
    return item;
  });
}

function writeStorage(items: FBId[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(compactForStorage(items))); } catch {}
}

function scheduleStorageWrite(items: FBId[]) {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    writeStorage(items);
  }, 350);
}

function persist(items: FBId[]) {
  memCache = items;
  scheduleStorageWrite(items);
  listeners.forEach((l) => l(items));
}

export function useFBIds() {
  const [items, setItemsState] = useState<FBId[]>(() => memCache ?? (memCache = load()));
  const [loading] = useState(false);

  useEffect(() => {
    const l = (next: FBId[]) => setItemsState(next);
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
