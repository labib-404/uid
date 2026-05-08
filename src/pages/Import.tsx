import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useFBIds, genId } from "@/hooks/useFBIds";
import { useFBProfile } from "@/hooks/useFBProfile";
import { FBId } from "@/types/fbid";

export default function Import() {
  const nav = useNavigate();
  const { items, setItems } = useFBIds();
  const { fetchProfiles } = useFBProfile(setItems);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const lineCount = text.split("\n").filter((l) => l.trim()).length;

  const submit = () => {
    if (!text.trim()) return toast.error("Paste some UIDs first");
    setBusy(true);

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map((l) => {
      const [uid, password] = l.split("|").map((s) => s?.trim());
      return { uid, password: password || null };
    }).filter((p) => p.uid && p.uid.length <= 255);

    const have = new Set(items.map((i) => i.uid));
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

    const now = new Date().toISOString();
    const newItems: FBId[] = fresh.map((p) => ({
      id: genId(),
      uid: p.uid,
      password: p.password,
      pinned: false,
      visited: false,
      note: null,
      tag: null,
      visited_at: null,
      created_at: now,
    }));

    setItems([...newItems, ...items]);
    setBusy(false);
    toast.success(`Imported ${newItems.length} (${parsed.length - fresh.length} duplicates skipped)`);
    setText("");
    nav("/");

    // Auto-fetch profiles in background, in chunks of 20
    (async () => {
      const uids = newItems.map((i) => i.uid);
      for (let i = 0; i < uids.length; i += 20) {
        await fetchProfiles(uids.slice(i, i + 20));
      }
    })();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="border-b-2 border-foreground pb-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">§ 02 — Intake</div>
        <h1 className="font-display text-4xl mt-1 flex items-end gap-2 leading-none">
          Bulk <span className="italic text-primary">Import.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          One per line. Format: <code className="font-mono bg-secondary px-1.5 py-0.5 text-xs border border-foreground/30">uid</code> or <code className="font-mono bg-secondary px-1.5 py-0.5 text-xs border border-foreground/30">uid|password</code>
        </p>
      </div>

      <div className="brutal p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder={"100012345\n100098765|mypassword\n…"}
          className="font-mono text-sm bg-background border-foreground/30 resize-none rounded-none"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> {lineCount} LINE{lineCount === 1 ? "" : "S"}
          </span>
          <Button
            onClick={submit}
            disabled={busy || lineCount === 0}
            className="bg-foreground text-background hover:bg-primary hover:text-primary-foreground shadow-card border-[1.5px] border-foreground rounded-none font-mono uppercase tracking-wider"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {busy ? "Importing…" : "Import →"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
