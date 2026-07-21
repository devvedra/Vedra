/**
 * calendarManager.ts — Vedra Calendar Manager
 *
 * Wraps expo-calendar to create, list, and delete events in the device's
 * default calendar. Everything happens offline — no network calls.
 *
 * Permissions: READ_CALENDAR + WRITE_CALENDAR (declared in app.json).
 * The permission dialog is shown the first time a calendar operation is called.
 */

import { Platform } from 'react-native';

// Dynamic import guard
let Calendar: any = null;
try {
  Calendar = require('expo-calendar');
} catch {
  Calendar = null;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface CalendarEventInfo {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  calendarId: string;
}

export interface CalendarResult {
  success: boolean;
  event?: CalendarEventInfo;
  events?: CalendarEventInfo[];
  message: string;
}

// ── Permission ─────────────────────────────────────────────────────────────

export async function requestCalendarPermission(): Promise<boolean> {
  if (!Calendar || Platform.OS === 'web') return false;
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ── Find default calendar ──────────────────────────────────────────────────

async function findDefaultCalendarId(): Promise<string | null> {
  if (!Calendar) return null;
  try {
    const calendars: any[] = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );

    // Prefer a local or default calendar for writing
    const writable = calendars.filter(
      (c) =>
        c.allowsModifications &&
        c.type !== Calendar.CalendarType.SUBSCRIBED,
    );

    // Try to find the device's default calendar
    const defaultCal =
      writable.find((c) => c.isPrimary) ??
      writable.find((c) => c.source?.type === 'local') ??
      writable[0];

    return defaultCal?.id ?? null;
  } catch {
    return null;
  }
}

// ── Create event ───────────────────────────────────────────────────────────

export async function createCalendarEvent(
  title: string,
  startMs: number,
  endMs: number,
  timeDisplay: string,
): Promise<CalendarResult> {
  if (Platform.OS === 'web') {
    return { success: false, message: 'Calendar requires the Android app.' };
  }

  const granted = await requestCalendarPermission();
  if (!granted) {
    return {
      success: false,
      message: 'Calendar permission denied. Please grant it in Settings.',
    };
  }

  const calendarId = await findDefaultCalendarId();
  if (!calendarId) {
    return { success: false, message: 'No writable calendar found on this device.' };
  }

  try {
    const eventId: string = await Calendar.createEventAsync(calendarId, {
      title,
      startDate: new Date(startMs),
      endDate: new Date(endMs),
      notes: 'Created by Vedra',
      alarms: [{ relativeOffset: -15 }], // 15 min reminder
    });

    return {
      success: true,
      event: {
        id: eventId,
        title,
        startDate: new Date(startMs),
        endDate: new Date(endMs),
        calendarId,
      },
      message: `"${title}" added to your calendar for ${timeDisplay}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message ?? 'Failed to create calendar event.',
    };
  }
}

// ── List events ────────────────────────────────────────────────────────────

export async function listTodayEvents(): Promise<CalendarResult> {
  if (Platform.OS === 'web') {
    return { success: false, message: 'Calendar requires the Android app.' };
  }

  const granted = await requestCalendarPermission();
  if (!granted) {
    return {
      success: false,
      message: 'Calendar permission denied.',
    };
  }

  try {
    const calendars: any[] = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calIds = calendars.map((c) => c.id);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const rawEvents: any[] = await Calendar.getEventsAsync(calIds, startOfDay, endOfDay);
    const events: CalendarEventInfo[] = rawEvents.map((e) => ({
      id: e.id,
      title: e.title ?? 'Untitled',
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
      calendarId: e.calendarId,
    }));

    events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    if (events.length === 0) {
      return { success: true, events: [], message: 'No events today.' };
    }

    return {
      success: true,
      events,
      message: `You have ${events.length} event${events.length !== 1 ? 's' : ''} today.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message ?? 'Failed to read calendar.',
    };
  }
}

// ── Delete event ───────────────────────────────────────────────────────────

export async function deleteCalendarEvent(eventId: string, title: string): Promise<CalendarResult> {
  if (!Calendar || Platform.OS === 'web') {
    return { success: false, message: 'Calendar requires the Android app.' };
  }

  const granted = await requestCalendarPermission();
  if (!granted) {
    return { success: false, message: 'Calendar permission denied.' };
  }

  try {
    await Calendar.deleteEventAsync(eventId);
    return { success: true, message: `"${title}" deleted from your calendar.` };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message ?? 'Failed to delete calendar event.',
    };
  }
}
