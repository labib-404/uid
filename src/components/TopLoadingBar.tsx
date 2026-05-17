import { memo } from "react";

/**
 * Lightweight indeterminate progress bar shown across the top of the page.
 * Pure CSS animation (no JS interval) so it stays cheap even when sitting
 * above a long virtualized list.
 */
function TopLoadingBarImpl({ show, label }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label={label ?? "Loading"}
      className="pointer-events-none fixed top-0 left-0 right-0 z-50 h-[2px] overflow-hidden bg-primary/10"
    >
      <div className="loading-bar-track h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent" />
    </div>
  );
}

const TopLoadingBar = memo(TopLoadingBarImpl);
export default TopLoadingBar;