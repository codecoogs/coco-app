"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme =
  | "system"
  | "light"
  | "dark"
  | "latte"
  | "frappe"
  | "macchiato"
  | "mocha";

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
  /** Cycle through available themes. */
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
  return value === "system" ||
    value === "light" ||
    value === "dark" ||
    value === "latte" ||
    value === "frappe" ||
    value === "macchiato" ||
    value === "mocha"
    ? (value as Theme)
    : null;
}

function readThemeFromStorage(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored === "system" ||
      stored === "light" ||
      stored === "dark" ||
      stored === "latte" ||
      stored === "frappe" ||
      stored === "macchiato" ||
      stored === "mocha"
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

function themeToResolved(theme: Theme, systemTheme: ResolvedTheme): ResolvedTheme {
  if (theme === "system") return systemTheme;
  if (
    theme === "dark" ||
    theme === "frappe" ||
    theme === "macchiato" ||
    theme === "mocha"
  )
    return "dark";
  return "light";
}

function applyThemeToDocument(theme: Theme, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("theme-latte", theme === "latte");
  root.classList.toggle("theme-frappe", theme === "frappe");
  root.classList.toggle("theme-macchiato", theme === "macchiato");
  root.classList.toggle("theme-mocha", theme === "mocha");
  root.setAttribute("data-theme", theme);
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
      const resolved = themeToResolved(next, systemTheme);
      setResolvedTheme(resolved);
      applyThemeToDocument(next, resolved);
    },
    [systemTheme],
  );

  const cycleTheme = useCallback(() => {
    const order: Theme[] = [
      "system",
      "light",
      "latte",
      "frappe",
      "macchiato",
      "mocha",
      "dark",
    ];
    const i = order.indexOf(theme);
    const next = order[(i + 1) % order.length] ?? "system";
    setTheme(next);
  }, [theme, setTheme]);

  // Hydrate from cookie/storage and listen to system preference
  useEffect(() => {
    const stored = readThemeFromCookie() ?? readThemeFromStorage() ?? "system";
    setThemeState(stored);
    const sys = getSystemTheme();
    const resolved = themeToResolved(stored, sys);
    setResolvedTheme(resolved);
    setSystemTheme(sys);
    applyThemeToDocument(stored, resolved);
  }, []);

  // Sync system theme when preference is "system"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next = mq.matches ? "dark" : "light";
      setSystemTheme(next);
      if (theme === "system") {
        setResolvedTheme(next);
        applyThemeToDocument(theme, next);
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
