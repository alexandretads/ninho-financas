import React from "react";

type Theme = "dark" | "light";
const THEME_KEY = "ninho:tema";
const LEGACY_THEME_KEY = "prumo:tema";

type ThemeValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeValue | null>(null);

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // usa o padrão
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme);

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignora armazenamento indisponível
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b100d" : "#f3f5ec");
  }, [theme]);

  const value = React.useMemo<ThemeValue>(
    () => ({ theme, setTheme: setThemeState }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme precisa estar dentro de ThemeProvider");
  return context;
}
