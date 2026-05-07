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
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Star className="w-6 h-6 text-amber-400 fill-amber-400" /> Saved
        <span className="text-sm text-muted-foreground font-normal">({saved.length})</span>
      </h1>
      {saved.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No saved items yet.</p>
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
