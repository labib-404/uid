import { memo, useEffect, useState } from "react";

/**
 * Lightweight indeterminate progress bar shown across the top of the page.
 * Pure CSS animation (no JS interval) so it stays cheap even when sitting
 * above a long virtualized list.
 */
function TopLoadingBarImpl({ show, label }: { show: boolean; label?: string }) {
  const [mounted, setMounted] = useState(show);
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      // next frame to ensure transition triggers from 0 -> 1
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 400);
    return () => clearTimeout(t);
  }, [show]);

  if (!mounted) return null;
  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label={label ?? "Loading"}
      className={`pointer-events-none fixed top-0 left-0 right-0 z-50 h-[2px] overflow-hidden bg-primary/10 transition-opacity duration-300 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="loading-bar-track h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent" />
    </div>
  );
}

const TopLoadingBar = memo(TopLoadingBarImpl);
export default TopLoadingBar;