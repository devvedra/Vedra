/**
 * notificationManager.ts — Vedra Local Notification Manager
 *
 * Wraps expo-notifications to:
 *  • Request permission on Android
 *  • Create notification channels (Android 8+)
 *  • Schedule one-off local notifications (for timers & reminders)
 *  • Cancel scheduled notifications
 *
 * All operations are no-ops on web (Expo Go web preview doesn't support
 * local notifications).
 */

import { Platform } from 'react-native';

// Dynamic import guard — expo-notifications requires native linking.
// This keeps the web preview functional even without notifications.
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

// ── Channel IDs ────────────────────────────────────────────────────────────

export const CHANNEL_TIMERS     = 'vedra-timers';
export const CHANNEL_REMINDERS  = 'vedra-reminders';
export const CHANNEL_ALARMS     = 'vedra-alarms';

// ── Initialisation ─────────────────────────────────────────────────────────

let initialised = false;

/**
 * Call once at app startup (_layout.tsx).
 * Requests permissions and registers Android notification channels.
 * Safe to call multiple times (idempotent after first call).
 */
export async function initNotifications(): Promise<void> {
  if (initialised || !Notifications || Platform.OS === 'web') return;
  initialised = true;

  // Set default handler so notifications display while app is foregrounded
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Request permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }

  // Register Android channels
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_TIMERS, {
      name: 'Timers',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_ALARMS, {
      name: 'Alarms',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 200, 500],
    });
  }
}

// ── Schedule ───────────────────────────────────────────────────────────────

export interface ScheduleOptions {
  title: string;
  body: string;
  triggerMs: number;   // absolute timestamp (Date.now() + delay)
  channelId?: string;
  data?: Record<string, unknown>;
}

/**
 * Schedule a local notification to fire at `triggerMs`.
 * Returns the notification identifier (use to cancel later), or null on web.
 */
export async function scheduleNotification(opts: ScheduleOptions): Promise<string | null> {
  if (!Notifications || Platform.OS === 'web') return null;

  const delaySeconds = Math.max(1, Math.round((opts.triggerMs - Date.now()) / 1_000));

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      sound: 'default',
      data: opts.data ?? {},
      ...(Platform.OS === 'android' && { channelId: opts.channelId ?? CHANNEL_REMINDERS }),
    },
    trigger: { seconds: delaySeconds, repeats: false },
  });

  return id as string;
}

/**
 * Cancel a previously scheduled notification by its ID.
 * Safe to call with null (no-op).
 */
export async function cancelNotification(notificationId: string | null): Promise<void> {
  if (!notificationId || !Notifications || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already fired or invalid ID — ignore
  }
}

/**
 * Cancel all scheduled notifications from Vedra.
 */
export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications || Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
