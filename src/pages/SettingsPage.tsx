import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sun, Moon, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const { fontSize, setFontSize, viewMode, setViewMode, theme, setTheme } = useSettings();
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gradient">Settings</h1>

      <div className="glass rounded-xl p-4 space-y-2">
        <Label className="flex items-center gap-2"><User className="w-4 h-4" /> Account</Label>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <Button
          variant="outline" size="sm"
          onClick={async () => { await signOut(); nav("/auth"); }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <Label>Theme</Label>
        <div className="flex gap-2">
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            onClick={() => setTheme("dark")}
            size="sm"
          >
            <Moon className="w-4 h-4 mr-1" /> Dark
          </Button>
          <Button
            variant={theme === "light" ? "default" : "outline"}
            onClick={() => setTheme("light")}
            size="sm"
          >
            <Sun className="w-4 h-4 mr-1" /> Light
          </Button>
        </div>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <Label>Font size</Label>
        <div className="flex gap-2">
          {(["sm", "md", "lg"] as const).map((s) => (
            <Button
              key={s}
              variant={fontSize === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFontSize(s)}
            >
              {s.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <Label>View mode</Label>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "full" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("full")}
          >
            Full
          </Button>
          <Button
            variant={viewMode === "compact" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("compact")}
          >
            Compact
          </Button>
        </div>
      </div>
    </div>
  );
}