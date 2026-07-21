/**
 * timeParser.ts — Natural language time & duration parser for Vedra
 *
 * Works entirely offline with zero dependencies beyond the standard library.
 *
 * Handles:
 *  • Absolute times:   "6 AM", "6:30 PM", "18:00", "noon", "midnight"
 *  • Day modifiers:    "tomorrow at 7 AM", "Friday at 10 AM", "tonight at 9"
 *  • Relative times:   "in 30 minutes", "in 2 hours", "in 1 hour 30 minutes"
 *  • Durations:        "10 minutes", "25 minutes", "90 seconds", "1 hour 30 minutes"
 *  • Event titles:     extracted after stripping time tokens
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedDuration {
  type: 'duration';
  totalMs: number;
  display: string; // "10 minutes", "1 hour 30 minutes"
}

export interface ParsedAbsoluteTime {
  type: 'absolute';
  date: Date;
  display: string; // "6:00 AM", "tomorrow at 7:30 PM"
}

export type ParsedTimeExpr = ParsedDuration | ParsedAbsoluteTime;

// ─────────────────────────────────────────────────────────────────────────────
// Duration parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a duration string.
 * Examples: "10 minutes", "90 seconds", "2 hours", "1 hour 30 minutes", "25 min"
 */
export function parseDuration(text: string): ParsedDuration | null {
  const lower = text.toLowerCase();
  let totalMs = 0;
  let found = false;

  const hourMatch = lower.match(/(\d+)\s*h(?:ours?|r)?(?!\s*\d)/);
  if (hourMatch) {
    totalMs += parseInt(hourMatch[1], 10) * 3_600_000;
    found = true;
  }

  // Minutes: "25 min", "25 minutes", "25m" — but NOT "30 ms"
  const minMatch = lower.match(/(\d+)\s*m(?:in(?:utes?)?)?(?!s|\d)/);
  if (minMatch) {
    totalMs += parseInt(minMatch[1], 10) * 60_000;
    found = true;
  }

  const secMatch = lower.match(/(\d+)\s*s(?:ec(?:onds?)?)?(?!\d)/);
  if (secMatch) {
    totalMs += parseInt(secMatch[1], 10) * 1_000;
    found = true;
  }

  if (!found || totalMs === 0) return null;

  return { type: 'duration', totalMs, display: buildDurationDisplay(totalMs) };
}

