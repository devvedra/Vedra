/**
 * commandParser.ts — Vedra Command Parser (v0.6)
 *
 * Parses free-form voice transcripts into typed commands, entirely offline
 * using string matching. No network calls, no AI services.
 *
 * ── Supported command types ─────────────────────────────────────────────────
 *
 *  OPEN_APP        — "Open WhatsApp", "Launch Chrome"…
 *  CALL_CONTACT    — "Call Mom", "Dial Rahul"…
 *  SEND_SMS        — "Text Mom saying I'll be late"…
 *  SET_ALARM       — "Set alarm for 6 AM", "Wake me at 5:30"…
 *  CANCEL_ALARM    — "Cancel my alarm", "Delete 6 AM alarm"…
 *  LIST_ALARMS     — "Show my alarms", "What alarms do I have?"…
 *  START_TIMER     — "Start a 10 minute timer", "Set timer for 25 min"…
 *  CANCEL_TIMER    — "Cancel timer", "Stop timer"…
 *  QUERY_TIMER     — "How much time is left?", "Check timer"…
 *  STOPWATCH       — "Start stopwatch", "Pause stopwatch"…
 *  SET_REMINDER    — "Remind me to study at 7 PM"…
 *  LIST_REMINDERS  — "Show my reminders"…
 *  DELETE_REMINDER — "Delete my reminder"…
 *  CREATE_EVENT    — "Create meeting tomorrow at 10 AM"…
 *  LIST_EVENTS     — "Show today's schedule", "What's on my calendar?"…
 *  DELETE_EVENT    — "Delete today's meeting"…
 *  FLASHLIGHT_ON   — "Turn on flashlight", "Torch on"…
 *  FLASHLIGHT_OFF  — "Turn off flashlight", "Torch off"…
 *  VOLUME_UP       — "Volume up", "Increase volume"…
 *  VOLUME_DOWN     — "Volume down", "Decrease volume"…
 *  VOLUME_SET      — "Set volume to 50 percent"…
 *  VOLUME_MUTE     — "Mute phone", "Mute"…
 *  VOLUME_MAX      — "Max volume", "Maximum volume"…
 *  BRIGHTNESS_UP   — "Increase brightness", "Brightness up"…
 *  BRIGHTNESS_DOWN — "Decrease brightness", "Brightness down"…
 *  BRIGHTNESS_SET  — "Set brightness to 70 percent"…
 *  BRIGHTNESS_MIN  — "Minimum brightness"…
 *  BRIGHTNESS_MAX  — "Maximum brightness"…
 *  BATTERY_STATUS  — "Battery percentage", "How much battery is left?"…
 *  WIFI_ON         — "Turn on Wi-Fi"…
 *  WIFI_OFF        — "Turn off Wi-Fi"…
 *  BLUETOOTH_ON    — "Turn on Bluetooth"…
 *  BLUETOOTH_OFF   — "Turn off Bluetooth"…
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
  | { type: 'DELETE_EVENT' }
  // ── Flashlight ─────────────────────────────────────────────────────────────
  | { type: 'FLASHLIGHT_ON' }
  | { type: 'FLASHLIGHT_OFF' }
  // ── Volume ─────────────────────────────────────────────────────────────────
  | { type: 'VOLUME_UP' }
  | { type: 'VOLUME_DOWN' }
  | { type: 'VOLUME_SET'; percent: number }
  | { type: 'VOLUME_MUTE' }
  | { type: 'VOLUME_MAX' }
  // ── Brightness ─────────────────────────────────────────────────────────────
  | { type: 'BRIGHTNESS_UP' }
  | { type: 'BRIGHTNESS_DOWN' }
  | { type: 'BRIGHTNESS_SET'; percent: number }
  | { type: 'BRIGHTNESS_MIN' }
  | { type: 'BRIGHTNESS_MAX' }
  // ── Battery ────────────────────────────────────────────────────────────────
  | { type: 'BATTERY_STATUS' }
  // ── Connectivity ───────────────────────────────────────────────────────────
  | { type: 'WIFI_ON' }
  | { type: 'WIFI_OFF' }
  | { type: 'BLUETOOTH_ON' }
  | { type: 'BLUETOOTH_OFF' };

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
    tryOpenApp(cleaned)        ??
    tryCallContact(cleaned)    ??
    trySendSms(cleaned)        ??
    trySetAlarm(cleaned)       ??
    tryCancelAlarm(cleaned)    ??
    tryListAlarms(cleaned)     ??
    tryStartTimer(cleaned)     ??
    tryCancelTimer(cleaned)    ??
    tryQueryTimer(cleaned)     ??
    tryStopwatch(cleaned)      ??
    trySetReminder(cleaned)    ??
    tryListReminders(cleaned)  ??
    tryDeleteReminder(cleaned) ??
    tryCreateEvent(cleaned)    ??
    tryListEvents(cleaned)     ??
    tryDeleteEvent(cleaned)    ??
    // ── v0.6 device controls (checked after all existing commands) ──
    tryFlashlightOn(cleaned)   ??
    tryFlashlightOff(cleaned)  ??
    tryVolumeUp(cleaned)       ??
    tryVolumeDown(cleaned)     ??
    tryVolumeSet(cleaned)      ??
    tryVolumeMute(cleaned)     ??
    tryVolumeMax(cleaned)      ??
    tryBrightnessUp(cleaned)   ??
    tryBrightnessDown(cleaned) ??
    tryBrightnessSet(cleaned)  ??
    tryBrightnessMin(cleaned)  ??
    tryBrightnessMax(cleaned)  ??
    tryBatteryStatus(cleaned)  ??
    tryWifiOn(cleaned)         ??
    tryWifiOff(cleaned)        ??
    tryBluetoothOn(cleaned)    ??
    tryBluetoothOff(cleaned)   ??
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
// v0.6 parse passes — Flashlight
// ═══════════════════════════════════════════════════════════════════════════════

const FLASH_ON_KW  = ['turn on flashlight','turn on torch','flashlight on','torch on','enable flashlight','enable torch','switch on flashlight','switch on torch','put on flashlight'];
const FLASH_OFF_KW = ['turn off flashlight','turn off torch','flashlight off','torch off','disable flashlight','disable torch','switch off flashlight','switch off torch','put off flashlight'];

function tryFlashlightOn(c: string):  ParsedCommand | null { return FLASH_ON_KW.some(kw  => c.includes(kw)) ? { type: 'FLASHLIGHT_ON'  } : null; }
function tryFlashlightOff(c: string): ParsedCommand | null { return FLASH_OFF_KW.some(kw => c.includes(kw)) ? { type: 'FLASHLIGHT_OFF' } : null; }

// ═══════════════════════════════════════════════════════════════════════════════
// v0.6 parse passes — Volume
// ═══════════════════════════════════════════════════════════════════════════════

const VOLUME_UP_KW   = ['increase volume','volume up','louder','turn up volume','turn volume up','raise volume','increase the volume'];
const VOLUME_DOWN_KW = ['decrease volume','volume down','quieter','lower volume','turn down volume','turn volume down','reduce volume','decrease the volume'];
const VOLUME_MUTE_KW = ['mute phone','mute the phone','mute','silence phone','silence the phone','put on silent'];
const VOLUME_MAX_KW  = ['max volume','maximum volume','full volume','volume full','turn volume up all the way','highest volume'];
// "set volume to N percent" / "volume to N%"
const VOLUME_SET_PAT = /(?:set volume to|volume to|set the volume to)\s+(\d+)\s*(?:percent|%)?/;

function tryVolumeUp(c: string):   ParsedCommand | null { return VOLUME_UP_KW.some(kw   => c.includes(kw)) ? { type: 'VOLUME_UP'   } : null; }
function tryVolumeDown(c: string): ParsedCommand | null { return VOLUME_DOWN_KW.some(kw => c.includes(kw)) ? { type: 'VOLUME_DOWN' } : null; }
function tryVolumeMute(c: string): ParsedCommand | null { return VOLUME_MUTE_KW.some(kw => c.includes(kw)) ? { type: 'VOLUME_MUTE' } : null; }
function tryVolumeMax(c: string):  ParsedCommand | null { return VOLUME_MAX_KW.some(kw  => c.includes(kw)) ? { type: 'VOLUME_MAX'  } : null; }
function tryVolumeSet(c: string): ParsedCommand | null {
  const m = c.match(VOLUME_SET_PAT);
  if (!m) return null;
  const percent = Math.max(0, Math.min(100, parseInt(m[1], 10)));
  return { type: 'VOLUME_SET', percent };
}

// ═══════════════════════════════════════════════════════════════════════════════
// v0.6 parse passes — Brightness
// ═══════════════════════════════════════════════════════════════════════════════

const BRIGHT_UP_KW   = ['increase brightness','brightness up','brighter','turn up brightness','raise brightness','increase the brightness'];
const BRIGHT_DOWN_KW = ['decrease brightness','brightness down','dimmer','dim screen','turn down brightness','lower brightness','decrease the brightness'];
const BRIGHT_MIN_KW  = ['minimum brightness','brightness minimum','lowest brightness','dim the screen completely'];
const BRIGHT_MAX_KW  = ['maximum brightness','brightness maximum','highest brightness','full brightness','brightest'];
const BRIGHT_SET_PAT = /(?:set brightness to|brightness to|set the brightness to)\s+(\d+)\s*(?:percent|%)?/;

function tryBrightnessUp(c: string):   ParsedCommand | null { return BRIGHT_UP_KW.some(kw   => c.includes(kw)) ? { type: 'BRIGHTNESS_UP'  } : null; }
function tryBrightnessDown(c: string): ParsedCommand | null { return BRIGHT_DOWN_KW.some(kw => c.includes(kw)) ? { type: 'BRIGHTNESS_DOWN'} : null; }
function tryBrightnessMin(c: string):  ParsedCommand | null { return BRIGHT_MIN_KW.some(kw  => c.includes(kw)) ? { type: 'BRIGHTNESS_MIN' } : null; }
function tryBrightnessMax(c: string):  ParsedCommand | null { return BRIGHT_MAX_KW.some(kw  => c.includes(kw)) ? { type: 'BRIGHTNESS_MAX' } : null; }
function tryBrightnessSet(c: string): ParsedCommand | null {
  const m = c.match(BRIGHT_SET_PAT);
  if (!m) return null;
  const percent = Math.max(0, Math.min(100, parseInt(m[1], 10)));
  return { type: 'BRIGHTNESS_SET', percent };
}

// ═══════════════════════════════════════════════════════════════════════════════
// v0.6 parse passes — Battery
// ═══════════════════════════════════════════════════════════════════════════════

const BATTERY_KW = ['battery percentage','battery percent','battery level','battery status','battery life','how much battery','how much battery is left','check battery','battery remaining','whats my battery','what is my battery'];

function tryBatteryStatus(c: string): ParsedCommand | null {
  return BATTERY_KW.some(kw => c.includes(kw)) ? { type: 'BATTERY_STATUS' } : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// v0.6 parse passes — Connectivity
// ═══════════════════════════════════════════════════════════════════════════════

const WIFI_ON_KW   = ['turn on wifi','turn on wi-fi','enable wifi','enable wi-fi','wifi on','wi-fi on','connect wifi','switch on wifi'];
const WIFI_OFF_KW  = ['turn off wifi','turn off wi-fi','disable wifi','disable wi-fi','wifi off','wi-fi off','disconnect wifi','switch off wifi'];
const BT_ON_KW     = ['turn on bluetooth','enable bluetooth','bluetooth on','switch on bluetooth'];
const BT_OFF_KW    = ['turn off bluetooth','disable bluetooth','bluetooth off','switch off bluetooth'];

function tryWifiOn(c: string):      ParsedCommand | null { return WIFI_ON_KW.some(kw  => c.includes(kw)) ? { type: 'WIFI_ON'       } : null; }
function tryWifiOff(c: string):     ParsedCommand | null { return WIFI_OFF_KW.some(kw => c.includes(kw)) ? { type: 'WIFI_OFF'      } : null; }
function tryBluetoothOn(c: string): ParsedCommand | null { return BT_ON_KW.some(kw    => c.includes(kw)) ? { type: 'BLUETOOTH_ON'  } : null; }
function tryBluetoothOff(c: string):ParsedCommand | null { return BT_OFF_KW.some(kw   => c.includes(kw)) ? { type: 'BLUETOOTH_OFF' } : null; }

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
