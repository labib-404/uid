import { useEffect, useState, useCallback } from "react";
import { FBId } from "@/types/fbid";

const STORAGE_KEY = "fb_ids_v1";

function load(): FBId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

let memCache: FBId[] | null = null;
const listeners = new Set<(items: FBId[]) => void>();

function persist(items: FBId[]) {
  memCache = items;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
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
