/**
 * alarmManager.ts — Vedra Alarm Manager
 *
 * Sets alarms via the official Android AlarmClock intent
 * (android.intent.action.SET_ALARM). This opens the system clock app
 * pre-filled — the most reliable approach that works on all Android OEMs.
 *
 * A local record is also stored in AsyncStorage so Vedra can list
 * recently created alarms (since the system AlarmManager is not directly
 * queryable from React Native without native code).
 */

import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatTime } from './timeParser';

// Dynamic import guard for expo-intent-launcher
let IntentLauncher: any = null;
try {
  IntentLauncher = require('expo-intent-launcher');
} catch {
  IntentLauncher = null;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface AlarmRecord {
  id: string;
  hour: number;
  minute: number;
  display: string;
  label?: string;
  createdAt: number;
}

export interface AlarmResult {
  success: boolean;
  alarm?: AlarmRecord;
  message: string;
}

// ── Storage key ────────────────────────────────────────────────────────────

const STORAGE_KEY = '@vedra/alarms';

// ── Storage helpers ────────────────────────────────────────────────────────

async function loadAlarms(): Promise<AlarmRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AlarmRecord[]) : [];
  } catch {
    return [];
  }
}

async function saveAlarms(alarms: AlarmRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  } catch {
    // ignore storage errors
  }
}

// ── Set alarm ──────────────────────────────────────────────────────────────

/**
 * Fire an Android SET_ALARM intent and store a local record.
 * On web / non-Android, falls back to a tel: URL (no-op gracefully).
 */
export async function setAlarm(
  hour: number,
  minute: number,
  label?: string,
): Promise<AlarmResult> {
  const display = formatTime(hour, minute);

  if (Platform.OS === 'web') {
    return { success: false, message: 'Alarms require the Android app.' };
  }

  // Fire the system alarm intent
  try {
    if (IntentLauncher) {
      await IntentLauncher.startActivityAsync('android.intent.action.SET_ALARM', {
        extra: {
          'android.intent.extra.alarm.HOUR': hour,
          'android.intent.extra.alarm.MINUTES': minute,
          'android.intent.extra.alarm.MESSAGE': label ?? `Vedra alarm`,
          'android.intent.extra.alarm.SKIP_UI': false,
        },
      });
    } else {
      // Fallback: open the clock app via URL scheme
      const url = `intent://alarm#Intent;action=android.intent.action.SET_ALARM;end`;
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    }
  } catch {
    // Intent may fail on some devices — still record locally
  }

  // Store locally
  const record: AlarmRecord = {
    id: `alarm_${Date.now()}`,
    hour,
    minute,
    display,
    label,
    createdAt: Date.now(),
  };

  const alarms = await loadAlarms();
  alarms.push(record);
  await saveAlarms(alarms);

  return { success: true, alarm: record, message: `Alarm set for ${display}.` };
}

// ── List alarms ────────────────────────────────────────────────────────────

export async function listAlarms(): Promise<AlarmRecord[]> {
  const alarms = await loadAlarms();
  // Return in chronological order by time-of-day
  return alarms.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

// ── Cancel alarm ───────────────────────────────────────────────────────────

/**
 * Remove a locally stored alarm record and open the system clock so the
 * user can confirm deletion (Android doesn't allow programmatic deletion
 * of system alarms without native code).
 */
export async function cancelAlarm(hour?: number, minute?: number): Promise<AlarmResult> {
  const alarms = await loadAlarms();

  if (alarms.length === 0) {
    return { success: false, message: 'No alarms found.' };
  }

  let target: AlarmRecord | undefined;
  if (hour !== undefined && minute !== undefined) {
    target = alarms.find((a) => a.hour === hour && a.minute === minute);
  } else {
    // Cancel the most recently created alarm
    target = alarms[alarms.length - 1];
  }

  if (!target) {
    return { success: false, message: 'Alarm not found.' };
  }

  const updated = alarms.filter((a) => a.id !== target!.id);
  await saveAlarms(updated);

  // Open system clock for user to confirm
  if (Platform.OS === 'android' && IntentLauncher) {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SHOW_ALARMS');
    } catch {
      // ignore if not supported
    }
  }

  return {
    success: true,
    alarm: target,
    message: `Alarm at ${target.display} removed. Please confirm in the clock app.`,
  };
}
