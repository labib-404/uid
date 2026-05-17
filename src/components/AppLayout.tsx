import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Home, Upload, Star, Settings, LayoutGrid, Rows } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useEffect, useRef } from "react";
import InstallPWAButton from "@/components/InstallPWAButton";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/saved", label: "Saved", icon: Star },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const { fontSize, viewMode, setViewMode } = useSettings();
  const navigate = useNavigate();
  const fontClass = fontSize === "sm" ? "text-sm" : fontSize === "lg" ? "text-lg" : "text-base";
  const headerRef = useRef<HTMLElement | null>(null);

  // Measure header height and expose as a CSS variable so sticky elements
  // (e.g. import progress bar) can sit flush below it regardless of size.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--header-h", `${Math.round(h)}px`);
    };
    apply();

    // Prefer ResizeObserver when available so we catch header size changes
    // that don't come from a window resize (font load, content toggle,
    // safe-area changes). Fall back to window resize + a few delayed
    // re-measures on older browsers (e.g. older iOS / WebViews).
    const hasRO = typeof ResizeObserver !== "undefined";
    let ro: ResizeObserver | null = null;
    const fallbackTimers: number[] = [];

    if (hasRO) {
      ro = new ResizeObserver(apply);
      ro.observe(el);
    } else {
      // Re-measure shortly after mount to catch late layout shifts
      // (web fonts, images) since we have no observer.
      for (const delay of [120, 400, 1200]) {
        fallbackTimers.push(window.setTimeout(apply, delay));
      }
      document.addEventListener("visibilitychange", apply);
      window.addEventListener("orientationchange", apply);
    }
    window.addEventListener("resize", apply);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      if (!hasRO) {
        for (const t of fallbackTimers) clearTimeout(t);
        document.removeEventListener("visibilitychange", apply);
        window.removeEventListener("orientationchange", apply);
      }
    };
  }, []);

  // Alt+V toggles view mode.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key.toLowerCase() === "v") {
        e.preventDefault();
        const next = viewMode === "compact" ? "full" : "compact";
        setViewMode(next);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, setViewMode]);

  return (
    <div className={`min-h-screen ${fontClass} pb-24 bg-background text-foreground`}>
      <header ref={headerRef} className="sticky top-0 z-50 bg-background border-b border-border shadow-brutal">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button onClick={() => navigate("/")} className="flex items-baseline gap-1.5 text-left">
            <span className="text-lg font-semibold">UID</span>
            <span className="text-lg font-semibold text-primary">Operator</span>
          </button>
          <div className="flex items-center gap-2">
            <InstallPWAButton />
            <button
            onClick={() => setViewMode(viewMode === "compact" ? "full" : "compact")}
            title={`Switch to ${viewMode === "compact" ? "full" : "compact"} view`}
            aria-label="Toggle view mode"
            className="p-2 border border-white/10 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            {viewMode === "compact" ? <LayoutGrid className="w-4 h-4" /> : <Rows className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-32">
        <Outlet />
      </main>

      <nav
        className="fixed left-1/2 -translate-x-1/2 bottom-3 z-40 w-[min(92%,28rem)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="bg-background border border-border rounded-[28px] shadow-brutal p-1.5 flex items-stretch justify-between">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end className="flex-1">
              {({ isActive }) => (
                <div
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
