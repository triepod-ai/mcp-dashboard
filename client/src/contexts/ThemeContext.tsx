import React, { useEffect, useState } from "react";
import { ThemeContext, type Theme, type ThemeContextType } from "./theme-context";

// Export ThemeContext for other components to use
export { ThemeContext, type Theme, type ThemeContextType };

/* Moved to @/hooks/useTheme.ts for React fast refresh
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

*/

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = "system",
  storageKey = "mcp-dashboard-theme",
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey) as Theme;
      return stored || defaultTheme;
    }
    return defaultTheme;
  });

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");

  // Update effective theme based on current theme and system preference
  useEffect(() => {
    const updateEffectiveTheme = () => {
      const root = window.document.documentElement;

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        setEffectiveTheme(systemTheme);
        root.classList.remove("light", "dark");
        root.classList.add(systemTheme);
      } else {
        setEffectiveTheme(theme);
        root.classList.remove("light", "dark");
        root.classList.add(theme);
      }
    };

    updateEffectiveTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        updateEffectiveTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Persist theme to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  const value: ThemeContextType = {
    theme,
    setTheme,
    effectiveTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};