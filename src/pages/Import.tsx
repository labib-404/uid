import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useFBIds, genId } from "@/hooks/useFBIds";
import { useFBProfile } from "@/hooks/useFBProfile";
import { chunkInWorker } from "@/workers/heavyClient";
import { FBId } from "@/types/fbid";

export default function Import() {
  const nav = useNavigate();
  const { items, setItems } = useFBIds();
  const { fetchProfiles } = useFBProfile(setItems);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const lineCount = text.split("\n").filter((l) => l.trim()).length;

  const submit = () => {
    if (!text.trim()) return;
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
      return;
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
    setText("");
    nav("/");

    // Auto-fetch profiles in background. Only kick off the first slice here;
    // the Home auto-retry loop + global concurrency gate will gradually pick up
    // the rest. This prevents pasting 2-3k UIDs from saturating the network.
    (async () => {
      const uids = newItems.map((i) => i.uid);
      const BATCH = 50;
      const PARALLEL = 2;
      const PRIME = Math.min(uids.length, BATCH * PARALLEL * 2); // first ~200
      const primeUids = uids.slice(0, PRIME);
      const batches = await chunkInWorker(primeUids, BATCH);
      let cursor = 0;
      const worker = async () => {
        while (cursor < batches.length) {
          const idx = cursor++;
          if (idx >= batches.length) break;
          await fetchProfiles(batches[idx]);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, worker));
    })();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="border-b border-border pb-3">
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          One per line. Format: <code className="font-mono bg-secondary px-1.5 py-0.5 text-xs rounded">uid</code> or <code className="font-mono bg-secondary px-1.5 py-0.5 text-xs rounded">uid|password</code>
        </p>
      </div>

      <div className="brutal p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder={"100012345\n100098765|mypassword\n…"}
          className="font-mono text-sm bg-background resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> {lineCount} line{lineCount === 1 ? "" : "s"}
          </span>
          <Button onClick={submit} disabled={busy || lineCount === 0}>
            <Sparkles className="w-4 h-4 mr-1.5" />
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
