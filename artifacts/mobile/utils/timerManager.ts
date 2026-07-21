/**
 * timerManager.ts — Vedra Timer Manager
 *
 * Manages a single foreground countdown timer with AsyncStorage persistence
 * and an expo-notifications alert when it finishes.
 *
 * Only one active timer is supported at a time (keeps the UI simple).
 * The timer keeps running while the screen is open; the notification fires
 * even if the user backgrounds the app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleNotification, cancelNotification, CHANNEL_TIMERS } from './notificationManager';
import { buildDurationDisplay } from './timeParser';

// ── Types ──────────────────────────────────────────────────────────────────

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerRecord {
  id: string;
  totalMs: number;
  durationDisplay: string;
  /** Accumulated ms before the current run segment */
  elapsedMs: number;
  /** Timestamp when the current run segment started (null if paused/idle) */
  segmentStartedAt: number | null;
  status: TimerStatus;
  /** expo-notifications ID for the finish alert */
  notificationId: string | null;
}

export interface TimerResult {
  success: boolean;
  timer: TimerRecord | null;
  message: string;
}

// ── Storage key ────────────────────────────────────────────────────────────

const KEY = '@vedra/timer';

// ── Storage helpers ────────────────────────────────────────────────────────

async function load(): Promise<TimerRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TimerRecord) : null;
  } catch {
    return null;
  }
}

async function save(t: TimerRecord | null): Promise<void> {
  try {
    if (t === null) {
      await AsyncStorage.removeItem(KEY);
    } else {
      await AsyncStorage.setItem(KEY, JSON.stringify(t));
    }
  } catch {
    // ignore
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getTimer(): Promise<TimerRecord | null> {
  return load();
}

/** Remaining milliseconds for a timer record (live calculation). */
export function getRemainingMs(t: TimerRecord): number {
  if (t.status === 'idle' || t.status === 'completed') return 0;
  const elapsed =
    t.status === 'running' && t.segmentStartedAt !== null
      ? t.elapsedMs + (Date.now() - t.segmentStartedAt)
      : t.elapsedMs;
  return Math.max(0, t.totalMs - elapsed);
}

/** Start a new countdown timer. Cancels any existing one first. */
export async function startTimer(totalMs: number, durationDisplay: string): Promise<TimerResult> {
  // Cancel any existing timer
  const existing = await load();
  if (existing?.notificationId) {
    await cancelNotification(existing.notificationId);
  }

  const now = Date.now();
  const triggerMs = now + totalMs;

  // Schedule finish notification
  const notificationId = await scheduleNotification({
    title: '⏱ Timer finished',
    body: `Your ${durationDisplay} timer is done!`,
    triggerMs,
    channelId: CHANNEL_TIMERS,
  });

  const timer: TimerRecord = {
    id: `timer_${now}`,
    totalMs,
    durationDisplay,
    elapsedMs: 0,
    segmentStartedAt: now,
    status: 'running',
    notificationId,
  };

  await save(timer);
  return { success: true, timer, message: `${durationDisplay} timer started.` };
}

/** Pause the running timer. */
export async function pauseTimer(): Promise<TimerResult> {
  const t = await load();
  if (!t || t.status !== 'running') {
    return { success: false, timer: t, message: 'No running timer to pause.' };
  }

  const now = Date.now();
  const elapsed = t.elapsedMs + (now - (t.segmentStartedAt ?? now));

  // Cancel the completion notification (will reschedule on resume)
  await cancelNotification(t.notificationId);

  const updated: TimerRecord = {
    ...t,
    elapsedMs: elapsed,
    segmentStartedAt: null,
    status: 'paused',
    notificationId: null,
  };
  await save(updated);
  return { success: true, timer: updated, message: 'Timer paused.' };
}

/** Resume a paused timer. */
export async function resumeTimer(): Promise<TimerResult> {
  const t = await load();
  if (!t || t.status !== 'paused') {
    return { success: false, timer: t, message: 'No paused timer to resume.' };
  }

  const remaining = t.totalMs - t.elapsedMs;
  const triggerMs = Date.now() + remaining;

  const notificationId = await scheduleNotification({
    title: '⏱ Timer finished',
    body: `Your ${t.durationDisplay} timer is done!`,
    triggerMs,
    channelId: CHANNEL_TIMERS,
  });

  const updated: TimerRecord = {
    ...t,
    segmentStartedAt: Date.now(),
    status: 'running',
    notificationId,
  };
  await save(updated);
  return { success: true, timer: updated, message: 'Timer resumed.' };
}

/** Cancel the active timer. */
export async function cancelTimer(): Promise<TimerResult> {
  const t = await load();
  if (!t || t.status === 'idle') {
    return { success: false, timer: null, message: 'No active timer.' };
  }
  await cancelNotification(t.notificationId);
  await save(null);
  return { success: true, timer: null, message: 'Timer cancelled.' };
}

/** Mark the timer as completed (called by the hook when countdown hits 0). */
export async function completeTimer(): Promise<TimerRecord | null> {
  const t = await load();
  if (!t) return null;
  const updated: TimerRecord = { ...t, status: 'completed', segmentStartedAt: null };
  await save(updated);
  return updated;
}

/** Query remaining time. */
export async function queryTimer(): Promise<{ timer: TimerRecord | null; remainingMs: number; message: string }> {
  const t = await load();
  if (!t || t.status === 'idle') {
    return { timer: null, remainingMs: 0, message: 'No active timer.' };
  }
  if (t.status === 'completed') {
    return { timer: t, remainingMs: 0, message: 'Timer has already finished.' };
  }
  const remaining = getRemainingMs(t);
  const display = buildDurationDisplay(remaining);
  return {
    timer: t,
    remainingMs: remaining,
    message: `${display} remaining on your ${t.durationDisplay} timer.`,
  };
}
