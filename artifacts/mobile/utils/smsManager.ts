/**
 * smsManager.ts — Vedra SMS Module (v0.4)
 *
 * Sends SMS messages via Android's native SMS APIs. Works 100% offline.
 *
 * ── Approach ──────────────────────────────────────────────────────────────────
 *
 *  Stage 1 — expo-sms (sendSMSAsync)
 *    Opens the native SMS compose screen pre-filled with recipient and message.
 *    The user taps Send in their SMS app to confirm dispatch.
 *
 *  Stage 2 — sms: URI via Linking
 *    Fallback if expo-sms reports unavailable. Pre-fills the default SMS app
 *    via the sms: URI scheme (works on virtually all Android devices).
 *
 * ── Permission ────────────────────────────────────────────────────────────────
 *  SEND_SMS is declared in the manifest. requestSmsPermission() must be called
 *  before sending so Android grants access and the permission dialog is shown.
 */

import { Linking, PermissionsAndroid, Platform } from 'react-native';
import * as SMS from 'expo-sms';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SmsResult =
  | { success: true; method: 'sms_app' }
  | {
      success: false;
      reason: 'permission_denied' | 'unavailable' | 'cancelled' | 'error';
      message: string;
    };

// ── Permission ─────────────────────────────────────────────────────────────────

/**
 * Request the SEND_SMS runtime permission on Android.
 * Returns true if granted (or already granted), false if denied.
 * On non-Android platforms always returns true.
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const current = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
    );
    if (current) return true;

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'SMS Permission',
        message: 'Vedra needs permission to send SMS messages on your behalf.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
        buttonNeutral: 'Ask me later',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// ── Send ──────────────────────────────────────────────────────────────────────

/**
 * Send an SMS to `phoneNumber` with `message` as the body.
 *
 * Opens the native SMS compose screen pre-filled with recipient + message.
 * Always resolves — never throws.
 *
 * @param phoneNumber - Raw number from contacts (may contain spaces/dashes)
 * @param message     - The text body to send
 */
export async function sendSms(
  phoneNumber: string,
  message: string,
): Promise<SmsResult> {
  // Normalise number: strip spaces, dashes, brackets
  const cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');

  // Stage 1: expo-sms compose screen (richest UX)
  try {
    const available = await SMS.isAvailableAsync();
    if (available) {
      const { result } = await SMS.sendSMSAsync([cleaned], message);
      if (result === 'sent' || result === 'unknown') {
        return { success: true, method: 'sms_app' };
      }
      // User tapped cancel in the compose screen
      return {
        success: false,
        reason: 'cancelled',
        message: 'SMS was cancelled.',
      };
    }
  } catch {
    // Native module unavailable — fall through to Linking
  }

  // Stage 2: sms: URI via Linking (universal fallback)
  try {
    const sep = Platform.OS === 'ios' ? '&' : '?';
    const url = `sms:${cleaned}${sep}body=${encodeURIComponent(message)}`;
    const can = await Linking.canOpenURL(url);
    if (!can) {
      return {
        success: false,
        reason: 'unavailable',
        message: 'No SMS app found on this device.',
      };
    }
    await Linking.openURL(url);
    return { success: true, method: 'sms_app' };
  } catch (err: any) {
    return {
      success: false,
      reason: 'error',
      message: err?.message ?? 'Could not open SMS app.',
    };
  }
}
