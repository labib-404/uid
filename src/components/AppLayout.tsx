import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Upload, Star, Settings, LayoutGrid, Rows, Palette } from "lucide-react";
import { useSettings, DESIGN_THEMES, DesignTheme } from "@/hooks/useSettings";
import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/saved", label: "Saved", icon: Star },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const { fontSize, designTheme, setDesignTheme, viewMode, setViewMode } = useSettings();
  const navigate = useNavigate();
  const fontClass = fontSize === "sm" ? "text-sm" : fontSize === "lg" ? "text-lg" : "text-base";
  const [previewTheme, setPreviewTheme] = useState<DesignTheme | null>(null);
  const previewRef = useRef<DesignTheme | null>(null);

  // Apply temporary preview theme on hover; revert on leave/select.
  useEffect(() => {
    const root = document.documentElement;
    const all = [
      "theme-paper","theme-midnight","theme-noir","theme-ocean",
      "theme-vapor","theme-forest","theme-sunset","theme-mono",
    ];
    if (previewTheme) {
      all.forEach((c) => root.classList.remove(c));
      if (previewTheme !== "paper") root.classList.add(`theme-${previewTheme}`);
      previewRef.current = previewTheme;
    } else if (previewRef.current) {
      // Revert to actual selected theme
      all.forEach((c) => root.classList.remove(c));
      if (designTheme !== "paper") root.classList.add(`theme-${designTheme}`);
      previewRef.current = null;
    }
  }, [previewTheme, designTheme]);

  const tickerItems = [
    "OPERATOR OS · v5", "VOL. 05 · 2026", "PERSONAL ARCHIVE",
    "BULK · TAG · TRACK", "FB UID PRO", "NO TELEMETRY", "RUNS LOCAL",
    "8 DESIGN MODES", "ZERO LATENCY",
  ];

  const activeTheme = DESIGN_THEMES.find((t) => t.id === designTheme) ?? DESIGN_THEMES[0];

  return (
    <div className={`min-h-screen ${fontClass} pb-28 grain`}>
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none -z-10" />

      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b-2 border-foreground">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-2 flex items-end justify-between gap-3">
          <button onClick={() => navigate("/")} className="flex items-baseline gap-2 group text-left">
            <span className="font-display text-[34px] leading-none">UID</span>
            <span className="font-display italic text-[34px] leading-none text-primary">Operator.</span>
          </button>
          <div className="flex items-center gap-1.5 pb-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-2 py-1 border-2 border-foreground rounded font-mono text-[10px] uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
                  aria-label="Choose design theme"
                >
                  <span className="w-3 h-3 rounded-full border border-foreground/30" style={{ background: activeTheme.swatch }} />
                  <span>{activeTheme.label}</span>
                  <Palette className="w-3 h-3 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48"
                onMouseLeave={() => setPreviewTheme(null)}
                onCloseAutoFocus={() => setPreviewTheme(null)}
              >
                <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider">Design mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {DESIGN_THEMES.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => { setPreviewTheme(null); setDesignTheme(t.id); }}
                    onMouseEnter={() => setPreviewTheme(t.id)}
                    onFocus={() => setPreviewTheme(t.id)}
                    className={`flex items-center gap-2 ${designTheme === t.id ? "bg-accent/20 font-semibold" : ""}`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-foreground/30 shrink-0" style={{ background: t.swatch }} />
                    <span>{t.label}</span>
                    {designTheme === t.id && <span className="ml-auto text-[10px] font-mono">●</span>}
                    {previewTheme === t.id && designTheme !== t.id && (
                      <span className="ml-auto text-[9px] font-mono opacity-70">PREVIEW</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => setViewMode(viewMode === "compact" ? "full" : "compact")}
              title={`Switch to ${viewMode === "compact" ? "full" : "compact"} view`}
              aria-label="Toggle view mode"
              className="p-1.5 border-2 border-foreground rounded hover:bg-foreground hover:text-background transition-colors"
            >
              {viewMode === "compact" ? <LayoutGrid className="w-3.5 h-3.5" /> : <Rows className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="border-t border-foreground/80 bg-foreground text-background overflow-hidden marquee-mask">
          <div className="flex whitespace-nowrap animate-ticker py-1">
            {[...tickerItems, ...tickerItems, ...tickerItems].map((t, i) => (
              <span key={i} className="text-[10px] font-mono uppercase tracking-[0.3em] px-4">
                {t} <span className="opacity-40">◆</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="brutal-lg flex items-stretch justify-around p-0 relative overflow-hidden">
            {tabs.map((t, idx) => (
              <NavLink key={t.to} to={t.to} end className={`flex-1 ${idx > 0 ? "border-l-2 border-foreground" : ""}`}>
                {({ isActive }) => (
                  <div className="relative flex flex-col items-center justify-center py-2.5">
                    {isActive && (
                      <motion.div
                        layoutId="navpill"
                        className="absolute inset-0 bg-foreground"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <t.icon className={`w-[18px] h-[18px] relative z-10 ${isActive ? "text-background" : "text-foreground"}`} strokeWidth={isActive ? 2.25 : 1.75} />
                    <span className={`text-[9px] mt-1 relative z-10 font-mono uppercase tracking-[0.2em] ${isActive ? "text-background" : "text-foreground"}`}>{t.label}</span>
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
