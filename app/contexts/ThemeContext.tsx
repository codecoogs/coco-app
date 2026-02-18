"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

const THEME_COOKIE = "coco-theme";
const THEME_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year
const STORAGE_KEY = "coco-theme";

type ThemeContextValue = {
  /** User preference: light, dark, or system. */
  theme: Theme;
  /** Effective theme applied to the document (light or dark). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Cycle: system → light → dark → system. */
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readThemeFromCookie(): Theme | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${THEME_COOKIE}=`));
  const value = match?.split("=")[1];
  return value === "light" || value === "dark" || value === "system"
    ? value
    : null;
}

function readThemeFromStorage(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : null;
  } catch {
    return null;
  }
}

function persistTheme(theme: Theme) {
  try {
    const value = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
    document.cookie = value;
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    getSystemTheme(),
  );

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      persistTheme(next);
      const resolved = next === "system" ? systemTheme : next;
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    },
    [systemTheme],
  );

  const cycleTheme = useCallback(() => {
    const next: Theme =
      theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
  }, [theme, setTheme]);

  // Hydrate from cookie/storage and listen to system preference
  useEffect(() => {
    const stored = readThemeFromCookie() ?? readThemeFromStorage() ?? "system";
    setThemeState(stored);
    const resolved = stored === "system" ? getSystemTheme() : stored;
    setResolvedTheme(resolved);
    setSystemTheme(getSystemTheme());
    applyResolvedTheme(resolved);
  }, []);

  // Sync system theme when preference is "system"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next = mq.matches ? "dark" : "light";
      setSystemTheme(next);
      if (theme === "system") {
        setResolvedTheme(next);
        applyResolvedTheme(next);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, cycleTheme }),
    [theme, resolvedTheme, setTheme, cycleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

export function useThemeOptional() {
  return useContext(ThemeContext);
}
