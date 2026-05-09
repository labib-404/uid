import { useSettings } from "@/hooks/useSettings";
import { useFBIds } from "@/hooks/useFBIds";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Hand, Trash2, Database, Palette as PaletteIcon, RotateCcw, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { fontSize, setFontSize, viewMode, setViewMode, theme, setTheme, swipeDelete, setSwipeDelete, autoRetry, setAutoRetry, palette, setPalette, resetPalette } = useSettings();
  const { items, setItems } = useFBIds();

  const presets = [
    { name: "Aurora",   primary: "#2BE5A8", accent: "#B98BFF", background: "#0B0B14" },
    { name: "Sunset",   primary: "#FF6B35", accent: "#E84393", background: "#1A0E1A" },
    { name: "Ocean",    primary: "#5CBDB9", accent: "#3B82F6", background: "#0C2340" },
    { name: "Paper",    primary: "#2D2D2D", accent: "#C9A84C", background: "#F5F3EE" },
    { name: "Mint Pop", primary: "#73FFB8", accent: "#FFEB3B", background: "#0A0A0A" },
    { name: "Midnight",   primary: "#4F46E5", accent: "#A78BFA", background: "#0A0A1A" },
    { name: "Ember",      primary: "#E85D3A", accent: "#F0D78C", background: "#1A1A1A" },
    { name: "Noir Gold",  primary: "#C9A84C", accent: "#F0D78C", background: "#0D0D0D" },
    { name: "Cloud",      primary: "#3B82F6", accent: "#94A3B8", background: "#FAFBFC" },
    { name: "Sand",       primary: "#8B7355", accent: "#C9B99A", background: "#FAF8F5" },
    { name: "Terracotta", primary: "#C4654A", accent: "#87A878", background: "#1A0F0A" },
    { name: "Sienna",     primary: "#CD7F32", accent: "#E8C07A", background: "#1A0E08" },
    { name: "Arctic",     primary: "#2E6B8A", accent: "#6BA3C8", background: "#E8F0F8" },
    { name: "Slate",      primary: "#718096", accent: "#A0AEC0", background: "#1A202C" },
    { name: "Coral",      primary: "#FF6B6B", accent: "#574B90", background: "#1A0A14" },
    { name: "Blaze",      primary: "#FF6B35", accent: "#6C5CE7", background: "#14081A" },
    { name: "Blush",      primary: "#9B72CF", accent: "#E8C5D0", background: "#1F1424" },
    { name: "Sage",       primary: "#7D9B76", accent: "#A8C0A0", background: "#0F1A12" },
    { name: "Sky Peach",  primary: "#7DD3FC", accent: "#F9A8A8", background: "#0A1420" },
    { name: "Forest",     primary: "#5A8A5C", accent: "#A0C49D", background: "#0A1A10" },
    { name: "Harvest",    primary: "#D4842A", accent: "#E8B84A", background: "#1A0A05" },
    { name: "Sakura",     primary: "#E88AAB", accent: "#C45C7C", background: "#FEF0F5" },
    { name: "Brutal",     primary: "#FF5722", accent: "#FFEB3B", background: "#FFFFFF" },
    { name: "Vapor",      primary: "#A78BFA", accent: "#67E8F9", background: "#0F0A1F" },
    { name: "Aurora Glass", primary: "#4ADE80", accent: "#A78BFA", background: "#0A0F1F" },
    { name: "Navy Trust", primary: "#3B6FA0", accent: "#E8EDF3", background: "#0F1B3D" },
    { name: "Emerald",    primary: "#0D7A5F", accent: "#C9A84C", background: "#04261C" },
  ];

  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("paletteFavorites") || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem("paletteFavorites", JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (name: string) => {
    setFavorites((f) =>
      f.includes(name) ? f.filter((n) => n !== name) : [...f, name]
    );
  };

  const sortedPresets = [...presets].sort((a, b) => {
    const af = favorites.includes(a.name) ? 0 : 1;
    const bf = favorites.includes(b.name) ? 0 : 1;
    return af - bf;
  });

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
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Presets · {presets.length}
            </span>
            {favorites.length > 0 && (
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
                ★ {favorites.length} fav
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {sortedPresets.map((p) => {
              const isFav = favorites.includes(p.name);
              return (
                <div
                  key={p.name}
                  className="flex items-center gap-2 px-2 py-1.5 brutal hover:glow-ring transition-shadow"
                >
                  <button
                    onClick={() => setPalette({ primary: p.primary, accent: p.accent, background: p.background })}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span className="flex -space-x-1 shrink-0">
                      <span className="w-3 h-3 rounded-full border border-foreground/20" style={{ background: p.background }} />
                      <span className="w-3 h-3 rounded-full border border-foreground/20" style={{ background: p.primary }} />
                      <span className="w-3 h-3 rounded-full border border-foreground/20" style={{ background: p.accent }} />
                    </span>
                    <span className="text-[11px] font-mono truncate">{p.name}</span>
                  </button>
                  <button
                    onClick={() => toggleFavorite(p.name)}
                    aria-label={isFav ? "Unfavorite" : "Favorite"}
                    className="shrink-0 p-0.5"
                  >
                    <Star className={`w-3.5 h-3.5 transition-colors ${isFav ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                </div>
              );
            })}
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

      <div className="brutal p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="autoretry-toggle" className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" /> Auto-retry failed fetches
          </Label>
          <Switch id="autoretry-toggle" checked={autoRetry} onCheckedChange={setAutoRetry} />
        </div>
        <p className="text-xs text-muted-foreground">
          {autoRetry
            ? "Failed and rate-limited UIDs are re-fetched automatically with exponential backoff (up to 8 attempts)."
            : "You'll need to refresh failed UIDs manually."}
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