export function buildDurationDisplay(ms: number): string {
  const totalSeconds = Math.floor(ms / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Absolute time parsing
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a time-of-day fragment: "6 AM", "6:30 PM", "18:00", "noon", "midnight" */
function parseTimeOfDay(fragment: string): { hour: number; minute: number } | null {
  const s = fragment.toLowerCase().trim();

  if (s === 'noon') return { hour: 12, minute: 0 };
  if (s === 'midnight') return { hour: 0, minute: 0 };
  if (s === 'morning') return { hour: 8, minute: 0 };
  if (s === 'afternoon') return { hour: 14, minute: 0 };
  if (s === 'evening' || s === 'tonight') return { hour: 20, minute: 0 };
  if (s === 'night') return { hour: 21, minute: 0 };

  // "6:30 am" / "6:30 pm"
  const hhmmAmPm = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (hhmmAmPm) {
    let h = parseInt(hhmmAmPm[1], 10);
    const m = parseInt(hhmmAmPm[2], 10);
    if (hhmmAmPm[3] === 'pm' && h !== 12) h += 12;
    if (hhmmAmPm[3] === 'am' && h === 12) h = 0;
    return { hour: h, minute: m };
  }

  // "6 am" / "6 pm"
  const hAmPm = s.match(/^(\d{1,2})\s*(am|pm)$/);
  if (hAmPm) {
    let h = parseInt(hAmPm[1], 10);
    if (hAmPm[2] === 'pm' && h !== 12) h += 12;
    if (hAmPm[2] === 'am' && h === 12) h = 0;
    return { hour: h, minute: 0 };
  }

  // "18:00" / "06:30" (24h)
  const hhmm24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm24) {
    const h = parseInt(hhmm24[1], 10);
    const m = parseInt(hhmm24[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { hour: h, minute: m };
  }

  // Bare number "6" → smart default (≤ 7 assume PM so "alarm 6" = 6 AM for wake-ups)
  const bare = s.match(/^(\d{1,2})$/);
  if (bare) {
    const h = parseInt(bare[1], 10);
    if (h >= 1 && h <= 12) return { hour: h <= 7 ? h + 12 : h, minute: 0 };
  }

  return null;
}

/** Compute how many days to add for a day name ("friday", "monday"…) */
function dayNameOffset(lower: string): number | null {
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = new Date().getDay();
  for (let i = 0; i < names.length; i++) {
    if (lower.includes(names[i])) {
      let diff = i - today;
      if (diff <= 0) diff += 7;
      return diff;
    }
  }
  return null;
}

/** Compute total day offset for phrases like "tomorrow", "tonight", "this friday" */
function computeDayOffset(lower: string): number {
  if (lower.includes('day after tomorrow')) return 2;
  if (lower.includes('tomorrow')) return 1;
  const named = dayNameOffset(lower);
  if (named !== null) return named;
  return 0;
}

/**
 * Parse an absolute time expression from a voice transcript.
 *
 * Examples:
 *   "6 AM"                → today at 06:00 (or tomorrow if already past)
 *   "tomorrow at 7:30 PM" → tomorrow at 19:30
 *   "in 30 minutes"       → now + 30 min
 *   "Friday at 10 AM"     → next Friday at 10:00
 */
export function parseAbsoluteTime(text: string): ParsedAbsoluteTime | null {
  const lower = text.toLowerCase();

  // ── "in X minutes/hours/seconds" → relative offset ──────────────────────
  const relMatch = lower.match(/\bin\s+(.+)/);
  if (relMatch) {
    const dur = parseDuration(relMatch[1]);
    if (dur) {
      const date = new Date(Date.now() + dur.totalMs);
      return { type: 'absolute', date, display: `in ${dur.display}` };
    }
  }

  // ── Try to extract a time-of-day token ───────────────────────────────────
  const TIME_PATTERNS = [
    /(\d{1,2}:\d{2}\s*(?:am|pm))/i,
    /(\d{1,2}\s*(?:am|pm))/i,
    /(noon|midnight|morning|afternoon|evening|tonight|night)/i,
    /(\d{1,2}:\d{2})/,
  ];

  let parsedTod: { hour: number; minute: number } | null = null;
  for (const pat of TIME_PATTERNS) {
    // Try "at <time>" first, then anywhere
    const atMatch = lower.match(new RegExp(`(?:at|for|@)\\s*${pat.source}`, 'i'));
    const raw = atMatch ? atMatch[1] : lower.match(pat)?.[1];
    if (raw) {
      parsedTod = parseTimeOfDay(raw);
      if (parsedTod) break;
    }
  }

  if (!parsedTod) return null;

  const dayOffset = computeDayOffset(lower);
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(parsedTod.hour, parsedTod.minute, 0, 0);

  // If the resulting time is in the past on "today", push to tomorrow
  if (dayOffset === 0 && date.getTime() < Date.now()) {
    date.setDate(date.getDate() + 1);
  }

  const timePart = formatTime(parsedTod.hour, parsedTod.minute);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let displayDate = '';
  if (dayOffset === 0) displayDate = 'today';
  else if (dayOffset === 1) displayDate = 'tomorrow';
  else displayDate = dayNames[date.getDay()];

  const display = dayOffset === 0 ? timePart : `${displayDate} at ${timePart}`;
  return { type: 'absolute', date, display };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers (exported for use in components)
// ─────────────────────────────────────────────────────────────────────────────

export function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return minute === 0 ? `${h} ${ampm}` : `${h}:${m} ${ampm}`;
}

/** Format elapsed/remaining milliseconds as MM:SS or HH:MM:SS */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1_000));
  const h = Math.floor(totalSec / 3_600);
  const m = Math.floor((totalSec % 3_600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Format elapsed milliseconds as MM:SS or HH:MM:SS (for stopwatch) */
export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1_000);
  const h = Math.floor(totalSec / 3_600);
  const m = Math.floor((totalSec % 3_600) / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1_000) / 10); // centiseconds
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/** Strip time tokens from a string to extract an event title */
export function extractTitle(text: string): string {
  return text
    .replace(/\b(at|for|on|in)\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
    .replace(/\b(tomorrow|today|tonight|noon|midnight|morning|afternoon|evening)\b/gi, '')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
