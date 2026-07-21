/**
 * connectivityManager.ts — Vedra v0.6
 *
 * Handles Wi-Fi and Bluetooth control.
 *
 * Android 10+ policy: Apps can no longer programmatically toggle Wi-Fi or
 * Bluetooth without user interaction (Google removed the APIs for security).
 * Vedra opens the correct Settings panel so the user can make the change,
 * and speaks a clear explanation.
 *
 * Uses expo-intent-launcher (already installed in the project).
 */

import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export type ConnectivityResult = {
  success: boolean;
  message: string;
  /** true if we opened Settings instead of toggling directly */
  openedSettings?: boolean;
};

/** Open Wi-Fi settings so the user can enable Wi-Fi. */
export async function wifiOn(): Promise<ConnectivityResult> {
  return _openWifiSettings('on');
}

/** Open Wi-Fi settings so the user can disable Wi-Fi. */
export async function wifiOff(): Promise<ConnectivityResult> {
  return _openWifiSettings('off');
}

/** Open Bluetooth settings so the user can enable Bluetooth. */
export async function bluetoothOn(): Promise<ConnectivityResult> {
  return _openBluetoothSettings('on');
}

/** Open Bluetooth settings so the user can disable Bluetooth. */
export async function bluetoothOff(): Promise<ConnectivityResult> {
  return _openBluetoothSettings('off');
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function _openWifiSettings(intent: 'on' | 'off'): Promise<ConnectivityResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.WIFI_SETTINGS,
    );
    const verb = intent === 'on' ? 'enable' : 'disable';
    return {
      success: true,
      message: `Android 10 and above requires you to ${verb} Wi-Fi manually. Opening Wi-Fi settings for you.`,
      openedSettings: true,
    };
  } catch {
    return { success: false, message: 'Could not open Wi-Fi settings.' };
  }
}

async function _openBluetoothSettings(intent: 'on' | 'off'): Promise<ConnectivityResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.BLUETOOTH_SETTINGS,
    );
    const verb = intent === 'on' ? 'enable' : 'disable';
    return {
      success: true,
      message: `Android 10 and above requires you to ${verb} Bluetooth manually. Opening Bluetooth settings for you.`,
      openedSettings: true,
    };
  } catch {
    return { success: false, message: 'Could not open Bluetooth settings.' };
  }
}

function _notSupported(): ConnectivityResult {
  return { success: false, message: 'Connectivity control is only supported on Android devices.' };
}
