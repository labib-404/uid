import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type FontSize = "sm" | "md" | "lg";
type ViewMode = "full" | "compact";
type Theme = "dark" | "light";

// Kept for backward compat — only one normal theme now.
export type DesignTheme = "default";
export const DESIGN_THEMES: { id: DesignTheme; label: string; swatch: string }[] = [
  { id: "default", label: "Default", swatch: "#3b82f6" },
];

export type Palette = { primary: string; accent: string; background: string };
export const DEFAULT_PALETTE: Palette = { primary: "#3b82f6", accent: "#22c55e", background: "#0f0f0f" };
export function applyPalette(_p: Palette) { /* no-op in normal mode */ }

type Settings = {
  fontSize: FontSize;
  viewMode: ViewMode;
  theme: Theme;
  designTheme: DesignTheme;
  swipeDelete: boolean;
  autoRetry: boolean;
  palette: Palette;
  setFontSize: (s: FontSize) => void;
  setViewMode: (v: ViewMode) => void;
  setTheme: (t: Theme) => void;
  setDesignTheme: (d: DesignTheme) => void;
  setSwipeDelete: (b: boolean) => void;
  setAutoRetry: (b: boolean) => void;
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
  const [swipeDelete, setSwipeDelete] = useState<boolean>(
    () => localStorage.getItem("swipeDelete") !== "false"
  );
  const [autoRetry, setAutoRetry] = useState<boolean>(
    () => localStorage.getItem("autoRetry") !== "false"
  );

  useEffect(() => localStorage.setItem("fontSize", fontSize), [fontSize]);
  useEffect(() => localStorage.setItem("viewMode", viewMode), [viewMode]);
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);
  useEffect(() => {
    // Strip any legacy theme classes.
    const root = document.documentElement;
    ["theme-paper","theme-midnight","theme-noir","theme-ocean","theme-vapor","theme-forest","theme-sunset","theme-mono"]
      .forEach((c) => root.classList.remove(c));
  }, []);
  useEffect(() => localStorage.setItem("swipeDelete", String(swipeDelete)), [swipeDelete]);
  useEffect(() => localStorage.setItem("autoRetry", String(autoRetry)), [autoRetry]);

  return (
    <Ctx.Provider value={{
      fontSize, viewMode, theme, designTheme: "default", swipeDelete, autoRetry, palette: DEFAULT_PALETTE,
      setFontSize, setViewMode, setTheme,
      setDesignTheme: () => {},
      setSwipeDelete, setAutoRetry,
      setPalette: () => {}, resetPalette: () => {},
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() { return useContext(Ctx); }
