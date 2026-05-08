import { useSettings } from "@/hooks/useSettings";
import { useFBIds } from "@/hooks/useFBIds";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Hand, Trash2, Database, Palette as PaletteIcon, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function SettingsPage() {
  const { fontSize, setFontSize, viewMode, setViewMode, theme, setTheme, swipeDelete, setSwipeDelete, palette, setPalette, resetPalette } = useSettings();
  const { items, setItems } = useFBIds();

  const presets = [
    { name: "Aurora",   primary: "#2BE5A8", accent: "#B98BFF", background: "#0B0B14" },
    { name: "Sunset",   primary: "#FF6B35", accent: "#E84393", background: "#1A0E1A" },
    { name: "Ocean",    primary: "#5CBDB9", accent: "#3B82F6", background: "#0C2340" },
    { name: "Paper",    primary: "#2D2D2D", accent: "#C9A84C", background: "#F5F3EE" },
    { name: "Mint Pop", primary: "#73FFB8", accent: "#FFEB3B", background: "#0A0A0A" },
  ];

  const clearAll = () => {
    if (!items.length) return toast.info("Nothing to clear");
    if (!confirm(`Delete all ${items.length} items? This cannot be undone.`)) return;
    setItems([]);
    toast.success("All data cleared");
  };

  return (
    <div className="space-y-4">
      <div className="border-b-2 border-foreground pb-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">§ 04 — Controls</div>
        <h1 className="font-display text-4xl mt-1 leading-none">
          Settings<span className="italic text-primary">.</span>
        </h1>
      </div>

      <Card title="Theme">
        <div className="flex gap-2">
          <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")} size="sm" className={`rounded-none border-[1.5px] border-foreground ${theme === "dark" ? "bg-foreground text-background" : ""}`}>
            <Moon className="w-4 h-4 mr-1.5" /> Dark
          </Button>
          <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")} size="sm" className={`rounded-none border-[1.5px] border-foreground ${theme === "light" ? "bg-foreground text-background" : ""}`}>
            <Sun className="w-4 h-4 mr-1.5" /> Light
          </Button>
        </div>
      </Card>

      <Card title="Font size">
        <div className="flex gap-2">
          {(["sm", "md", "lg"] as const).map((s) => (
            <Button key={s} variant={fontSize === s ? "default" : "outline"} size="sm" onClick={() => setFontSize(s)}
              className={`rounded-none border-[1.5px] border-foreground ${fontSize === s ? "bg-foreground text-background" : ""}`}>
              {s.toUpperCase()}
            </Button>
          ))}
        </div>
      </Card>

      <Card title="View mode">
        <div className="flex gap-2">
          <Button variant={viewMode === "full" ? "default" : "outline"} size="sm" onClick={() => setViewMode("full")}
            className={`rounded-none border-[1.5px] border-foreground ${viewMode === "full" ? "bg-foreground text-background" : ""}`}>Full</Button>
          <Button variant={viewMode === "compact" ? "default" : "outline"} size="sm" onClick={() => setViewMode("compact")}
            className={`rounded-none border-[1.5px] border-foreground ${viewMode === "compact" ? "bg-foreground text-background" : ""}`}>Compact</Button>
        </div>
      </Card>

      <div className="brutal p-4 space-y-4">
        <Label className="flex items-center gap-2 font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground">
          <PaletteIcon className="w-3.5 h-3.5 text-primary" /> Color palette
        </Label>

        <div className="grid grid-cols-3 gap-3">
          {(["primary", "accent", "background"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{key}</span>
              <div className="relative h-12 brutal overflow-hidden">
                <input
                  type="color"
                  value={palette[key]}
                  onChange={(e) => setPalette({ ...palette, [key]: e.target.value })}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                />
                <div className="w-full h-full" style={{ background: palette[key] }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{palette[key].toUpperCase()}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Presets</span>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.name}
                onClick={() => setPalette({ primary: p.primary, accent: p.accent, background: p.background })}
                className="flex items-center gap-2 px-2.5 py-1.5 brutal hover:glow-ring transition-shadow"
              >
                <span className="flex -space-x-1">
                  <span className="w-3 h-3 rounded-full border border-foreground/20" style={{ background: p.background }} />
                  <span className="w-3 h-3 rounded-full border border-foreground/20" style={{ background: p.primary }} />
                  <span className="w-3 h-3 rounded-full border border-foreground/20" style={{ background: p.accent }} />
                </span>
                <span className="text-[11px] font-mono">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-muted-foreground">Live preview — saved to this device.</p>
          <Button variant="outline" size="sm" onClick={() => { resetPalette(); toast.success("Palette reset"); }}
            className="rounded-none border-[1.5px] border-foreground">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
          </Button>
        </div>
      </div>

      <div className="brutal p-4 space-y-2">
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

      <div className="brutal p-4 space-y-3">
        <Label className="flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Storage</Label>
        <p className="text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"} stored locally on this device.
        </p>
        <Button variant="outline" size="sm" className="rounded-none border-[1.5px] border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={clearAll}>
          <Trash2 className="w-4 h-4 mr-1.5" /> Clear all data
        </Button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="brutal p-4 space-y-3">
      <Label className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground">{title}</Label>
      {children}
    </div>
  );
}
