import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FBId } from "@/types/fbid";
import { useAuth } from "./useAuth";

export function useFBIds() {
  const { user } = useAuth();
  const [items, setItems] = useState<FBId[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("facebook_ids")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!error && data) setItems(data as FBId[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const refresh = fetchAll;

  return { items, setItems, loading, refresh };
}