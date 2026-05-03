import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";

type Row = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  total: number;
  checked: number;
  saved: number;
};

export default function Admin() {
  const { isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, display_name, created_at")
        .order("created_at", { ascending: false });
      const { data: ids } = await supabase.from("facebook_ids").select("user_id, visited, pinned").limit(50000);
      const stats = new Map<string, { total: number; checked: number; saved: number }>();
      (ids ?? []).forEach((i) => {
        const s = stats.get(i.user_id) ?? { total: 0, checked: 0, saved: 0 };
        s.total++;
        if (i.visited) s.checked++;
        if (i.pinned) s.saved++;
        stats.set(i.user_id, s);
      });
      setRows((profiles ?? []).map((p) => ({
        ...p,
        ...(stats.get(p.id) ?? { total: 0, checked: 0, saved: 0 }),
      })));
    })();
  }, [isAdmin]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const filtered = rows.filter((r) =>
    !search || (r.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
        <Shield className="w-6 h-6" /> Admin Panel
      </h1>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email…" />
      <div className="space-y-2">
        {filtered.map((r) => (
          <div key={r.id} className="glass rounded-xl p-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-semibold truncate">{r.email ?? r.display_name ?? r.id}</div>
              <div className="text-xs text-muted-foreground">
                Joined {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex gap-3 text-xs shrink-0">
              <div className="text-center"><div className="font-bold text-foreground">{r.total}</div><div className="text-muted-foreground">Total</div></div>
              <div className="text-center"><div className="font-bold text-foreground">{r.checked}</div><div className="text-muted-foreground">Checked</div></div>
              <div className="text-center"><div className="font-bold text-foreground">{r.saved}</div><div className="text-muted-foreground">Saved</div></div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-10">No users.</div>}
      </div>
    </div>
  );
}