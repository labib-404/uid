import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FBId } from "@/types/fbid";

export default function NoteDialog({
  item, onClose, onSaved,
}: {
  item: FBId | null;
  onClose: () => void;
  onSaved: (next: FBId) => void;
}) {
  const [val, setVal] = useState("");
  useEffect(() => setVal(item?.note ?? ""), [item]);

  const save = async () => {
    if (!item) return;
    const note = val.slice(0, 1000);
    const { error } = await supabase.from("facebook_ids").update({ note }).eq("id", item.id);
    if (error) return toast.error(error.message);
    onSaved({ ...item, note });
    onClose();
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Note for {item?.uid}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          maxLength={1000}
          rows={6}
          placeholder="Write a note (up to 1000 chars)…"
        />
        <p className="text-xs text-muted-foreground text-right">{val.length}/1000</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} className="bg-gradient-primary text-primary-foreground">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}