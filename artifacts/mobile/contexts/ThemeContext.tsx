/**
 * ThemeContext.tsx — Vedra Theme Provider (v1.0)
 *
 * Provides the active color palette throughout the app.
 * Reads the user's theme preference from settings; falls back to
 * the system color scheme when set to 'system'.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';
import { getSettings, updateSettings, type ThemeMode } from '@/utils/settingsStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorPalette = typeof colors.light;

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => Promise<void>;
  colors: ColorPalette;
  isDark: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme:    'dark',
  setTheme: async () => {},
  colors:   colors.light,
  isDark:   true,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'dark' | 'light' | null
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  // Load saved preference on mount
  useEffect(() => {
    getSettings().then(s => setThemeState(s.theme ?? 'dark')).catch(() => {});
  }, []);

  const setTheme = async (mode: ThemeMode): Promise<void> => {
    setThemeState(mode);
    await updateSettings({ theme: mode });
  };

  // Resolve which palette to use
  const effectiveScheme =
    theme === 'system'
      ? (systemScheme ?? 'dark')
      : theme;

  const palette: ColorPalette =
    effectiveScheme === 'light'
      ? colors.lightMode
      : colors.dark;

  const isDark = effectiveScheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors: palette, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Returns the active design token palette. */
export function useThemeColors(): ColorPalette & { radius: number } {
  const { colors: palette } = useContext(ThemeContext);
  return { ...palette, radius: colors.radius };
}

/** Returns full theme context. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
