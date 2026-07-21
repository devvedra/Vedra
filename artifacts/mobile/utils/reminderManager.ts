/**
 * reminderManager.ts — Vedra Reminder Manager
 *
 * Stores reminders in AsyncStorage and schedules local notifications so they
 * fire even when the app is in the background.
 *
 * Each reminder has a unique ID, message, trigger timestamp, and the
 * expo-notifications identifier used to cancel it if needed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  scheduleNotification,
  cancelNotification,
  CHANNEL_REMINDERS,
} from './notificationManager';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Reminder {
  id: string;
  message: string;
  triggerMs: number;
  timeDisplay: string;
  notificationId: string | null;
  createdAt: number;
  completed: boolean;
}

export interface ReminderResult {
  success: boolean;
  reminder?: Reminder;
  reminders?: Reminder[];
  message: string;
}

// ── Storage key ────────────────────────────────────────────────────────────

const KEY = '@vedra/reminders';

// ── Helpers ────────────────────────────────────────────────────────────────

async function loadAll(): Promise<Reminder[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Reminder[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(reminders: Reminder[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(reminders));
  } catch {
    // ignore
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a new reminder and schedule its notification.
 */
export async function createReminder(
  message: string,
  triggerMs: number,
  timeDisplay: string,
): Promise<ReminderResult> {
  if (triggerMs <= Date.now()) {
    return { success: false, message: 'Reminder time is in the past.' };
  }

  const notificationId = await scheduleNotification({
    title: '🔔 Vedra Reminder',
    body: message,
    triggerMs,
    channelId: CHANNEL_REMINDERS,
  });

  const reminder: Reminder = {
    id: `reminder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    message,
    triggerMs,
    timeDisplay,
    notificationId,
    createdAt: Date.now(),
    completed: false,
  };

  const all = await loadAll();
  all.push(reminder);
  await saveAll(all);

  return { success: true, reminder, message: `Reminder set for ${timeDisplay}.` };
}

/**
 * List all pending (non-completed) reminders, sorted by trigger time.
 */
export async function listReminders(): Promise<ReminderResult> {
  const all = await loadAll();
  const pending = all
    .filter((r) => !r.completed && r.triggerMs > Date.now())
    .sort((a, b) => a.triggerMs - b.triggerMs);

  if (pending.length === 0) {
    return { success: true, reminders: [], message: 'You have no upcoming reminders.' };
  }

  return {
    success: true,
    reminders: pending,
    message: `You have ${pending.length} reminder${pending.length !== 1 ? 's' : ''}.`,
  };
}

/**
 * Delete the most recently created reminder (or a specific one by ID).
 */
export async function deleteReminder(id?: string): Promise<ReminderResult> {
  const all = await loadAll();
  const pending = all.filter((r) => !r.completed && r.triggerMs > Date.now());

  if (pending.length === 0) {
    return { success: false, message: 'No reminders to delete.' };
  }

  const target = id
    ? pending.find((r) => r.id === id)
    : pending[pending.length - 1]; // most recently created

  if (!target) {
    return { success: false, message: 'Reminder not found.' };
  }

  // Cancel the scheduled notification
  await cancelNotification(target.notificationId);

  const updated = all.filter((r) => r.id !== target.id);
  await saveAll(updated);

  return {
    success: true,
    reminder: target,
    message: `Reminder deleted: "${target.message}"`,
  };
}

/**
 * Mark a reminder as completed (called when the notification fires and app is active).
 */
export async function markReminderCompleted(id: string): Promise<void> {
  const all = await loadAll();
  const updated = all.map((r) =>
    r.id === id ? { ...r, completed: true } : r,
  );
  await saveAll(updated);
}

/**
 * Clean up reminders that have already passed (call on app startup).
 */
export async function pruneOldReminders(): Promise<void> {
  const all = await loadAll();
  const cutoff = Date.now() - 24 * 60 * 60 * 1_000; // keep last 24 h
  const pruned = all.filter((r) => r.triggerMs > cutoff);
  await saveAll(pruned);
}
