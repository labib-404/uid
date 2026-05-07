import { useSettings } from "@/hooks/useSettings";
import { useFBIds } from "@/hooks/useFBIds";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Hand, Trash2, Database } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function SettingsPage() {
  const { fontSize, setFontSize, viewMode, setViewMode, theme, setTheme, swipeDelete, setSwipeDelete } = useSettings();
  const { items, setItems } = useFBIds();

  const clearAll = () => {
    if (!items.length) return toast.info("Nothing to clear");
    if (!confirm(`Delete all ${items.length} items? This cannot be undone.`)) return;
    setItems([]);
    toast.success("All data cleared");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card title="Theme">
        <div className="flex gap-2">
          <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")} size="sm" className={theme === "dark" ? "bg-gradient-primary text-primary-foreground" : ""}>
            <Moon className="w-4 h-4 mr-1.5" /> Dark
          </Button>
          <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")} size="sm" className={theme === "light" ? "bg-gradient-primary text-primary-foreground" : ""}>
            <Sun className="w-4 h-4 mr-1.5" /> Light
          </Button>
        </div>
      </Card>

      <Card title="Font size">
        <div className="flex gap-2">
          {(["sm", "md", "lg"] as const).map((s) => (
            <Button key={s} variant={fontSize === s ? "default" : "outline"} size="sm" onClick={() => setFontSize(s)}
              className={fontSize === s ? "bg-gradient-primary text-primary-foreground" : ""}>
              {s.toUpperCase()}
            </Button>
          ))}
        </div>
      </Card>

      <Card title="View mode">
        <div className="flex gap-2">
          <Button variant={viewMode === "full" ? "default" : "outline"} size="sm" onClick={() => setViewMode("full")}
            className={viewMode === "full" ? "bg-gradient-primary text-primary-foreground" : ""}>Full</Button>
          <Button variant={viewMode === "compact" ? "default" : "outline"} size="sm" onClick={() => setViewMode("compact")}
            className={viewMode === "compact" ? "bg-gradient-primary text-primary-foreground" : ""}>Compact</Button>
        </div>
      </Card>

      <div className="glass rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="swipe-toggle" className="flex items-center gap-2">
            <Hand className="w-4 h-4 text-primary" /> Swipe to delete
          </Label>
          <Switch id="swipe-toggle" checked={swipeDelete} onCheckedChange={setSwipeDelete} />
        </div>
        <p className="text-xs text-muted-foreground">
          {swipeDelete ? "Swipe an item left to delete it." : "A delete button will appear on each item instead."}
        </p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <Label className="flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Storage</Label>
        <p className="text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"} stored locally on this device.
        </p>
        <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={clearAll}>
          <Trash2 className="w-4 h-4 mr-1.5" /> Clear all data
        </Button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <Label>{title}</Label>
      {children}
    </div>
  );
}
