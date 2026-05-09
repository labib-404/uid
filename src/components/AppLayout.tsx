import { toast } from "sonner";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Home, Upload, Star, Settings, LayoutGrid, Rows } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useEffect } from "react";

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
        toast.success(`View: ${next}`, { duration: 1200 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, setViewMode]);

  return (
    <div className={`min-h-screen ${fontClass} pb-24 bg-background text-foreground`}>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button onClick={() => navigate("/")} className="flex items-baseline gap-1.5 text-left">
            <span className="text-lg font-semibold">UID</span>
            <span className="text-lg font-semibold text-primary">Operator</span>
          </button>
          <button
            onClick={() => setViewMode(viewMode === "compact" ? "full" : "compact")}
            title={`Switch to ${viewMode === "compact" ? "full" : "compact"} view`}
            aria-label="Toggle view mode"
            className="p-2 border border-border rounded-md hover:bg-secondary transition-colors"
          >
            {viewMode === "compact" ? <LayoutGrid className="w-4 h-4" /> : <Rows className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] bg-background border-t border-border">
        <div className="max-w-3xl mx-auto px-2">
          <div className="flex items-stretch justify-around">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end className="flex-1">
                {({ isActive }) => (
                  <div className={`flex flex-col items-center justify-center py-2.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    <t.icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
                    <span className="text-[10px] mt-1">{t.label}</span>
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
