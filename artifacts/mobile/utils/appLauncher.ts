/**
 * appLauncher.ts — Vedra App Launcher
 *
 * Launches an Android app from an AppDefinition using expo-intent-launcher.
 * Everything here is purely local — no network calls are made.
 *
 * On non-Android platforms (iOS, web preview) the launcher returns a
 * graceful "not_android" result so the UI can still render correctly.
 *
 * ── How it works ─────────────────────────────────────────────────────────────
 *
 * Android supports two ways to open an app:
 *
 *   1. Intent action  — fires a well-known system intent (e.g.
 *      "android.media.action.STILL_IMAGE_CAMERA"). Works regardless of which
 *      app handles the action, so the user's preferred camera / browser opens.
 *      Used for: Camera, Settings.
 *
 *   2. Package name   — opens the main launcher activity for a specific APK.
 *      For apps that ship under different package names on different devices
 *      (calculators, file managers, galleries…) we try a list of known
 *      packages in order and use the first one that is installed.
 *
 * If none of the attempted launches succeed the function returns
 * { success: false, reason: 'not_installed' }.
 */

import { Platform } from 'react-native';
import type { AppDefinition } from './commandParser';

// ── Dynamic import guard ──────────────────────────────────────────────────────
// expo-intent-launcher requires native Android code and is not available in
// the web preview. Load it dynamically so the rest of the UI still renders.
let IntentLauncher: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  IntentLauncher = require('expo-intent-launcher');
} catch {
  IntentLauncher = null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type LaunchResult =
  | { success: true }
  | {
      success: false;
      /** Why the launch failed */
      reason: 'not_android' | 'not_installed' | 'launcher_unavailable' | 'error';
      /** Human-readable explanation for logging / debugging */
      message: string;
    };

// ── Constants ─────────────────────────────────────────────────────────────────

// android.intent.action.MAIN — start the app's launcher activity
const INTENT_ACTION_MAIN = 'android.intent.action.MAIN';
// android.intent.category.LAUNCHER — required so the system knows we want the main entry point
const CATEGORY_LAUNCHER = 'android.intent.category.LAUNCHER';
// Intent.FLAG_ACTIVITY_NEW_TASK — open in a new task (standard for external launches)
const FLAG_ACTIVITY_NEW_TASK = 268435456;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Launch the Android app described by `app`.
 *
 * @returns LaunchResult — always resolves, never rejects.
 */
export async function launchApp(app: AppDefinition): Promise<LaunchResult> {
  // Guard: only supported on Android
  if (Platform.OS !== 'android') {
    return {
      success: false,
      reason: 'not_android',
      message: 'App launching requires Android.',
    };
  }

  // Guard: native module not loaded (Expo Go / web)
  if (!IntentLauncher) {
    return {
      success: false,
      reason: 'launcher_unavailable',
      message: 'expo-intent-launcher is not available in this environment.',
    };
  }

  // ── Strategy 1: Intent action (Camera, Settings…) ─────────────────────────
  if (app.intentAction) {
    return attemptIntentAction(app.intentAction);
  }

  // ── Strategy 2: Single package name ───────────────────────────────────────
  if (app.packageName) {
    return attemptPackageLaunch(app.packageName);
  }

  // ── Strategy 3: Try multiple package names in order ───────────────────────
  if (app.packageOptions && app.packageOptions.length > 0) {
    for (const pkg of app.packageOptions) {
      const result = await attemptPackageLaunch(pkg);
      if (result.success) return result;
    }
  }

  return {
    success: false,
    reason: 'not_installed',
    message: `${app.displayName} could not be found on this device.`,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Fire an Android intent action (no package name required). */
async function attemptIntentAction(action: string): Promise<LaunchResult> {
  try {
    await IntentLauncher.startActivityAsync(action);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      reason: 'error',
      message: err?.message ?? `Failed to fire intent: ${action}`,
    };
  }
}

/** Launch the main launcher activity for a given Android package. */
async function attemptPackageLaunch(packageName: string): Promise<LaunchResult> {
  try {
    await IntentLauncher.startActivityAsync(INTENT_ACTION_MAIN, {
      packageName,
      flags: FLAG_ACTIVITY_NEW_TASK,
      category: CATEGORY_LAUNCHER,
    });
    return { success: true };
  } catch {
    // App not installed or not launchable — caller will try the next option
    return {
      success: false,
      reason: 'not_installed',
      message: `Package ${packageName} is not installed.`,
    };
  }
}
