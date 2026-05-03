import { useFBIds } from "@/hooks/useFBIds";
import FBIdItem from "@/components/FBIdItem";
import NoteDialog from "@/components/NoteDialog";
import { useState } from "react";
import { FBId } from "@/types/fbid";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";

export default function Saved() {
  const { items, setItems, refresh } = useFBIds();
  const [noteFor, setNoteFor] = useState<FBId | null>(null);
  const saved = items.filter((i) => i.pinned);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
        <Star className="w-6 h-6" /> Saved ({saved.length})
      </h1>
      {saved.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">No saved items yet.</div>
      ) : (
        <div className="space-y-2">
          {saved.map((item) => (
            <FBIdItem
              key={item.id}
              item={item}
              selected={false}
              onToggleSelect={() => {}}
              onChange={(n) => setItems((p) => p.map((x) => (x.id === n.id ? n : x)))}
              onDelete={async () => {
                setItems((p) => p.filter((x) => x.id !== item.id));
                await supabase.from("facebook_ids").delete().eq("id", item.id);
                refresh();
              }}
              onOpenNote={() => setNoteFor(item)}
            />
          ))}
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