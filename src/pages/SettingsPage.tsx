import { useSettings } from "@/hooks/useSettings";
import { useFBIds } from "@/hooks/useFBIds";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Hand, Trash2, Database, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function SettingsPage() {
  const { fontSize, setFontSize, viewMode, setViewMode, theme, setTheme, swipeDelete, setSwipeDelete, autoRetry, setAutoRetry } = useSettings();
  const { items, setItems } = useFBIds();

  const clearAll = () => {
    if (!items.length) return toast.info("Nothing to clear");
    if (!confirm(`Delete all ${items.length} items? This cannot be undone.`)) return;
    setItems([]);
    toast.success("All data cleared");
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-3">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <Card title="Theme">
        <div className="flex gap-2">
          <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")} size="sm">
            <Moon className="w-4 h-4 mr-1.5" /> Dark
          </Button>
          <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")} size="sm">
            <Sun className="w-4 h-4 mr-1.5" /> Light
          </Button>
        </div>
      </Card>

      <Card title="Font size">
        <div className="flex gap-2">
          {(["sm", "md", "lg"] as const).map((s) => (
            <Button key={s} variant={fontSize === s ? "default" : "outline"} size="sm" onClick={() => setFontSize(s)}>
              {s.toUpperCase()}
            </Button>
          ))}
        </div>
      </Card>

      <Card title="View mode">
        <div className="flex gap-2">
          <Button variant={viewMode === "full" ? "default" : "outline"} size="sm" onClick={() => setViewMode("full")}>Full</Button>
          <Button variant={viewMode === "compact" ? "default" : "outline"} size="sm" onClick={() => setViewMode("compact")}>Compact</Button>
        </div>
      </Card>

      <Card title="">
        <div className="flex items-center justify-between">
          <Label htmlFor="swipe-toggle" className="flex items-center gap-2">
            <Hand className="w-4 h-4 text-primary" /> Swipe to delete
          </Label>
          <Switch id="swipe-toggle" checked={swipeDelete} onCheckedChange={setSwipeDelete} />
        </div>
        <p className="text-xs text-muted-foreground">
          {swipeDelete ? "Swipe an item left to delete it." : "A delete button will appear on each item instead."}
        </p>
      </Card>

      <Card title="">
        <div className="flex items-center justify-between">
          <Label htmlFor="autoretry-toggle" className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" /> Auto-retry failed fetches
          </Label>
          <Switch id="autoretry-toggle" checked={autoRetry} onCheckedChange={setAutoRetry} />
        </div>
        <p className="text-xs text-muted-foreground">
          {autoRetry
            ? "Failed and rate-limited UIDs are re-fetched automatically with exponential backoff."
            : "You'll need to refresh failed UIDs manually."}
        </p>
      </Card>

      <Card title="Storage">
        <Label className="flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Local data</Label>
        <p className="text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"} stored on this device.
        </p>
        <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={clearAll}>
          <Trash2 className="w-4 h-4 mr-1.5" /> Clear all data
        </Button>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="brutal p-4 space-y-3">
      {title && <Label className="text-xs uppercase tracking-wider text-muted-foreground">{title}</Label>}
      {children}
    </div>
  );
}
