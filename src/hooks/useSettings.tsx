import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type FontSize = "sm" | "md" | "lg";
type ViewMode = "full" | "compact";
type Theme = "dark" | "light";
export type DesignTheme = "paper" | "midnight" | "noir" | "ocean";

export const DESIGN_THEMES: { id: DesignTheme; label: string; swatch: string }[] = [
  { id: "paper",    label: "Paper",    swatch: "#c4654a" },
  { id: "midnight", label: "Midnight", swatch: "#2BE5A8" },
  { id: "noir",     label: "Noir",     swatch: "#d4a838" },
  { id: "ocean",    label: "Ocean",    swatch: "#1e88c4" },
];

export type Palette = {
  primary: string;   // hex
  accent: string;    // hex
  background: string;// hex
};

export const DEFAULT_PALETTE: Palette = {
  primary: "#2BE5A8",
  accent: "#B98BFF",
  background: "#0B0B14",
};

function hexToHsl(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyPalette(p: Palette) {
  const root = document.documentElement;
  const bg = hexToHsl(p.background);
  const pr = hexToHsl(p.primary);
  const ac = hexToHsl(p.accent);
  // Derive foreground (light if bg dark)
  const lightness = parseInt(bg.split(" ")[2]);
  const fg = lightness < 50 ? "220 30% 96%" : "240 10% 4%";
  root.style.setProperty("--background", bg);
  root.style.setProperty("--foreground", fg);
  root.style.setProperty("--primary", pr);
  root.style.setProperty("--ring", pr);
  root.style.setProperty("--accent", ac);
}

type Settings = {
  fontSize: FontSize;
  viewMode: ViewMode;
  theme: Theme;
  designTheme: DesignTheme;
  swipeDelete: boolean;
  palette: Palette;
  setFontSize: (s: FontSize) => void;
  setViewMode: (v: ViewMode) => void;
  setTheme: (t: Theme) => void;
  setDesignTheme: (d: DesignTheme) => void;
  setSwipeDelete: (b: boolean) => void;
  setPalette: (p: Palette) => void;
  resetPalette: () => void;
};

const Ctx = createContext<Settings>({} as Settings);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState<FontSize>(
    () => (localStorage.getItem("fontSize") as FontSize) || "md"
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("viewMode") as ViewMode) || "full"
  );
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "dark"
  );
  const [designTheme, setDesignTheme] = useState<DesignTheme>(
    () => (localStorage.getItem("designTheme") as DesignTheme) || "paper"
  );
  const [swipeDelete, setSwipeDelete] = useState<boolean>(
    () => localStorage.getItem("swipeDelete") !== "false"
  );
  const [palette, setPalette] = useState<Palette>(() => {
    try {
      const raw = localStorage.getItem("palette");
      return raw ? { ...DEFAULT_PALETTE, ...JSON.parse(raw) } : DEFAULT_PALETTE;
    } catch { return DEFAULT_PALETTE; }
  });

  useEffect(() => localStorage.setItem("fontSize", fontSize), [fontSize]);
  useEffect(() => localStorage.setItem("viewMode", viewMode), [viewMode]);
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("designTheme", designTheme);
    const root = document.documentElement;
    ["theme-paper", "theme-midnight", "theme-noir", "theme-ocean"].forEach((c) =>
      root.classList.remove(c)
    );
    if (designTheme !== "paper") root.classList.add(`theme-${designTheme}`);
  }, [designTheme]);
  useEffect(() => localStorage.setItem("swipeDelete", String(swipeDelete)), [swipeDelete]);
  useEffect(() => {
    localStorage.setItem("palette", JSON.stringify(palette));
    applyPalette(palette);
  }, [palette]);

  return (
    <Ctx.Provider value={{ fontSize, viewMode, theme, designTheme, swipeDelete, palette, setFontSize, setViewMode, setTheme, setDesignTheme, setSwipeDelete, setPalette, resetPalette: () => setPalette(DEFAULT_PALETTE) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSettings = () => useContext(Ctx);