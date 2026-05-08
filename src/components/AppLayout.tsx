import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Upload, Star, Settings } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/saved", label: "Saved", icon: Star },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const { fontSize } = useSettings();
  const navigate = useNavigate();
  const fontClass = fontSize === "sm" ? "text-sm" : fontSize === "lg" ? "text-lg" : "text-base";

  const tickerItems = [
    "EDITORIAL EDITION", "VOL. 04", "PERSONAL ARCHIVE", "EST. 2025",
    "BULK · TAG · TRACK", "FB UID PRO", "NO TELEMETRY", "RUNS LOCAL",
  ];

  return (
    <div className={`min-h-screen ${fontClass} pb-28 grain`}>
      <div className="fixed inset-0 bg-gradient-mesh pointer-events-none -z-10" />

      <header className="sticky top-0 z-30 bg-background border-b-2 border-foreground">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-2 flex items-end justify-between gap-3">
          <button onClick={() => navigate("/")} className="flex items-baseline gap-2 group text-left">
            <span className="font-display text-[28px] leading-none">FB UID</span>
            <span className="font-display italic text-[28px] leading-none text-primary">Pro.</span>
          </button>
          <div className="flex items-center gap-2 pb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-blink" />
            <span className="text-[10px] uppercase tracking-[0.25em] font-mono">Personal · No.04</span>
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
