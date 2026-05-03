import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Upload, Star, Settings, Shield, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/saved", label: "Saved", icon: Star },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const { user, isAdmin, signOut } = useAuth();
  const { fontSize } = useSettings();
  const navigate = useNavigate();

  const fontClass = fontSize === "sm" ? "text-sm" : fontSize === "lg" ? "text-lg" : "text-base";

  return (
    <div className={`min-h-screen ${fontClass} pb-20`}>
      {/* glow bg */}
      <div className="fixed inset-0 bg-gradient-glow pointer-events-none -z-10" />

      {/* header */}
      <header className="sticky top-0 z-30 glass border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-gradient">FB UID Pro</span>
          </button>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} title="Admin">
                <Shield className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => { await signOut(); navigate("/auth"); }}
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <Outlet />
      </main>

      {/* bottom nav */}
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