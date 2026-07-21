/**
 * commandParser.ts — Vedra Command Parser (v0.5)
 *
 * Parses free-form voice transcripts into typed commands, entirely offline
 * using string matching. No network calls, no AI services.
 *
 * ── Supported command types ─────────────────────────────────────────────────
 *
 *  OPEN_APP      — "Open WhatsApp", "Launch Chrome"…
 *  CALL_CONTACT  — "Call Mom", "Dial Rahul"…
 *  SEND_SMS      — "Text Mom saying I'll be late"…
 *  SET_ALARM     — "Set alarm for 6 AM", "Wake me at 5:30"…
 *  CANCEL_ALARM  — "Cancel my alarm", "Delete 6 AM alarm"…
 *  LIST_ALARMS   — "Show my alarms", "What alarms do I have?"…
 *  START_TIMER   — "Start a 10 minute timer", "Set timer for 25 min"…
 *  CANCEL_TIMER  — "Cancel timer", "Stop timer"…
 *  QUERY_TIMER   — "How much time is left?", "Check timer"…
 *  STOPWATCH     — "Start stopwatch", "Pause stopwatch"…
 *  SET_REMINDER  — "Remind me to study at 7 PM"…
 *  LIST_REMINDERS — "Show my reminders"…
 *  DELETE_REMINDER — "Delete my reminder"…
 *  CREATE_EVENT  — "Create meeting tomorrow at 10 AM"…
 *  LIST_EVENTS   — "Show today's schedule", "What's on my calendar?"…
 *  DELETE_EVENT  — "Delete today's meeting"…
 */

import { parseAbsoluteTime, parseDuration } from './timeParser';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Metadata for a launchable Android app. */
export type AppDefinition = {
  displayName: string;
  keywords: string[];
  packageName?: string;
  packageOptions?: string[];
  intentAction?: string;
};

export type ParsedCommand =
  // ── Existing ───────────────────────────────────────────────────────────────
  | { type: 'OPEN_APP';     app: AppDefinition }
  | { type: 'CALL_CONTACT'; contactName: string }
  | { type: 'SEND_SMS';     contactName: string; message?: string }
  // ── Alarms ─────────────────────────────────────────────────────────────────
  | { type: 'SET_ALARM';    hour: number; minute: number; timeDisplay: string; label?: string }
  | { type: 'CANCEL_ALARM'; timeDisplay?: string }
  | { type: 'LIST_ALARMS' }
  // ── Timers ─────────────────────────────────────────────────────────────────
  | { type: 'START_TIMER';  totalMs: number; durationDisplay: string }
  | { type: 'CANCEL_TIMER' }
  | { type: 'QUERY_TIMER' }
  // ── Stopwatch ──────────────────────────────────────────────────────────────
  | { type: 'STOPWATCH';    action: 'start' | 'pause' | 'resume' | 'stop' | 'reset' | 'query' }
  // ── Reminders ──────────────────────────────────────────────────────────────
  | { type: 'SET_REMINDER'; message: string; timeDisplay: string; triggerMs: number }
  | { type: 'LIST_REMINDERS' }
  | { type: 'DELETE_REMINDER' }
  // ── Calendar ───────────────────────────────────────────────────────────────
  | { type: 'CREATE_EVENT'; title: string; timeDisplay: string; startMs: number; endMs: number }
  | { type: 'LIST_EVENTS' }
  | { type: 'DELETE_EVENT' };

// ═══════════════════════════════════════════════════════════════════════════════
// App Registry
// ═══════════════════════════════════════════════════════════════════════════════

