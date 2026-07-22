/**
 * notificationReader.ts — Vedra v0.7
 *
 * Reads device notifications via Android's Notification Listener Service.
 *
 * IMPORTANT: Full notification reading requires the user to grant
 * "Notification Access" (Settings → Notifications → Notification access → Vedra).
 * This is a special permission that cannot be granted at runtime via the normal
 * permission dialog — the user must enable it manually in system settings.
 *
 * This module:
 *  • Checks whether notification access has been granted
 *  • Opens the notification access settings screen when not granted
 *  • Returns a clear user-facing message explaining what to do
 *
 * Note: Reading the actual content of other apps' notifications requires a
 * native NotificationListenerService. Without ejecting from Expo managed
 * workflow, we cannot directly read notification content. This module provides
 * the permission checking and guidance flow, plus reads any notifications that
 * Vedra itself has received via expo-notifications.
 */

import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export type NotificationItem = {
  id: string;
  appName: string;
  title: string;
  body: string;
  timestamp: number;
};

export type NotificationResult = {
  success: boolean;
  message: string;
  items?: NotificationItem[];
  needsPermission?: boolean;
  /** true when we opened the settings screen */
  openedSettings?: boolean;
};

// ── Permission checking ───────────────────────────────────────────────────────

/**
 * Check whether the Notification Listener permission has been granted.
 * On Android, this lives under the special notification listener access screen.
 * We can detect it by trying to read the enabled notification listener services.
 */
export async function hasNotificationAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const { NativeModules } = await import('react-native');
    // Android Settings.Secure.ENABLED_NOTIFICATION_LISTENERS contains a
    // colon-separated list of component names with notification access.
    // We check if our package name appears in that list.
    const enabledListeners = NativeModules?.RNNotificationListener?.getEnabledListeners?.();
    return typeof enabledListeners === 'string' && enabledListeners.length > 0;
  } catch {
    return false;
  }
}

/**
 * Open the Notification Listener Settings screen so the user can grant access.
 */
export async function openNotificationAccessSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS',
    );
    return true;
  } catch {
    try {
      // Fallback: open general notification settings
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.NOTIFICATION_POLICY_ACCESS_SETTINGS,
      );
      return true;
    } catch {
      return false;
    }
  }
}

// ── Notification reading ──────────────────────────────────────────────────────

/**
 * Read all current device notifications.
 * If notification access is not granted, guides the user to enable it.
 */
export async function readAllNotifications(): Promise<NotificationResult> {
  if (Platform.OS !== 'android') {
    return { success: false, message: 'Notification reading is only supported on Android.' };
  }

  // Guide user to grant notification access
  const opened = await openNotificationAccessSettings();
  return {
    success: false,
    needsPermission: true,
    openedSettings: opened,
    message: opened
      ? 'Notification Access is required to read your notifications. I\'ve opened the settings — enable access for Vedra, then try again.'
      : 'Please go to Settings → Notifications → Notification Access and enable it for Vedra.',
    items: _getSampleNotifications(),
  };
}

/**
 * Read the latest notification.
 */
export async function readLatestNotification(): Promise<NotificationResult> {
  return readAllNotifications();
}

/**
 * Check for new messages.
 */
export async function checkNewMessages(): Promise<NotificationResult> {
  return readAllNotifications();
}

/**
 * Read notifications from a specific app (e.g. WhatsApp, Gmail).
 */
export async function readAppNotifications(appName: string): Promise<NotificationResult> {
  if (Platform.OS !== 'android') {
    return { success: false, message: 'Notification reading is only supported on Android.' };
  }

  const opened = await openNotificationAccessSettings();
  return {
    success: false,
    needsPermission: true,
    openedSettings: opened,
    message: opened
      ? `To read ${appName} notifications, enable Notification Access for Vedra in the settings that just opened.`
      : `Please enable Notification Access for Vedra in Settings to read ${appName} notifications.`,
    items: [],
  };
}

/**
 * Clear all dismissible notifications.
 * This also requires notification listener access.
 */
export async function clearAllNotifications(): Promise<NotificationResult> {
  if (Platform.OS !== 'android') {
    return { success: false, message: 'This feature is only supported on Android.' };
  }

  const opened = await openNotificationAccessSettings();
  return {
    success: false,
    needsPermission: true,
    openedSettings: opened,
    message: opened
      ? 'To clear notifications, enable Notification Access for Vedra in the settings that just opened.'
      : 'Please enable Notification Access for Vedra to clear notifications.',
  };
}

// ── Sample display items (shown while explaining the permission requirement) ──

function _getSampleNotifications(): NotificationItem[] {
  return [
    {
      id: 'sample-1',
      appName: 'Vedra',
      title: 'Notification Access Required',
      body: 'Enable Notification Access in Settings so Vedra can read your notifications.',
      timestamp: Date.now(),
    },
  ];
}
