import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

type MainScreenThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: Dispatch<SetStateAction<ThemePreference>>;
};

const MainScreenThemeContext = createContext<MainScreenThemeContextValue | null>(null);

type MainScreenThemeProviderProps = {
  children: ReactNode;
  value: MainScreenThemeContextValue;
};

export function MainScreenThemeProvider({ children, value }: MainScreenThemeProviderProps) {
  return <MainScreenThemeContext.Provider value={value}>{children}</MainScreenThemeContext.Provider>;
}

export function useMainScreenTheme() {
  const context = useContext(MainScreenThemeContext);
  if (!context) {
    throw new Error("useMainScreenTheme must be used within MainScreenThemeProvider");
  }
  return context;
}

export function resolveThemePreference(
  themePreference: ThemePreference,
  systemColorScheme: "light" | "dark" | null | undefined,
): ResolvedTheme {
  if (themePreference === "system") {
    return systemColorScheme === "dark" ? "dark" : "light";
  }

  return themePreference;
}

export function pickThemeValue<T>(resolvedTheme: ResolvedTheme, lightValue: T, darkValue: T): T {
  return resolvedTheme === "dark" ? darkValue : lightValue;
}