const APP_REGISTRY: AppDefinition[] = [
  { displayName: 'WhatsApp',      keywords: ['whatsapp', 'whats app'],                       packageName: 'com.whatsapp' },
  { displayName: 'Gmail',         keywords: ['gmail', 'g mail', 'email', 'mail', 'my email'], packageName: 'com.google.android.gm' },
  { displayName: 'Chrome',        keywords: ['chrome', 'google chrome', 'browser', 'web browser', 'internet'], packageOptions: ['com.android.chrome', 'com.chrome.beta'] },
  { displayName: 'YouTube',       keywords: ['youtube', 'you tube', 'yt', 'videos'],           packageName: 'com.google.android.youtube' },
  { displayName: 'Maps',          keywords: ['maps', 'google maps', 'navigation', 'directions'], packageName: 'com.google.android.apps.maps' },
  { displayName: 'Google Photos', keywords: ['google photos', 'photos', 'gallery', 'pictures', 'photo gallery', 'my photos', 'images'], packageOptions: ['com.google.android.apps.photos', 'com.sec.android.gallery3d', 'com.miui.gallery', 'com.android.gallery3d'] },
  { displayName: 'Camera',        keywords: ['camera', 'take photo', 'take picture', 'selfie'], intentAction: 'android.media.action.STILL_IMAGE_CAMERA' },
  { displayName: 'Settings',      keywords: ['settings', 'setting', 'preferences', 'configuration'], intentAction: 'android.settings.SETTINGS' },
  { displayName: 'Calculator',    keywords: ['calculator', 'calc', 'calculate'],               packageOptions: ['com.google.android.calculator', 'com.sec.android.calculator', 'com.miui.calculator', 'com.android.calculator2'] },
  { displayName: 'Files',         keywords: ['files', 'file manager', 'my files', 'file explorer', 'documents', 'storage'], packageOptions: ['com.google.android.documentsui', 'com.sec.android.app.myfiles', 'com.miui.fileexplorer'] },
  { displayName: 'Spotify',       keywords: ['spotify', 'music', 'my music'],                  packageName: 'com.spotify.music' },
  { displayName: 'Instagram',     keywords: ['instagram', 'insta'],                            packageName: 'com.instagram.android' },
  { displayName: 'Facebook',      keywords: ['facebook', 'fb'],                                packageName: 'com.facebook.katana' },
  { displayName: 'Twitter',       keywords: ['twitter', 'x', 'tweets'],                        packageOptions: ['com.twitter.android', 'com.x.android'] },
  { displayName: 'Netflix',       keywords: ['netflix'],                                       packageName: 'com.netflix.mediaclient' },
  { displayName: 'Telegram',      keywords: ['telegram'],                                      packageName: 'org.telegram.messenger' },
  { displayName: 'Clock',         keywords: ['clock', 'alarm clock'],                          packageOptions: ['com.google.android.deskclock', 'com.sec.android.app.clockpackage'] },
  { displayName: 'Contacts',      keywords: ['contacts', 'address book', 'phone book'],        packageOptions: ['com.google.android.contacts', 'com.samsung.android.contacts'] },
  { displayName: 'Play Store',    keywords: ['play store', 'google play', 'app store'],        packageName: 'com.android.vending' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Verb / keyword lists
// ═══════════════════════════════════════════════════════════════════════════════

const OPEN_VERBS  = ['navigate to','take me to','go to','bring up','open','launch','start','run','show','load'];
const CALL_VERBS  = ['make a phone call to','make a call to','give a call to','place a call to','call up','phone up','ring up','call','phone','dial','ring'];
const SMS_VERBS   = ['send an sms to','send a sms to','send sms to','send a text message to','send text message to','send a text to','send text to','send a message to','send message to','text','message'];

const ALARM_SET_VERBS  = ['set an alarm for','set alarm for','create alarm for','create an alarm for','set alarm at','alarm at','alarm for','wake me up at','wake me at','set wake up at'];
const ALARM_CANCEL_KW  = ['cancel my alarm','cancel alarm','delete alarm','remove alarm','delete my alarm','remove my alarm','dismiss alarm'];
const ALARM_LIST_KW    = ['show my alarms','show alarms','list my alarms','list alarms','what alarms','my alarms','all alarms'];

const TIMER_START_VERBS = ['start a timer for','start timer for','set a timer for','set timer for','create timer for','create a timer for','timer for','start a','start'];
const TIMER_CANCEL_KW   = ['cancel timer','cancel my timer','stop timer','stop my timer','cancel the timer','end timer'];
const TIMER_QUERY_KW    = ['how much time is left','how much time left','time remaining','time left','check timer','timer status','timer remaining','whats left on the timer'];

const STOPWATCH_START_KW  = ['start stopwatch','begin stopwatch','start the stopwatch','stopwatch start','start a stopwatch'];
const STOPWATCH_PAUSE_KW  = ['pause stopwatch','pause the stopwatch','stopwatch pause'];
const STOPWATCH_RESUME_KW = ['resume stopwatch','resume the stopwatch','continue stopwatch','stopwatch resume'];
const STOPWATCH_STOP_KW   = ['stop stopwatch','stop the stopwatch','stopwatch stop'];
const STOPWATCH_RESET_KW  = ['reset stopwatch','reset the stopwatch','stopwatch reset','clear stopwatch'];
const STOPWATCH_QUERY_KW  = ['stopwatch time','how long has the stopwatch been running','stopwatch elapsed','check stopwatch','current stopwatch','stopwatch status'];

const REMINDER_SET_VERBS = ['remind me to','remind me about','remind me that','set a reminder to','set reminder to','create a reminder to','create reminder to','reminder to'];
const REMINDER_LIST_KW   = ['show my reminders','show reminders','list reminders','list my reminders','my reminders','all reminders','what reminders'];
const REMINDER_DELETE_KW = ['delete my reminder','cancel my reminder','remove my reminder','delete reminder','cancel reminder','remove reminder'];

const EVENT_CREATE_VERBS = ['create a meeting','create meeting','add a meeting','add meeting','schedule meeting','schedule a meeting','create an event','create event','add an event','add event','create a calendar event','add calendar event'];
const EVENT_LIST_KW      = ["show today's schedule","today's schedule",'show my schedule','my schedule','show my calendar','whats on my calendar','what is on my calendar','show todays schedule','what events',"what's on my calendar"];
const EVENT_DELETE_KW    = ["delete today's meeting",'cancel today\'s meeting','delete meeting','cancel meeting','remove meeting','delete event','cancel event','remove event'];

const POLITE_PREFIXES: RegExp[] = [
  /^please\s+/,/^can you please\s+/,/^can you\s+/,/^could you please\s+/,
  /^could you\s+/,/^hey vedra[,.]?\s+/,/^ok vedra[,.]?\s+/,/^vedra[,.]?\s+/,
];

const FILLER_WORDS   = /^(?:my|the|a|an)\s+/;
const INLINE_MSG_PAT: RegExp[] = [
  /^(.+?)\s+with\s+the\s+message\s+(.+)$/,
  /^(.+?)\s+with\s+message\s+(.+)$/,
  /^(.+?)\s+that\s+says\s+(.+)$/,
  /^(.+?)\s+saying\s+(.+)$/,
  /^(.+?)\s*:\s*(.+)$/,
];
const TELL_PATTERN = /^tell\s+(\S+)\s+(.+)$/;

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

export function parseCommand(text: string): ParsedCommand | null {
  const cleaned = normalise(text);

  return (
    tryOpenApp(cleaned)      ??
    tryCallContact(cleaned)  ??
    trySendSms(cleaned)      ??
    trySetAlarm(cleaned)     ??
    tryCancelAlarm(cleaned)  ??
    tryListAlarms(cleaned)   ??
    tryStartTimer(cleaned)   ??
    tryCancelTimer(cleaned)  ??
    tryQueryTimer(cleaned)   ??
    tryStopwatch(cleaned)    ??
    trySetReminder(cleaned)  ??
    tryListReminders(cleaned)??
    tryDeleteReminder(cleaned)??
    tryCreateEvent(cleaned)  ??
    tryListEvents(cleaned)   ??
    tryDeleteEvent(cleaned)  ??
    null
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Existing parse passes
// ═══════════════════════════════════════════════════════════════════════════════

function tryOpenApp(c: string): ParsedCommand | null {
  for (const verb of OPEN_VERBS) {
    const m = c.match(buildVP(verb));
    if (!m) continue;
    const app = findApp(m[1].trim().replace(FILLER_WORDS, '').trim());
    if (app) return { type: 'OPEN_APP', app };
  }
  return null;
}

function tryCallContact(c: string): ParsedCommand | null {
  for (const verb of CALL_VERBS) {
    const m = c.match(buildVP(verb));
    if (!m) continue;
    const name = m[1].trim().replace(FILLER_WORDS, '').trim();
    if (name.length >= 2) return { type: 'CALL_CONTACT', contactName: name };
  }
  return null;
}

function trySendSms(c: string): ParsedCommand | null {
  const tell = c.match(TELL_PATTERN);
  if (tell) {
    const name = tell[1].trim().replace(FILLER_WORDS, '').trim();
    const msg  = tell[2].trim();
    if (name.length >= 2 && msg.length >= 1) return { type: 'SEND_SMS', contactName: name, message: msg };
  }
  for (const verb of SMS_VERBS) {
    const m = c.match(buildVP(verb));
    if (!m) continue;
    const rest = m[1].trim().replace(FILLER_WORDS, '').trim();
    if (rest.length < 2) continue;
    const extracted = extractInlineMsg(rest);
    if (extracted) return { type: 'SEND_SMS', contactName: extracted.contactName, message: extracted.message };
    return { type: 'SEND_SMS', contactName: rest };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// New parse passes — Alarms
// ═══════════════════════════════════════════════════════════════════════════════

function trySetAlarm(c: string): ParsedCommand | null {
  for (const verb of ALARM_SET_VERBS) {
    const m = c.match(buildVP(verb));
    if (!m) continue;
    const timeStr = m[1].trim();
    const parsed = parseAbsoluteTime(timeStr);
    if (parsed) {
      return {
        type: 'SET_ALARM',
        hour: parsed.date.getHours(),
        minute: parsed.date.getMinutes(),
        timeDisplay: parsed.display,
      };
    }
  }
  return null;
}

function tryCancelAlarm(c: string): ParsedCommand | null {
  if (ALARM_CANCEL_KW.some((kw) => c.includes(kw))) {
    // Try to extract a time if mentioned: "cancel my 6 am alarm"
    const parsed = parseAbsoluteTime(c);
    return {
      type: 'CANCEL_ALARM',
      timeDisplay: parsed?.display,
    };
  }
  return null;
}

function tryListAlarms(c: string): ParsedCommand | null {
  return ALARM_LIST_KW.some((kw) => c.includes(kw)) ? { type: 'LIST_ALARMS' } : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// New parse passes — Timers
// ═══════════════════════════════════════════════════════════════════════════════

function tryStartTimer(c: string): ParsedCommand | null {
  // Pattern A: verb + duration ("start a 10 minute timer", "set timer for 25 min")
  for (const verb of TIMER_START_VERBS) {
    const m = c.match(buildVP(verb));
    if (!m) continue;
    const rest = m[1].trim();
    // Remove trailing "timer" word
    const clean = rest.replace(/\s*timer\s*$/, '').trim();
    const dur = parseDuration(clean);
    if (dur) return { type: 'START_TIMER', totalMs: dur.totalMs, durationDisplay: dur.display };
  }
  // Pattern B: duration + "timer" ("10 minute timer", "90 second timer")
  const timerPattern = /^(\d+)\s*(hour|minute|min|second|sec)s?\s+timer$/;
  const tp = c.match(timerPattern);
  if (tp) {
    const dur = parseDuration(c.replace(/\s*timer\s*$/, ''));
    if (dur) return { type: 'START_TIMER', totalMs: dur.totalMs, durationDisplay: dur.display };
  }
  return null;
}

function tryCancelTimer(c: string): ParsedCommand | null {
  return TIMER_CANCEL_KW.some((kw) => c.includes(kw)) ? { type: 'CANCEL_TIMER' } : null;
}

function tryQueryTimer(c: string): ParsedCommand | null {
  return TIMER_QUERY_KW.some((kw) => c.includes(kw)) ? { type: 'QUERY_TIMER' } : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// New parse passes — Stopwatch
// ═══════════════════════════════════════════════════════════════════════════════

function tryStopwatch(c: string): ParsedCommand | null {
  if (STOPWATCH_RESET_KW.some((kw)  => c.includes(kw))) return { type: 'STOPWATCH', action: 'reset' };
  if (STOPWATCH_RESUME_KW.some((kw) => c.includes(kw))) return { type: 'STOPWATCH', action: 'resume' };
  if (STOPWATCH_PAUSE_KW.some((kw)  => c.includes(kw))) return { type: 'STOPWATCH', action: 'pause' };
  if (STOPWATCH_STOP_KW.some((kw)   => c.includes(kw))) return { type: 'STOPWATCH', action: 'stop' };
  if (STOPWATCH_START_KW.some((kw)  => c.includes(kw))) return { type: 'STOPWATCH', action: 'start' };
  if (STOPWATCH_QUERY_KW.some((kw)  => c.includes(kw))) return { type: 'STOPWATCH', action: 'query' };
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// New parse passes — Reminders
// ═══════════════════════════════════════════════════════════════════════════════

function trySetReminder(c: string): ParsedCommand | null {
  for (const verb of REMINDER_SET_VERBS) {
    const m = c.match(buildVP(verb));
    if (!m) continue;
    const rest = m[1].trim(); // e.g. "study at 7 pm" or "drink water in 30 minutes"

    // Extract time from the rest
    const timeExpr = parseAbsoluteTime(rest);
    if (!timeExpr) continue;

    // Remove time tokens to get the message
    const message = extractMessageFromReminderRest(rest, timeExpr.display);
    if (!message) continue;

    return {
      type: 'SET_REMINDER',
      message,
      timeDisplay: timeExpr.display,
      triggerMs: timeExpr.date.getTime(),
    };
  }
  return null;
}

function extractMessageFromReminderRest(rest: string, _display: string): string {
  // Strip time keywords: "at 7 pm", "in 30 minutes", "tomorrow at 8 am", etc.
  let msg = rest
    .replace(/\s+(?:at|in|for|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, '')
    .replace(/\s+(?:tomorrow|tonight|today|noon|midnight)\b/i, '')
    .replace(/\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, '')
    .replace(/\s+in\s+\d+\s+(?:hours?|minutes?|seconds?)\b/i, '')
    .trim();
  return msg.length >= 2 ? msg : '';
}

function tryListReminders(c: string): ParsedCommand | null {
  return REMINDER_LIST_KW.some((kw) => c.includes(kw)) ? { type: 'LIST_REMINDERS' } : null;
}

function tryDeleteReminder(c: string): ParsedCommand | null {
  return REMINDER_DELETE_KW.some((kw) => c.includes(kw)) ? { type: 'DELETE_REMINDER' } : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// New parse passes — Calendar
// ═══════════════════════════════════════════════════════════════════════════════

function tryCreateEvent(c: string): ParsedCommand | null {
  for (const verb of EVENT_CREATE_VERBS) {
    const m = c.match(buildVP(verb));
    if (!m) continue;
    const rest = m[1].trim(); // e.g. "tomorrow at 10 am", "physics test on friday"

    const timeExpr = parseAbsoluteTime(rest);
    if (!timeExpr) continue;

    // Extract title: remove time tokens
    let title = rest
      .replace(/\s*(?:at|on)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, '')
      .replace(/\b(tomorrow|today|tonight|noon|midnight)\b/i, '')
      .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, '')
      .trim();

    if (!title) title = 'Meeting';

    // Capitalise first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    const startMs  = timeExpr.date.getTime();
    const endMs    = startMs + 60 * 60 * 1_000; // default 1-hour event

    return { type: 'CREATE_EVENT', title, timeDisplay: timeExpr.display, startMs, endMs };
  }
  return null;
}

function tryListEvents(c: string): ParsedCommand | null {
  return EVENT_LIST_KW.some((kw) => c.includes(kw)) ? { type: 'LIST_EVENTS' } : null;
}

function tryDeleteEvent(c: string): ParsedCommand | null {
  return EVENT_DELETE_KW.some((kw) => c.includes(kw)) ? { type: 'DELETE_EVENT' } : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function normalise(text: string): string {
  let s = text.toLowerCase().replace(/[.,!?'"]/g, '').replace(/\s+/g, ' ').trim();
  for (const prefix of POLITE_PREFIXES) s = s.replace(prefix, '');
  return s;
}

function buildVP(verb: string): RegExp {
  return new RegExp(`^${verb.replace(/\s+/g, '\\s+')}\\s+(.+)$`);
}

function findApp(candidate: string): AppDefinition | undefined {
  for (const app of APP_REGISTRY) { if (app.keywords.some((kw) => kw === candidate)) return app; }
  for (const app of APP_REGISTRY) { if (app.keywords.some((kw) => candidate.includes(kw))) return app; }
  for (const app of APP_REGISTRY) { if (app.keywords.some((kw) => kw.includes(candidate))) return app; }
  return undefined;
}

function extractInlineMsg(rest: string): { contactName: string; message: string } | null {
  for (const pat of INLINE_MSG_PAT) {
    const m = rest.match(pat);
    if (!m) continue;
    const name = m[1].trim().replace(FILLER_WORDS, '').trim();
    const msg  = m[2].trim();
    if (name.length >= 2 && msg.length >= 1) return { contactName: name, message: msg };
  }
  return null;
}
