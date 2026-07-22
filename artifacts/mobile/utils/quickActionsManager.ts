/**
 * quickActionsManager.ts — Vedra v0.7
 *
 * Executes system-level quick actions using expo-intent-launcher and
 * official Android Intent actions.
 *
 * Android restrictions:
 *  • Expanding the status bar / opening notification shade programmatically
 *    requires EXPAND_STATUS_BAR permission — available in non-system apps but
 *    may be restricted in future versions.
 *  • Opening Recent Apps / triggering TOGGLE_RECENTS requires the app to be a
 *    system/privileged app on Android 9+. We guide the user accordingly.
 *  • Go Home, Wi-Fi/Bluetooth/Display settings — fully supported.
 */

import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export type QuickActionResult = {
  success: boolean;
  message: string;
  openedSettings?: boolean;
};

// ── Open Recent Apps ──────────────────────────────────────────────────────────

export async function openRecentApps(): Promise<QuickActionResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    // ACTION_RECENTS_ACTIVITY or TOGGLE_RECENTS — requires REORDER_TASKS or
    // system privilege on Android 9+. We try and fall back gracefully.
    await IntentLauncher.startActivityAsync('com.android.systemui.recents.RecentsActivity');
    return { success: true, message: 'Opening recent apps.' };
  } catch {
    return {
      success: false,
      message: 'Opening the recent apps screen requires system access on Android 9 and above. Press your device\'s Recents button instead.',
    };
  }
}

// ── Go Home ───────────────────────────────────────────────────────────────────

export async function goHome(): Promise<QuickActionResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
      category: 'android.intent.category.HOME',
      flags: 0x10000000, // FLAG_ACTIVITY_NEW_TASK
    });
    return { success: true, message: 'Going to the home screen.' };
  } catch {
    return {
      success: false,
      message: 'Could not go to the home screen. Please press your Home button.',
    };
  }
}

// ── Open Notifications ────────────────────────────────────────────────────────

export async function openNotifications(): Promise<QuickActionResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const { NativeModules } = await import('react-native');
    // StatusBarManager has an `expandNotificationsPanel` method on Android
    if (NativeModules?.StatusBarManager?.expandNotificationsPanel) {
      NativeModules.StatusBarManager.expandNotificationsPanel();
      return { success: true, message: 'Opening notifications panel.' };
    }
    throw new Error('Not available');
  } catch {
    // Fallback: open notification settings
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.NOTIFICATION_SETTINGS,
      );
      return {
        success: true,
        message: 'Could not expand the notification shade directly. Opening notification settings.',
        openedSettings: true,
      };
    } catch {
      return {
        success: false,
        message: 'Could not open notifications. Swipe down from the top of your screen.',
      };
    }
  }
}

// ── Open Quick Settings ───────────────────────────────────────────────────────

export async function openQuickSettings(): Promise<QuickActionResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const { NativeModules } = await import('react-native');
    if (NativeModules?.StatusBarManager?.expandSettingsPanel) {
      NativeModules.StatusBarManager.expandSettingsPanel();
      return { success: true, message: 'Opening quick settings.' };
    }
    throw new Error('Not available');
  } catch {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SETTINGS);
      return {
        success: true,
        message: 'Could not open quick settings panel directly. Opening Settings instead.',
        openedSettings: true,
      };
    } catch {
      return {
        success: false,
        message: 'Could not open quick settings. Swipe down twice from the top of your screen.',
      };
    }
  }
}

// ── Open App Info ─────────────────────────────────────────────────────────────

const APP_PACKAGES: Record<string, string> = {
  whatsapp:   'com.whatsapp',
  gmail:      'com.google.android.gm',
  chrome:     'com.android.chrome',
  youtube:    'com.google.android.youtube',
  maps:       'com.google.android.apps.maps',
  spotify:    'com.spotify.music',
  instagram:  'com.instagram.android',
  facebook:   'com.facebook.katana',
  twitter:    'com.twitter.android',
  telegram:   'org.telegram.messenger',
  netflix:    'com.netflix.mediaclient',
};

export async function openAppInfo(appName: string): Promise<QuickActionResult> {
  if (Platform.OS !== 'android') return _notSupported();

  const pkg = APP_PACKAGES[appName.toLowerCase()] ?? null;
  if (!pkg) {
    return {
      success: false,
      message: `I don't have the package name for ${appName}. Try saying "Open app info for WhatsApp" or similar.`,
    };
  }

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${pkg}` },
    );
    return {
      success: true,
      message: `Opening app info for ${appName}.`,
      openedSettings: true,
    };
  } catch {
    return {
      success: false,
      message: `Could not open app info for ${appName}.`,
    };
  }
}

// ── Settings shortcuts ────────────────────────────────────────────────────────

export async function openWifiSettings(): Promise<QuickActionResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.WIFI_SETTINGS);
    return { success: true, message: 'Opening Wi-Fi settings.', openedSettings: true };
  } catch {
    return { success: false, message: 'Could not open Wi-Fi settings.' };
  }
}

export async function openBluetoothSettings(): Promise<QuickActionResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.BLUETOOTH_SETTINGS);
    return { success: true, message: 'Opening Bluetooth settings.', openedSettings: true };
  } catch {
    return { success: false, message: 'Could not open Bluetooth settings.' };
  }
}

export async function openDisplaySettings(): Promise<QuickActionResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.DISPLAY_SETTINGS);
    return { success: true, message: 'Opening display settings.', openedSettings: true };
  } catch {
    return { success: false, message: 'Could not open display settings.' };
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function _notSupported(): QuickActionResult {
  return { success: false, message: 'Quick actions are only supported on Android devices.' };
}
