import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Upload, Star, Settings, Zap } from "lucide-react";
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

  return (
    <div className={`min-h-screen ${fontClass} pb-24`}>
      <div className="fixed inset-0 bg-gradient-glow pointer-events-none -z-10" />

      <header className="sticky top-0 z-30 glass border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">FB UID <span className="text-primary">Pro</span></span>
          </button>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Personal</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="glass rounded-2xl shadow-card flex items-center justify-around p-1.5 relative">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end className="flex-1">
                {({ isActive }) => (
                  <div className="relative flex flex-col items-center justify-center py-2 rounded-xl">
                    {isActive && (
                      <motion.div
                        layoutId="navpill"
                        className="absolute inset-0 bg-gradient-primary rounded-xl shadow-glow"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <t.icon className={`w-5 h-5 relative z-10 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    <span className={`text-[10px] mt-0.5 relative z-10 font-medium ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`}>{t.label}</span>
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
