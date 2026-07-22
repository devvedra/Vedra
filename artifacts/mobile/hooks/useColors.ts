/**
 * useColors.ts — Vedra Color Hook (v1.0)
 *
 * Returns the active design tokens based on the user's theme preference.
 * Delegates to ThemeContext which handles dark/light/system resolution.
 *
 * Drop-in replacement for the previous useColorScheme-based version.
 */

export { useThemeColors as useColors } from '@/contexts/ThemeContext';
