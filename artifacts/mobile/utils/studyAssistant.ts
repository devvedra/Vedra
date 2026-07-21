/**
 * studyAssistant.ts — Vedra Study Assistant (v0.8)
 *
 * Offline study-related helpers built on top of existing reminders, timers,
 * calendar, and app-launcher utilities.
 *
 * Supported commands (parsed in commandParser.ts):
 *  STUDY_TIMER       — "Start a 25-minute study timer"
 *  STUDY_REMINDERS   — "Show today's study reminders"
 *  STUDY_CHECKLIST   — "Generate my study checklist"
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { listReminders } from './reminderManager';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudySession {
  id: string;
  startedAt: number;    // epoch ms
  durationMs: number;
  completedAt?: number; // epoch ms, undefined if incomplete
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

const K = {
  SESSIONS:  '@vedra/study_sessions',
  CHECKLIST: '@vedra/study_checklist',
};

// ─── Study Sessions ───────────────────────────────────────────────────────────

export async function recordStudySession(durationMs: number): Promise<StudySession> {
  const session: StudySession = {
    id: Date.now().toString(),
    startedAt: Date.now(),
    durationMs,
  };
  const raw = await AsyncStorage.getItem(K.SESSIONS);
  const sessions: StudySession[] = raw ? JSON.parse(raw) : [];
  sessions.unshift(session);
  if (sessions.length > 100) sessions.length = 100;
  await AsyncStorage.setItem(K.SESSIONS, JSON.stringify(sessions));
  return session;
}

export async function getTodayStudyMinutes(): Promise<number> {
  const raw = await AsyncStorage.getItem(K.SESSIONS);
  const sessions: StudySession[] = raw ? JSON.parse(raw) : [];
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const todayMs = midnight.getTime();
  return sessions
    .filter(s => s.startedAt >= todayMs && s.completedAt !== undefined)
    .reduce((sum, s) => sum + s.durationMs, 0) / 60_000;
}

// ─── Checklist ────────────────────────────────────────────────────────────────

export async function getChecklist(): Promise<ChecklistItem[]> {
  try {
    const raw = await AsyncStorage.getItem(K.CHECKLIST);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addChecklistItem(text: string): Promise<ChecklistItem> {
  const item: ChecklistItem = { id: Date.now().toString(), text, done: false, createdAt: Date.now() };
  const list = await getChecklist();
  list.push(item);
  await AsyncStorage.setItem(K.CHECKLIST, JSON.stringify(list));
  return item;
}

export async function toggleChecklistItem(id: string): Promise<void> {
  const list = await getChecklist();
  const idx = list.findIndex(i => i.id === id);
  if (idx >= 0) {
    list[idx].done = !list[idx].done;
    await AsyncStorage.setItem(K.CHECKLIST, JSON.stringify(list));
  }
}

export async function clearChecklist(): Promise<void> {
  await AsyncStorage.setItem(K.CHECKLIST, JSON.stringify([]));
}

// ─── Smart checklist from reminders ──────────────────────────────────────────

const STUDY_KEYWORDS = /\b(study|revise|revision|review|read|homework|assignment|test|exam|quiz|practise|practice|chapter|lesson|topic)\b/i;

export async function buildStudyChecklist(): Promise<{ items: ChecklistItem[]; generated: boolean }> {
  const { reminders } = await listReminders();
  const studyReminders = (reminders ?? []).filter(r => STUDY_KEYWORDS.test(r.message));

  if (studyReminders.length === 0) {
    return { items: await getChecklist(), generated: false };
  }

  // Clear old auto-generated items and create fresh ones from study reminders
  const existingList = await getChecklist();
  const manualItems = existingList.filter(i => !i.text.startsWith('[auto]'));

  const newItems: ChecklistItem[] = studyReminders.map(r => ({
    id: `auto_${r.id}`,
    text: r.message,
    done: false,
    createdAt: Date.now(),
  }));

  const combined = [...manualItems, ...newItems];
  await AsyncStorage.setItem(K.CHECKLIST, JSON.stringify(combined));
  return { items: combined, generated: true };
}

// ─── Today's study reminders ──────────────────────────────────────────────────

export interface StudyReminder {
  id: string;
  message: string;
  timeDisplay: string;
  triggerMs: number;
}

export async function getTodayStudyReminders(): Promise<StudyReminder[]> {
  const { reminders } = await listReminders();
  if (!reminders) return [];

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const endOfDay = midnight.getTime() + 86_400_000;

  return (reminders as any[])
    .filter(r => STUDY_KEYWORDS.test(r.message) && r.triggerMs >= Date.now() && r.triggerMs < endOfDay)
    .map(r => ({ id: r.id, message: r.message, timeDisplay: r.timeDisplay, triggerMs: r.triggerMs }))
    .sort((a, b) => a.triggerMs - b.triggerMs);
}
