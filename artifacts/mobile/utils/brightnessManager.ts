/**
 * brightnessManager.ts — Vedra v0.6
 *
 * Controls screen brightness using expo-brightness.
 *
 * On Android, setBrightnessAsync controls the current app's window brightness.
 * System-level brightness requires the WRITE_SETTINGS permission which must be
 * granted manually through Settings → Special app access → Modify system settings.
 * If the permission is not granted, we set app-level brightness and show a note.
 */

import { Platform } from 'react-native';
import * as Brightness from 'expo-brightness';

export type BrightnessResult = {
  success: boolean;
  message: string;
  /** Current brightness 0–100 after the action, if known */
  level?: number;
  /** true if we fell back to app-level brightness */
  appLevelOnly?: boolean;
};

const STEP = 0.15; // ~15% per up/down command

/** Increase brightness by one step. */
export async function brightnessUp(): Promise<BrightnessResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const current = await Brightness.getBrightnessAsync();
    const next = Math.min(1, current + STEP);
    await _set(next);
    const pct = Math.round(next * 100);
    return { success: true, message: `Brightness increased to ${pct}%.`, level: pct };
  } catch {
    return { success: false, message: 'Could not change brightness.' };
  }
}

/** Decrease brightness by one step. */
export async function brightnessDown(): Promise<BrightnessResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const current = await Brightness.getBrightnessAsync();
    const next = Math.max(0.05, current - STEP); // never go to 0 (screen goes black)
    await _set(next);
    const pct = Math.round(next * 100);
    return { success: true, message: `Brightness decreased to ${pct}%.`, level: pct };
  } catch {
    return { success: false, message: 'Could not change brightness.' };
  }
}

/** Set brightness to a specific percentage (0–100). */
export async function setBrightnessTo(percent: number): Promise<BrightnessResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const clamped = Math.max(5, Math.min(100, percent)); // min 5% so screen stays visible
    await _set(clamped / 100);
    return { success: true, message: `Brightness set to ${clamped}%.`, level: clamped };
  } catch {
    return { success: false, message: 'Could not set brightness.' };
  }
}

/** Set brightness to minimum (5% — keeps screen on). */
export async function setBrightnessMin(): Promise<BrightnessResult> {
  return setBrightnessTo(5);
}

/** Set brightness to maximum (100%). */
export async function setBrightnessMax(): Promise<BrightnessResult> {
  return setBrightnessTo(100);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _set(value: number): Promise<void> {
  // Try system brightness first; fall back to app-level if not permitted
  try {
    const perm = await Brightness.requestPermissionsAsync();
    if (perm.granted) {
      await Brightness.setSystemBrightnessAsync(value);
      return;
    }
  } catch {
    // Permission not available — fall through
  }
  // App-level brightness (affects only the Vedra window)
  await Brightness.setBrightnessAsync(value);
}

function _notSupported(): BrightnessResult {
  return { success: false, message: 'Brightness control is only supported on Android devices.' };
}
