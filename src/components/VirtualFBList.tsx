import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import FBIdItem from "@/components/FBIdItem";
import { FBId } from "@/types/fbid";

type Props = {
  items: FBId[];
  compact: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onChange: (next: FBId) => void;
  onDelete: (item: FBId) => void;
  onOpenNote: (item: FBId) => void;
  onFetchProfile: (uid: string) => void;
  onRecheckInstagram: (item: FBId) => void;
};

// Render only the rows actually in (or close to) the viewport. The whole page
// scrolls the window, so we use the window virtualizer with dynamic
// measurement — row heights vary based on note/tag/photo content.
function VirtualFBListImpl({
  items,
  compact,
  selected,
  onToggleSelect,
  onChange,
  onDelete,
  onOpenNote,
  onFetchProfile,
  onRecheckInstagram,
}: Props) {
  // Compact view becomes a 2-column grid on >=640px. We pack 2 items per
  // virtualized row in that case so the virtualizer stays one-dimensional.
  const [cols, setCols] = useState<1 | 2>(() =>
    typeof window !== "undefined" && compact && window.innerWidth >= 640 ? 2 : 1
  );
  useEffect(() => {
    if (!compact) { setCols(1); return; }
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = () => setCols(mq.matches ? 2 : 1);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [compact]);

  const rows = useMemo(() => {
    if (cols === 1) return items.map((it) => [it]);
    const out: FBId[][] = [];
    for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
    return out;
  }, [items, cols]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const [offsetTop, setOffsetTop] = useState(0);
  useEffect(() => {
    const measure = () => {
      if (!parentRef.current) return;
      const rect = parentRef.current.getBoundingClientRect();
      setOffsetTop(rect.top + window.scrollY);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => (compact ? 96 : 128),
    overscan: 3,
    scrollMargin: offsetTop,
    measureElement:
      typeof ResizeObserver !== "undefined"
        ? (el) => el.getBoundingClientRect().height
        : undefined,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div ref={parentRef} style={{ height: totalSize, position: "relative", width: "100%" }}>
      {virtualRows.map((vrow) => {
        const row = rows[vrow.index];
        return (
          <div
            key={vrow.key}
            data-index={vrow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vrow.start - virtualizer.options.scrollMargin}px)`,
              paddingBottom: 8,
              contain: "layout paint style",
            }}
            className={cols === 2 ? "grid grid-cols-2 gap-2" : ""}
          >
            {row.map((item) => (
              <FBIdItem
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggleSelect={() => onToggleSelect(item.id)}
                onChange={onChange}
                onDelete={() => onDelete(item)}
                onOpenNote={() => onOpenNote(item)}
                onFetchProfile={() => onFetchProfile(item.uid)}
                onRecheckInstagram={() => onRecheckInstagram(item)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

const VirtualFBList = memo(VirtualFBListImpl);
export default VirtualFBList;