import { useFBIds } from "@/hooks/useFBIds";
import FBIdItem from "@/components/FBIdItem";
import NoteDialog from "@/components/NoteDialog";
import { useState } from "react";
import { FBId } from "@/types/fbid";
import { Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Saved() {
  const { items, setItems } = useFBIds();
  const [noteFor, setNoteFor] = useState<FBId | null>(null);
  const saved = items.filter((i) => i.pinned);

  return (
    <div className="space-y-3">
      <div className="border-b-2 border-foreground pb-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">§ 03 — Archive</div>
        <h1 className="font-display text-4xl mt-1 flex items-end gap-2 leading-none">
          <Star className="w-6 h-6 text-primary fill-primary mb-1" /> Saved
          <span className="italic text-primary">({saved.length}).</span>
        </h1>
      </div>
      {saved.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground brutal">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-mono uppercase tracking-[0.2em] text-xs">— Empty archive —</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {saved.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -100 }}>
                <FBIdItem
                  item={item}
                  selected={false}
                  onToggleSelect={() => {}}
                  onChange={(n) => setItems((p) => p.map((x) => (x.id === n.id ? n : x)))}
                  onDelete={() => setItems((p) => p.filter((x) => x.id !== item.id))}
                  onOpenNote={() => setNoteFor(item)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <NoteDialog
        item={noteFor}
        onClose={() => setNoteFor(null)}
        onSaved={(n) => setItems((p) => p.map((x) => (x.id === n.id ? n : x)))}
      />
    </div>
  );
}
