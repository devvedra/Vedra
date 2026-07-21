/**
 * phoneCall.ts — Vedra Phone Call Module
 *
 * Initiates phone calls via Android's native calling APIs. Works 100% offline.
 *
 * ── Two-stage approach ────────────────────────────────────────────────────────
 *
 *  Stage 1 — Direct call (android.intent.action.CALL)
 *    Requires the CALL_PHONE runtime permission. Initiates the call immediately
 *    without asking the user to tap "Call" on the dialer screen. This is the
 *    preferred path for a hands-free voice assistant.
 *
 *  Stage 2 — Dialer fallback (android.intent.action.DIAL / tel: URL)
 *    Used when the user denies CALL_PHONE or on non-Android platforms. Opens the
 *    system dialer with the number pre-filled; the user taps Call to confirm.
 *    Requires no special permission beyond what the OS already provides.
 *
 * ── Platform behaviour ────────────────────────────────────────────────────────
 *  Android  → Stage 1 attempted; Stage 2 if permission denied
 *  iOS/web  → Stage 2 only (ACTION_CALL is Android-specific)
 */

import { Linking, PermissionsAndroid, Platform } from 'react-native';

// ── Dynamic import guard ──────────────────────────────────────────────────────
// expo-intent-launcher requires native Android code. Load dynamically so the
// module doesn't crash in the Expo Go / web preview.
let IntentLauncher: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  IntentLauncher = require('expo-intent-launcher');
} catch {
  IntentLauncher = null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CallResult =
  | { success: true; method: 'direct' | 'dialer' }
  | {
      success: false;
      reason: 'permission_denied' | 'error' | 'unavailable';
      message: string;
    };

// ── Permission ─────────────────────────────────────────────────────────────────

/**
 * Request the CALL_PHONE runtime permission on Android.
 * Returns true if granted, false if denied.
 * On non-Android platforms always returns true (calls use the OS tel: handler).
 */
export async function requestCallPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      {
        title: 'Phone Call Permission',
        message:
          'Vedra needs permission to make phone calls directly. ' +
          'Without it, the dialer will open and you will need to tap Call.',
        buttonPositive: 'Allow direct calls',
        buttonNegative: 'Use dialer instead',
        buttonNeutral: 'Ask me later',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Check whether CALL_PHONE is already granted without prompting.
 */
export async function hasCallPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const result = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
    );
    return result;
  } catch {
    return false;
  }
}

// ── Calling ───────────────────────────────────────────────────────────────────

/**
 * Initiate a phone call to `phoneNumber`.
 *
 * Tries ACTION_CALL first (direct, hands-free), falls back to the dialer
 * if permission is denied. Always resolves — never throws.
 *
 * @param phoneNumber - Raw number from contacts (may contain spaces/dashes)
 */
export async function initiateCall(phoneNumber: string): Promise<CallResult> {
  // Strip formatting characters so the URI is clean
  const cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');

  if (Platform.OS === 'android') {
    return initiateAndroidCall(cleaned);
  }

  // iOS / web: open the tel: URL (system handles the rest)
  return openDialer(cleaned);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Android-specific calling path with permission + intent. */
async function initiateAndroidCall(cleaned: string): Promise<CallResult> {
  // Prefer direct call if permission is already granted to skip dialog
  const alreadyGranted = await hasCallPermission();

  if (alreadyGranted) {
    return callViaIntent(cleaned);
  }

  // First use — ask for permission
  const granted = await requestCallPermission();

  if (granted) {
    return callViaIntent(cleaned);
  }

  // Permission denied → fall back to dialer (still useful!)
  return openDialer(cleaned);
}

/**
 * Fire android.intent.action.CALL via expo-intent-launcher.
 * Requires CALL_PHONE permission to have been granted already.
 */
async function callViaIntent(cleaned: string): Promise<CallResult> {
  if (!IntentLauncher) {
    // Native module unavailable (Expo Go / web) → dialer fallback
    return openDialer(cleaned);
  }

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.CALL', {
      data: `tel:${cleaned}`,
    });
    return { success: true, method: 'direct' };
  } catch (err: any) {
    // Intent failed (e.g. flight mode, SIM missing) → try dialer
    return openDialer(cleaned);
  }
}

/**
 * Open the system phone dialer with the number pre-filled.
 * No special permission required — works everywhere.
 */
async function openDialer(cleaned: string): Promise<CallResult> {
  try {
    const url = `tel:${cleaned}`;
    const can = await Linking.canOpenURL(url);
    if (!can) {
      return {
        success: false,
        reason: 'unavailable',
        message: 'No phone dialer found on this device.',
      };
    }
    await Linking.openURL(url);
    return { success: true, method: 'dialer' };
  } catch (err: any) {
    return {
      success: false,
      reason: 'error',
      message: err?.message ?? 'Could not open the phone dialer.',
    };
  }
}
