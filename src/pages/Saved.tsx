import { useFBIds } from "@/hooks/useFBIds";
import FBIdItem from "@/components/FBIdItem";
import NoteDialog from "@/components/NoteDialog";
import { useCallback, useMemo, useState } from "react";
import { FBId } from "@/types/fbid";
import { Star } from "lucide-react";

export default function Saved() {
  const { items, setItems } = useFBIds();
  const [noteFor, setNoteFor] = useState<FBId | null>(null);
  const saved = useMemo(() => items.filter((i) => i.pinned), [items]);
  const updateItem = useCallback((n: FBId) => setItems((p) => p.map((x) => (x.id === n.id ? n : x))), [setItems]);
  const deleteItem = useCallback((item: FBId) => setItems((p) => p.filter((x) => x.id !== item.id)), [setItems]);

  return (
    <div className="space-y-3">
      <div className="border-b border-border pb-3 flex items-center gap-2">
        <Star className="w-5 h-5 text-primary fill-primary" />
        <h1 className="text-2xl font-semibold">Saved</h1>
        <span className="text-sm text-muted-foreground">({saved.length})</span>
      </div>
      {saved.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground brutal">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No saved items yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {saved.map((item) => (
            <FBIdItem
              key={item.id}
              item={item}
              selected={false}
              onToggleSelect={() => {}}
              onChange={updateItem}
              onDelete={() => deleteItem(item)}
              onOpenNote={() => setNoteFor(item)}
            />
          ))}
        </div>
      )}
      <NoteDialog
        item={noteFor}
        onClose={() => setNoteFor(null)}
        onSaved={updateItem}
      />
    </div>
  );
}
