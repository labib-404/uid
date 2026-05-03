import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type FontSize = "sm" | "md" | "lg";
type ViewMode = "full" | "compact";
type Theme = "dark" | "light";

type Settings = {
  fontSize: FontSize;
  viewMode: ViewMode;
  theme: Theme;
  setFontSize: (s: FontSize) => void;
  setViewMode: (v: ViewMode) => void;
  setTheme: (t: Theme) => void;
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

  useEffect(() => localStorage.setItem("fontSize", fontSize), [fontSize]);
  useEffect(() => localStorage.setItem("viewMode", viewMode), [viewMode]);
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <Ctx.Provider value={{ fontSize, viewMode, theme, setFontSize, setViewMode, setTheme }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSettings = () => useContext(Ctx);