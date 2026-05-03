import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Import() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const lineCount = text.split("\n").filter((l) => l.trim()).length;

  const submit = async () => {
    if (!user) return;
    if (!text.trim()) return toast.error("Paste some UIDs first");
    setBusy(true);

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map((l) => {
      const [uid, password] = l.split("|").map((s) => s?.trim());
      return { uid, password: password || null };
    }).filter((p) => p.uid && p.uid.length <= 255);

    // dedup against existing
    const { data: existing } = await supabase
      .from("facebook_ids").select("uid").eq("user_id", user.id).limit(10000);
    const have = new Set((existing ?? []).map((e) => e.uid));
    const seen = new Set<string>();
    const fresh = parsed.filter((p) => {
      if (have.has(p.uid) || seen.has(p.uid)) return false;
      seen.add(p.uid);
      return true;
    });

    if (!fresh.length) {
      setBusy(false);
      return toast.info("All UIDs already exist");
    }

    // chunk inserts
    const chunks: typeof fresh[] = [];
    for (let i = 0; i < fresh.length; i += 500) chunks.push(fresh.slice(i, i + 500));
    let inserted = 0;
    for (const c of chunks) {
      const { error } = await supabase.from("facebook_ids").insert(
        c.map((r) => ({ user_id: user.id, uid: r.uid, password: r.password }))
      );
      if (error) {
        toast.error(error.message);
        break;
      }
      inserted += c.length;
    }
    setBusy(false);
    toast.success(`Imported ${inserted} (${parsed.length - fresh.length} duplicates skipped)`);
    setText("");
    nav("/");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
          <Upload className="w-6 h-6" /> Bulk Import
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          One per line. Format: <code className="text-foreground">uid</code> or <code className="text-foreground">uid|password</code>
        </p>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder={"100012345\n100098765|mypassword\n…"}
        className="font-mono text-sm"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="w-3 h-3" /> {lineCount} line(s)
        </span>
        <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow">
          {busy ? "Importing…" : "Import"}
        </Button>
      </div>
    </motion.div>
  );
}