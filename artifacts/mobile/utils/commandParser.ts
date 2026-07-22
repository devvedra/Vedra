/**
 * commandParser.ts — Vedra Command Parser (v0.8)
 *
 * Fast-path keyword parser. Runs before the intent engine so the most common
 * commands resolve in O(keywords) with zero scoring overhead.
 *
 * Covers all feature versions:
 *  v0.1  Open Apps, Calls, SMS
 *  v0.2  Alarms, Timers, Stopwatch
 *  v0.3  Reminders, Calendar
 *  v0.4  Flashlight, Volume, Brightness, Battery, Wi-Fi, Bluetooth
 *  v0.5  (architecture refactor — no new commands)
 *  v0.6  Device Controls polish
 *  v0.7  Media Controls, Notification Reader, Device Info, Quick Actions
 *  v0.8  Memory, Study Assistant
 */

import {
  parseDuration,
  parseAbsoluteTime,
  buildDurationDisplay,
} from './timeParser';

// Convenience shim so existing try* functions can call timeParser.parseDuration etc.
const timeParser = {
  parseDuration: (text: string) => parseDuration(text),
  parseTimePhrase: (text: string) => parseAbsoluteTime(text),
};

// ═══════════════════════════════════════════════════════════════════════════════
// App Registry
// ═══════════════════════════════════════════════════════════════════════════════

export interface AppDefinition {
  displayName: string;
  packageName?: string;          // primary package (null = use intentAction)
  packageOptions?: string[];     // fallback packages tried in order
  intentAction?: string;         // Android intent action (alternative to package)
  intentCategory?: string;
  keywords: string[];            // lowercase match strings
}

export const APP_REGISTRY_PUBLIC: AppDefinition[] = [
  // Communication
  { displayName: 'WhatsApp',    packageName: 'com.whatsapp',             keywords: ['whatsapp', 'whats app'] },
  { displayName: 'Telegram',    packageName: 'org.telegram.messenger',   keywords: ['telegram'] },
  { displayName: 'Instagram',   packageName: 'com.instagram.android',    keywords: ['instagram', 'insta'] },
  { displayName: 'Facebook',    packageName: 'com.facebook.katana',      keywords: ['facebook', 'fb'] },
  { displayName: 'Twitter/X',   packageName: 'com.twitter.android',      packageOptions: ['com.twitter.android', 'com.x.android'], keywords: ['twitter', 'x app'] },
  { displayName: 'Snapchat',    packageName: 'com.snapchat.android',     keywords: ['snapchat', 'snap'] },
  { displayName: 'Discord',     packageName: 'com.discord',              keywords: ['discord'] },
  { displayName: 'LinkedIn',    packageName: 'com.linkedin.android',     keywords: ['linkedin', 'linked in'] },
  { displayName: 'Signal',      packageName: 'org.thoughtcrime.securesms', keywords: ['signal'] },
  { displayName: 'Skype',       packageName: 'com.skype.raider',         keywords: ['skype'] },
  { displayName: 'Zoom',        packageName: 'us.zoom.videomeetings',    keywords: ['zoom'] },
  { displayName: 'Meet',        packageName: 'com.google.android.apps.meetings', keywords: ['google meet', 'meet'] },
  { displayName: 'Teams',       packageName: 'com.microsoft.teams',      keywords: ['microsoft teams', 'teams'] },
  { displayName: 'Gmail',       packageName: 'com.google.android.gm',   keywords: ['gmail', 'email', 'mail'] },
  // Productivity
  { displayName: 'Maps',        packageName: 'com.google.android.apps.maps', keywords: ['google maps', 'maps'] },
  { displayName: 'YouTube',     packageName: 'com.google.android.youtube', keywords: ['youtube', 'yt'] },
  { displayName: 'Chrome',      packageName: 'com.android.chrome',      keywords: ['chrome', 'browser', 'google chrome'] },
  { displayName: 'Calculator',  packageOptions: ['com.google.android.calculator', 'com.samsung.android.calculator', 'com.miui.calculator'], keywords: ['calculator', 'calc'] },
  { displayName: 'Calendar',    packageName: 'com.google.android.calendar', keywords: ['google calendar'] },
  { displayName: 'Clock',       packageOptions: ['com.google.android.deskclock', 'com.samsung.android.app.clockpackage'], keywords: ['clock'] },
  { displayName: 'Contacts',    packageName: 'com.google.android.contacts', keywords: ['contacts'] },
  { displayName: 'Phone',       packageName: 'com.google.android.dialer', keywords: ['phone app', 'dialer'] },
  { displayName: 'Messages',    packageName: 'com.google.android.apps.messaging', keywords: ['messages app', 'sms app'] },
  { displayName: 'Drive',       packageName: 'com.google.android.apps.docs', keywords: ['google drive', 'drive'] },
  { displayName: 'Docs',        packageName: 'com.google.android.apps.docs', keywords: ['google docs', 'docs'] },
  { displayName: 'Sheets',      packageName: 'com.google.android.apps.spreadsheets', keywords: ['google sheets', 'sheets'] },
  { displayName: 'Photos',      packageOptions: ['com.google.android.apps.photos', 'com.samsung.android.gallery3d'], keywords: ['photos', 'gallery'] },
  { displayName: 'Camera',      intentAction: 'android.media.action.STILL_IMAGE_CAMERA', keywords: ['camera'] },
  { displayName: 'Settings',    intentAction: 'android.settings.SETTINGS', keywords: ['settings', 'android settings'] },
  { displayName: 'File Manager',packageOptions: ['com.google.android.documentsui', 'com.samsung.android.myfiles', 'com.miui.filemanager'], keywords: ['file manager', 'files', 'file explorer'] },
  // Entertainment
  { displayName: 'Spotify',     packageName: 'com.spotify.music',       keywords: ['spotify'] },
  { displayName: 'Netflix',     packageName: 'com.netflix.mediaclient', keywords: ['netflix'] },
  { displayName: 'Amazon Prime',packageName: 'com.amazon.avod.thirdpartyclient', keywords: ['prime video', 'amazon prime', 'prime'] },
  { displayName: 'Hotstar',     packageName: 'in.startv.hotstar',       keywords: ['hotstar', 'disney hotstar', 'disney+'] },
  { displayName: 'Amazon Music',packageName: 'com.amazon.mp3',          keywords: ['amazon music'] },
  { displayName: 'Gaana',       packageName: 'com.gaana',               keywords: ['gaana'] },
  { displayName: 'JioSaavn',    packageName: 'com.jio.media.jiomusic',  keywords: ['jiosaavn', 'saavn', 'jio music'] },
  // Finance / Shopping
  { displayName: 'PhonePe',     packageName: 'com.phonepe.app',         keywords: ['phonepe', 'phone pe'] },
  { displayName: 'GPay',        packageName: 'com.google.android.apps.nbu.paisa.user', keywords: ['gpay', 'google pay'] },
  { displayName: 'Paytm',       packageName: 'net.one97.paytm',         keywords: ['paytm'] },
  { displayName: 'Amazon',      packageName: 'in.amazon.mShop.android.shopping', keywords: ['amazon', 'amazon shopping'] },
  { displayName: 'Flipkart',    packageName: 'com.flipkart.android',    keywords: ['flipkart'] },
  // Ride / Food
  { displayName: 'Uber',        packageName: 'com.ubercab',             keywords: ['uber'] },
  { displayName: 'Ola',         packageName: 'com.olacabs.customer',    keywords: ['ola', 'ola cabs'] },
  { displayName: 'Swiggy',      packageName: 'in.swiggy.android',       keywords: ['swiggy'] },
  { displayName: 'Zomato',      packageName: 'com.application.zomato',  keywords: ['zomato'] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ParsedCommand union — one type per intent
// ═══════════════════════════════════════════════════════════════════════════════

export type ParsedCommand =
  // ── v0.1 Core ──────────────────────────────────────────────────────────────
  | { type: 'OPEN_APP';          app: AppDefinition }
  | { type: 'CALL_CONTACT';      contactName: string }
  | { type: 'SEND_SMS';          contactName: string; message: string }
  // ── v0.2 Time ──────────────────────────────────────────────────────────────
  | { type: 'SET_ALARM';         hour: number; minute: number; timeDisplay: string }
  | { type: 'CANCEL_ALARM';      timeDisplay: string }
  | { type: 'LIST_ALARMS' }
  | { type: 'START_TIMER';       totalMs: number; durationDisplay: string }
  | { type: 'CANCEL_TIMER' }
  | { type: 'QUERY_TIMER' }
  | { type: 'STOPWATCH';         action: 'start' | 'stop' | 'pause' | 'resume' | 'reset' | 'lap' | 'read' }
  // ── v0.3 Reminders / Calendar ───────────────────────────────────────────────
  | { type: 'SET_REMINDER';      message: string; timeDisplay: string; triggerMs: number }
  | { type: 'LIST_REMINDERS' }
  | { type: 'DELETE_REMINDER' }
  | { type: 'CREATE_EVENT';      title: string; timeDisplay: string; startMs: number; endMs: number }
  | { type: 'LIST_EVENTS' }
  | { type: 'DELETE_EVENT' }
  // ── v0.4/v0.6 Device Controls ───────────────────────────────────────────────
  | { type: 'FLASHLIGHT_ON' }
  | { type: 'FLASHLIGHT_OFF' }
  | { type: 'VOLUME_UP' }
  | { type: 'VOLUME_DOWN' }
  | { type: 'VOLUME_SET';        percent: number }
  | { type: 'VOLUME_MUTE' }
  | { type: 'VOLUME_MAX' }
  | { type: 'BRIGHTNESS_UP' }
  | { type: 'BRIGHTNESS_DOWN' }
  | { type: 'BRIGHTNESS_SET';    percent: number }
  | { type: 'BRIGHTNESS_MIN' }
  | { type: 'BRIGHTNESS_MAX' }
  | { type: 'BATTERY_STATUS' }
  | { type: 'WIFI_ON' }
  | { type: 'WIFI_OFF' }
  | { type: 'BLUETOOTH_ON' }
  | { type: 'BLUETOOTH_OFF' }
  // ── v0.7 Media Controls ─────────────────────────────────────────────────────
  | { type: 'MEDIA_PLAY' }
  | { type: 'MEDIA_PAUSE' }
  | { type: 'MEDIA_RESUME' }
  | { type: 'MEDIA_NEXT' }
  | { type: 'MEDIA_PREVIOUS' }
  | { type: 'MEDIA_STOP' }
  | { type: 'MEDIA_VOLUME_UP' }
  | { type: 'MEDIA_VOLUME_DOWN' }
  // ── v0.7 Notifications ───────────────────────────────────────────────────────
  | { type: 'READ_NOTIFICATIONS';       appFilter?: string }
  | { type: 'READ_LATEST_NOTIFICATION' }
  | { type: 'CHECK_MESSAGES' }
  | { type: 'CLEAR_NOTIFICATIONS' }
  // ── v0.7 Device Info ────────────────────────────────────────────────────────
  | { type: 'DEVICE_INFO'; infoType: 'storage' | 'ram' | 'battery_health' | 'charging' | 'model' | 'android_version' | 'datetime' | 'all' }
  // ── v0.7 Quick Actions ───────────────────────────────────────────────────────
  | { type: 'QUICK_ACTION'; action: 'recent_apps' | 'go_home' | 'open_notifications' | 'quick_settings' | 'app_info' | 'wifi_settings' | 'bluetooth_settings' | 'display_settings'; appName?: string }
  // ── v0.8 Memory ─────────────────────────────────────────────────────────────
  | { type: 'MEMORY_STORE_NAME'; name: string }
  | { type: 'MEMORY_QUERY_NAME' }
  // ── v0.8 Study Assistant ────────────────────────────────────────────────────
  | { type: 'STUDY_TIMER';       minutes: number }
  | { type: 'STUDY_REMINDERS' }
  | { type: 'STUDY_CHECKLIST' };

// ═══════════════════════════════════════════════════════════════════════════════
// Normalise helper
// ═══════════════════════════════════════════════════════════════════════════════

const POLITE = [
  /^please\s+/, /^can you please\s+/, /^can you\s+/, /^could you please\s+/,
  /^could you\s+/, /^hey vedra[,.]?\s+/, /^ok vedra[,.]?\s+/, /^vedra[,.]?\s+/,
  /^i'd like (?:you )?to\s+/, /^i would like (?:you )?to\s+/,
];

function norm(raw: string): string {
  let s = raw.toLowerCase().trim().replace(/['']/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const p of POLITE) s = s.replace(p, '');
  return s.trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Individual parse passes
// ═══════════════════════════════════════════════════════════════════════════════

// ── Open App ──────────────────────────────────────────────────────────────────

const OPEN_PREFIXES = ['open ', 'launch ', 'start ', 'go to ', 'show me ', 'take me to ', 'get me ', 'run '];

function tryOpenApp(c: string): ParsedCommand | null {
  for (const prefix of OPEN_PREFIXES) {
    if (!c.startsWith(prefix)) continue;
    const rest = c.slice(prefix.length);
    for (const app of APP_REGISTRY_PUBLIC) {
      if (app.keywords.some(kw => rest.includes(kw))) return { type: 'OPEN_APP', app };
    }
  }
  // Also direct keyword match without prefix
  for (const app of APP_REGISTRY_PUBLIC) {
    if (app.keywords.some(kw => c === kw)) return { type: 'OPEN_APP', app };
  }
  return null;
}

// ── Call Contact ──────────────────────────────────────────────────────────────

const CALL_KW = ['call ', 'phone ', 'ring ', 'dial '];

function tryCallContact(c: string): ParsedCommand | null {
  for (const kw of CALL_KW) {
    if (!c.includes(kw)) continue;
    const idx = c.indexOf(kw);
    const raw = c.slice(idx + kw.length).trim();
    const name = raw.replace(/\s+(now|please|up)$/, '').trim();
    if (name.length >= 2) return { type: 'CALL_CONTACT', contactName: name };
  }
  return null;
}

// ── Send SMS ──────────────────────────────────────────────────────────────────

const SMS_PREFIXES = ['text ', 'sms ', 'message ', 'send a text to ', 'send message to ', 'send sms to '];
const SMS_BODY_PAT = [
  /(?:saying|that|with the message|message)\s+(.+)$/,
  /:\s+(.+)$/,
];

function trySendSms(c: string): ParsedCommand | null {
  for (const prefix of SMS_PREFIXES) {
    if (!c.startsWith(prefix)) continue;
    const rest = c.slice(prefix.length).trim();
    for (const pat of SMS_BODY_PAT) {
      const m = rest.match(pat);
      if (!m) continue;
      const name = rest.slice(0, rest.length - m[0].length).trim().replace(/^to\s+/, '');
      const message = m[1].trim();
      if (name.length >= 2 && message.length >= 1) return { type: 'SEND_SMS', contactName: name, message };
    }
    // No body yet — still a valid SMS intent, body to be collected later
    const name = rest.replace(/^to\s+/, '').trim();
    if (name.length >= 2) return { type: 'SEND_SMS', contactName: name, message: '' };
  }
  return null;
}

// ── Alarm ─────────────────────────────────────────────────────────────────────

const SET_ALARM_KW    = ['set alarm', 'set an alarm', 'alarm at', 'alarm for', 'wake me', 'wake me up'];
const CANCEL_ALARM_KW = ['cancel alarm', 'delete alarm', 'remove alarm', 'turn off alarm', 'stop alarm'];
const LIST_ALARM_KW   = ['list alarms', 'show alarms', 'my alarms', 'what alarms', 'all alarms'];

function tryAlarm(c: string): ParsedCommand | null {
  if (LIST_ALARM_KW.some(kw => c.includes(kw))) return { type: 'LIST_ALARMS' };

  if (CANCEL_ALARM_KW.some(kw => c.includes(kw))) {
    const parsed = timeParser.parseTimePhrase(c);
    const display = parsed ? parsed.display : 'the alarm';
    return { type: 'CANCEL_ALARM', timeDisplay: display };
  }

  if (SET_ALARM_KW.some(kw => c.includes(kw))) {
    const parsed = timeParser.parseTimePhrase(c);
    if (parsed) {
      const d = parsed.date;
      return { type: 'SET_ALARM', hour: d.getHours(), minute: d.getMinutes(), timeDisplay: parsed.display };
    }
  }
  return null;
}

// ── Timer ─────────────────────────────────────────────────────────────────────

const START_TIMER_KW  = ['start a timer', 'start timer', 'set a timer', 'set timer', 'timer for', 'countdown'];
const CANCEL_TIMER_KW = ['cancel timer', 'stop timer', 'clear timer', 'delete timer'];
const QUERY_TIMER_KW  = ['how much time', 'time left', 'timer status', 'check timer', 'remaining time'];

function tryTimer(c: string): ParsedCommand | null {
  if (QUERY_TIMER_KW.some(kw  => c.includes(kw))) return { type: 'QUERY_TIMER' };
  if (CANCEL_TIMER_KW.some(kw => c.includes(kw))) return { type: 'CANCEL_TIMER' };

  if (START_TIMER_KW.some(kw  => c.includes(kw))) {
    const dur = timeParser.parseDuration(c);
    if (dur) return { type: 'START_TIMER', totalMs: dur.totalMs, durationDisplay: dur.display };
  }

  // "10 minute timer" / "5 second timer" without a prefix
  const dur = timeParser.parseDuration(c);
  if (dur && (c.includes('timer') || c.includes('countdown'))) {
    return { type: 'START_TIMER', totalMs: dur.totalMs, durationDisplay: dur.display };
  }
  return null;
}

// ── Stopwatch ─────────────────────────────────────────────────────────────────

const STOPWATCH_MAP: [string[], ParsedCommand['type'] & 'STOPWATCH', string][] = [
  [['start stopwatch', 'start the stopwatch', 'begin stopwatch', 'stopwatch start'],   'STOPWATCH', 'start'],
  [['stop stopwatch', 'pause stopwatch', 'pause the stopwatch'],                       'STOPWATCH', 'pause'],
  [['resume stopwatch', 'resume the stopwatch', 'continue stopwatch'],                 'STOPWATCH', 'resume'],
  [['reset stopwatch', 'clear stopwatch', 'restart stopwatch'],                        'STOPWATCH', 'reset'],
  [['lap stopwatch', 'stopwatch lap', 'record lap'],                                   'STOPWATCH', 'lap'],
  [['read stopwatch', 'stopwatch time', 'what is stopwatch', 'stopwatch status'],      'STOPWATCH', 'read'],
];

function tryStopwatch(c: string): ParsedCommand | null {
  if (!c.includes('stopwatch')) return null;
  for (const [kws, , action] of STOPWATCH_MAP) {
    if (kws.some(kw => c.includes(kw))) return { type: 'STOPWATCH', action: action as any };
  }
  return null;
}

// ── Reminder ──────────────────────────────────────────────────────────────────

const SET_REMINDER_KW    = ['remind me', 'set a reminder', 'set reminder', 'add reminder', 'reminder to', 'reminder at'];
const LIST_REMINDER_KW   = ['list reminders', 'show reminders', 'my reminders', 'all reminders'];
const DELETE_REMINDER_KW = ['delete reminder', 'cancel reminder', 'remove reminder', 'clear reminder'];

function tryReminder(c: string): ParsedCommand | null {
  if (LIST_REMINDER_KW.some(kw   => c.includes(kw))) return { type: 'LIST_REMINDERS' };
  if (DELETE_REMINDER_KW.some(kw => c.includes(kw))) return { type: 'DELETE_REMINDER' };

  if (SET_REMINDER_KW.some(kw => c.includes(kw))) {
    const parsed = timeParser.parseTimePhrase(c);
    if (parsed) {
      // Strip the "remind me to" preamble and time portion to get the message
      let msg = c;
      for (const kw of SET_REMINDER_KW) msg = msg.replace(kw, '');
      msg = msg.replace(/\b(?:at|on|by|in)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '').replace(/\s*(at|on|by|in)\s*$/, '').trim();
      if (!msg) msg = 'reminder';
      return { type: 'SET_REMINDER', message: msg, timeDisplay: parsed.display, triggerMs: parsed.date.getTime() };
    }
  }
  return null;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

const CREATE_EVENT_KW = ['create event', 'add event', 'schedule', 'schedule meeting', 'add meeting', 'create meeting', 'book meeting'];
const LIST_EVENT_KW   = ['list events', 'show events', 'my events', 'my schedule', 'what events', 'upcoming events'];
const DELETE_EVENT_KW = ['delete event', 'cancel event', 'remove event', 'delete meeting', 'cancel meeting'];

function tryCalendar(c: string): ParsedCommand | null {
  if (LIST_EVENT_KW.some(kw   => c.includes(kw))) return { type: 'LIST_EVENTS' };
  if (DELETE_EVENT_KW.some(kw => c.includes(kw))) return { type: 'DELETE_EVENT' };

  if (CREATE_EVENT_KW.some(kw => c.includes(kw))) {
    const parsed = timeParser.parseTimePhrase(c);
    let title = c;
    for (const kw of CREATE_EVENT_KW) title = title.replace(kw, '');
    if (parsed) title = title.replace(/\b(?:at|on|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '');
    title = title.replace(/\s*(at|on|for|from|to)\s*$/g, '').replace(/^\s*(at|on|for)\s+/, '').trim();
    if (!title) title = 'Event';
    const startMs = parsed?.date.getTime() ?? Date.now();
    const endMs   = startMs + 60 * 60 * 1000; // default 1 hour
    return { type: 'CREATE_EVENT', title, timeDisplay: parsed?.display ?? 'scheduled', startMs, endMs };
  }
  return null;
}

// ── Flashlight ────────────────────────────────────────────────────────────────

const TORCH_ON_KW  = ['turn on flashlight', 'turn on torch', 'flashlight on', 'torch on', 'enable flashlight', 'enable torch', 'switch on flashlight', 'switch on torch', 'flash light on', 'flash on'];
const TORCH_OFF_KW = ['turn off flashlight', 'turn off torch', 'flashlight off', 'torch off', 'disable flashlight', 'disable torch', 'switch off flashlight', 'switch off torch', 'flash off'];

function tryFlashlight(c: string): ParsedCommand | null {
  if (TORCH_OFF_KW.some(kw => c.includes(kw))) return { type: 'FLASHLIGHT_OFF' };
  if (TORCH_ON_KW.some(kw  => c.includes(kw))) return { type: 'FLASHLIGHT_ON' };
  return null;
}

// ── Volume ────────────────────────────────────────────────────────────────────

const VOL_UP_KW   = ['volume up', 'increase volume', 'louder', 'turn up volume', 'raise volume', 'higher volume'];
const VOL_DOWN_KW = ['volume down', 'decrease volume', 'quieter', 'turn down volume', 'lower volume', 'reduce volume'];
const VOL_MUTE_KW = ['mute', 'silence', 'mute volume', 'silent mode', 'no sound'];
const VOL_MAX_KW  = ['max volume', 'maximum volume', 'full volume', 'volume max'];
const VOL_SET_PAT = /(?:set|change|put) (?:the )?volume (?:to |at )?(\d{1,3})(?: ?%| percent)/;

function tryVolume(c: string): ParsedCommand | null {
  if (VOL_MAX_KW.some(kw  => c.includes(kw))) return { type: 'VOLUME_MAX' };
  if (VOL_MUTE_KW.some(kw => c.includes(kw))) return { type: 'VOLUME_MUTE' };
  const setM = c.match(VOL_SET_PAT);
  if (setM) return { type: 'VOLUME_SET', percent: Math.min(100, parseInt(setM[1], 10)) };
  if (VOL_UP_KW.some(kw   => c.includes(kw))) return { type: 'VOLUME_UP' };
  if (VOL_DOWN_KW.some(kw => c.includes(kw))) return { type: 'VOLUME_DOWN' };
  return null;
}

// ── Brightness ────────────────────────────────────────────────────────────────

const BRIGHT_UP_KW  = ['brightness up', 'increase brightness', 'brighter', 'raise brightness', 'higher brightness', 'turn up brightness'];
const BRIGHT_DOWN_KW= ['brightness down', 'decrease brightness', 'dimmer', 'lower brightness', 'reduce brightness', 'turn down brightness'];
const BRIGHT_MIN_KW = ['min brightness', 'minimum brightness', 'lowest brightness', 'dim screen'];
const BRIGHT_MAX_KW = ['max brightness', 'maximum brightness', 'full brightness', 'brightest'];
const BRIGHT_SET_PAT= /(?:set|change|put) (?:the )?brightness (?:to |at )?(\d{1,3})(?: ?%| percent)/;

function tryBrightness(c: string): ParsedCommand | null {
  if (BRIGHT_MAX_KW.some(kw => c.includes(kw))) return { type: 'BRIGHTNESS_MAX' };
  if (BRIGHT_MIN_KW.some(kw => c.includes(kw))) return { type: 'BRIGHTNESS_MIN' };
  const setM = c.match(BRIGHT_SET_PAT);
  if (setM) return { type: 'BRIGHTNESS_SET', percent: Math.min(100, parseInt(setM[1], 10)) };
  if (BRIGHT_UP_KW.some(kw   => c.includes(kw))) return { type: 'BRIGHTNESS_UP' };
  if (BRIGHT_DOWN_KW.some(kw => c.includes(kw))) return { type: 'BRIGHTNESS_DOWN' };
  return null;
}

// ── Battery ───────────────────────────────────────────────────────────────────

const BATTERY_KW = ['battery', 'battery level', 'battery percentage', 'battery percent', 'battery status', 'how much charge', 'is charging', 'charging status', 'power level', 'charge level'];

function tryBattery(c: string): ParsedCommand | null {
  if (BATTERY_KW.some(kw => c.includes(kw))) return { type: 'BATTERY_STATUS' };
  return null;
}

// ── Connectivity ──────────────────────────────────────────────────────────────

const WIFI_ON_KW  = ['turn on wifi', 'turn on wi-fi', 'wifi on', 'wi-fi on', 'enable wifi', 'enable wi-fi', 'switch on wifi', 'connect wifi'];
const WIFI_OFF_KW = ['turn off wifi', 'turn off wi-fi', 'wifi off', 'wi-fi off', 'disable wifi', 'disable wi-fi', 'switch off wifi', 'disconnect wifi'];
const BT_ON_KW    = ['turn on bluetooth', 'bluetooth on', 'enable bluetooth', 'switch on bluetooth', 'connect bluetooth'];
const BT_OFF_KW   = ['turn off bluetooth', 'bluetooth off', 'disable bluetooth', 'switch off bluetooth', 'disconnect bluetooth'];

function tryConnectivity(c: string): ParsedCommand | null {
  if (WIFI_OFF_KW.some(kw => c.includes(kw))) return { type: 'WIFI_OFF' };
  if (WIFI_ON_KW.some(kw  => c.includes(kw))) return { type: 'WIFI_ON' };
  if (BT_OFF_KW.some(kw   => c.includes(kw))) return { type: 'BLUETOOTH_OFF' };
  if (BT_ON_KW.some(kw    => c.includes(kw))) return { type: 'BLUETOOTH_ON' };
  return null;
}

// ── v0.7 Media Controls ───────────────────────────────────────────────────────

const MEDIA_RESUME_KW   = ['resume music', 'resume playback', 'resume the music', 'continue music', 'unpause music', 'unpause'];
const MEDIA_PAUSE_KW    = ['pause music', 'pause song', 'pause playback', 'pause the music', 'pause audio', 'pause media'];
const MEDIA_NEXT_KW     = ['next song', 'next track', 'skip song', 'skip track', 'play next', 'forward song', 'next music'];
const MEDIA_PREV_KW     = ['previous song', 'previous track', 'go back song', 'last song', 'play previous', 'back song', 'prev song'];
const MEDIA_STOP_KW     = ['stop music', 'stop song', 'stop playback', 'stop the music', 'stop audio', 'stop media'];
const MEDIA_VOL_UP_KW   = ['media volume up', 'increase media volume', 'louder music', 'music louder', 'turn up music', 'music volume up'];
const MEDIA_VOL_DOWN_KW = ['media volume down', 'decrease media volume', 'quieter music', 'music quieter', 'turn down music', 'music volume down'];
const MEDIA_PLAY_KW     = ['play music', 'play song', 'play audio', 'start music', 'start playing', 'play media', 'resume media'];

function tryMediaControl(c: string): ParsedCommand | null {
  if (MEDIA_RESUME_KW.some(kw   => c.includes(kw))) return { type: 'MEDIA_RESUME' };
  if (MEDIA_PAUSE_KW.some(kw    => c.includes(kw))) return { type: 'MEDIA_PAUSE' };
  if (MEDIA_NEXT_KW.some(kw     => c.includes(kw))) return { type: 'MEDIA_NEXT' };
  if (MEDIA_PREV_KW.some(kw     => c.includes(kw))) return { type: 'MEDIA_PREVIOUS' };
  if (MEDIA_STOP_KW.some(kw     => c.includes(kw))) return { type: 'MEDIA_STOP' };
  if (MEDIA_VOL_UP_KW.some(kw   => c.includes(kw))) return { type: 'MEDIA_VOLUME_UP' };
  if (MEDIA_VOL_DOWN_KW.some(kw => c.includes(kw))) return { type: 'MEDIA_VOLUME_DOWN' };
  if (MEDIA_PLAY_KW.some(kw     => c.includes(kw))) return { type: 'MEDIA_PLAY' };
  return null;
}

// ── v0.7 Notifications ────────────────────────────────────────────────────────

const CLEAR_NOTIF_KW   = ['clear all notifications', 'dismiss all notifications', 'clear notifications', 'dismiss notifications'];
const LATEST_NOTIF_KW  = ['read latest notification', 'read last notification', 'latest notification', 'last notification', 'most recent notification'];
const MSG_CHECK_KW     = ['any new messages', 'any messages', 'check messages', 'new messages', 'do i have messages', 'unread messages'];
const READ_NOTIF_KW    = ['read my notifications', 'read notifications', 'show my notifications', 'show notifications', 'read all notifications', 'what are my notifications'];
const READ_APP_PAT     = /^read\s+(\w+)\s+notifications?$/;

function tryReadNotifications(c: string): ParsedCommand | null {
  if (CLEAR_NOTIF_KW.some(kw  => c.includes(kw))) return { type: 'CLEAR_NOTIFICATIONS' };
  if (LATEST_NOTIF_KW.some(kw => c.includes(kw))) return { type: 'READ_LATEST_NOTIFICATION' };
  if (MSG_CHECK_KW.some(kw    => c.includes(kw))) return { type: 'CHECK_MESSAGES' };
  const appM = c.match(READ_APP_PAT);
  if (appM) return { type: 'READ_NOTIFICATIONS', appFilter: appM[1] };
  if (READ_NOTIF_KW.some(kw   => c.includes(kw))) return { type: 'READ_NOTIFICATIONS' };
  return null;
}

// ── v0.7 Device Info ─────────────────────────────────────────────────────────

const STORAGE_KW     = ['storage remaining', 'storage left', 'available storage', 'free storage', 'how much storage', 'disk space', 'space remaining', 'internal storage', 'storage space'];
const RAM_KW         = ['ram usage', 'available memory', 'free memory', 'how much ram', 'memory usage', 'how much memory', 'ram remaining'];
const BATT_HLTH_KW   = ['battery health', 'charging status', 'is it charging', 'is my phone charging', 'battery condition'];
const MODEL_KW       = ['device model', 'my phone model', 'what phone', 'which phone', 'phone model', 'what device', 'which device', 'my device'];
const ANDROID_VER_KW = ['android version', 'what android', 'which android', 'os version', 'operating system version', 'what version'];
const DATETIME_KW    = ['current date', 'todays date', 'what day is it', 'what is today', 'what date is it', 'current time', 'what time', 'what time is it', 'date and time'];
const ALL_INFO_KW    = ['device info', 'device information', 'system info', 'system information', 'about my phone', 'phone specs'];

function tryDeviceInfo(c: string): ParsedCommand | null {
  if (STORAGE_KW.some(kw     => c.includes(kw))) return { type: 'DEVICE_INFO', infoType: 'storage' };
  if (RAM_KW.some(kw         => c.includes(kw))) return { type: 'DEVICE_INFO', infoType: 'ram' };
  if (BATT_HLTH_KW.some(kw   => c.includes(kw))) return { type: 'DEVICE_INFO', infoType: 'battery_health' };
  if (MODEL_KW.some(kw       => c.includes(kw))) return { type: 'DEVICE_INFO', infoType: 'model' };
  if (ANDROID_VER_KW.some(kw => c.includes(kw))) return { type: 'DEVICE_INFO', infoType: 'android_version' };
  if (DATETIME_KW.some(kw    => c.includes(kw))) return { type: 'DEVICE_INFO', infoType: 'datetime' };
  if (ALL_INFO_KW.some(kw    => c.includes(kw))) return { type: 'DEVICE_INFO', infoType: 'all' };
  return null;
}

// ── v0.7 Quick Actions ────────────────────────────────────────────────────────

const RECENT_KW   = ['open recent apps', 'show recent apps', 'recent apps', 'switch apps', 'app switcher', 'multitasking'];
const HOME_KW     = ['go home', 'go to home', 'home screen', 'take me home', 'show home screen'];
const NOTIF_TRAY_KW = ['open notifications', 'show notification bar', 'pull down notifications', 'open notification shade', 'notification panel', 'open notification bar'];
const QSETTINGS_KW= ['open quick settings', 'quick settings', 'toggle settings panel', 'pull down settings', 'open quick tiles'];
const WIFI_SET_KW = ['open wifi settings', 'wifi settings', 'wi-fi settings', 'open wi-fi settings'];
const BT_SET_KW   = ['open bluetooth settings', 'bluetooth settings'];
const DISP_SET_KW = ['open display settings', 'display settings', 'screen settings', 'open screen settings'];
const APP_INFO_PAT= /^open\s+app\s+info\s+(?:for\s+)?(\w+)$/;

function tryQuickAction(c: string): ParsedCommand | null {
  if (RECENT_KW.some(kw    => c.includes(kw))) return { type: 'QUICK_ACTION', action: 'recent_apps' };
  if (HOME_KW.some(kw      => c.includes(kw))) return { type: 'QUICK_ACTION', action: 'go_home' };
  if (NOTIF_TRAY_KW.some(kw=> c.includes(kw))) return { type: 'QUICK_ACTION', action: 'open_notifications' };
  if (QSETTINGS_KW.some(kw => c.includes(kw))) return { type: 'QUICK_ACTION', action: 'quick_settings' };
  if (WIFI_SET_KW.some(kw  => c.includes(kw))) return { type: 'QUICK_ACTION', action: 'wifi_settings' };
  if (BT_SET_KW.some(kw    => c.includes(kw))) return { type: 'QUICK_ACTION', action: 'bluetooth_settings' };
  if (DISP_SET_KW.some(kw  => c.includes(kw))) return { type: 'QUICK_ACTION', action: 'display_settings' };
  const aiM = c.match(APP_INFO_PAT);
  if (aiM) return { type: 'QUICK_ACTION', action: 'app_info', appName: aiM[1] };
  return null;
}

// ── v0.8 Memory ───────────────────────────────────────────────────────────────

const NAME_STORE_KW = ['my name is', 'call me ', 'i am called', 'people call me', 'you can call me', "i'm called", 'i am '];
const NAME_QUERY_KW = ["what's my name", 'what is my name', 'do you know my name', 'my name', 'remember my name', 'do you remember my name'];
const NAME_STORE_PAT = [
  /my name is (\w+)/,
  /call me (\w+)/,
  /i(?:'m| am)(?: called)? (\w+)/,
  /(?:people |you can )?call me (\w+)/,
];

function tryMemory(c: string): ParsedCommand | null {
  if (NAME_QUERY_KW.some(kw => c.includes(kw))) return { type: 'MEMORY_QUERY_NAME' };
  if (NAME_STORE_KW.some(kw => c.includes(kw))) {
    for (const pat of NAME_STORE_PAT) {
      const m = c.match(pat);
      if (m?.[1]) return { type: 'MEMORY_STORE_NAME', name: m[1] };
    }
  }
  return null;
}

// ── v0.8 Study Assistant ──────────────────────────────────────────────────────

const STUDY_TIMER_KW    = ['study timer', 'pomodoro', 'study session', 'focus timer', 'study for', 'focus session', 'focus for'];
const STUDY_REMINDER_KW = ["today's study reminders", 'my study reminders', 'show study reminders', 'study schedule', 'study reminders'];
const STUDY_LIST_KW     = ['study checklist', 'generate checklist', 'my checklist', 'show checklist', 'learning checklist', 'what should i study'];
const STUDY_DUR_PAT     = /(?:study|focus|work)(?:ing)? (?:for )?(\d+) (?:minute|min)s?/;
const POMODORO_PAT      = /pomodoro(?:\s+(\d+))?/;

function tryStudy(c: string): ParsedCommand | null {
  if (STUDY_LIST_KW.some(kw    => c.includes(kw))) return { type: 'STUDY_CHECKLIST' };
  if (STUDY_REMINDER_KW.some(kw=> c.includes(kw))) return { type: 'STUDY_REMINDERS' };

  if (STUDY_TIMER_KW.some(kw => c.includes(kw))) {
    const pomM = c.match(POMODORO_PAT);
    if (pomM) return { type: 'STUDY_TIMER', minutes: parseInt(pomM[1] ?? '25', 10) };
    const durM = c.match(STUDY_DUR_PAT);
    if (durM) return { type: 'STUDY_TIMER', minutes: parseInt(durM[1], 10) };
    // Default pomodoro = 25 minutes
    return { type: 'STUDY_TIMER', minutes: 25 };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main parse function — runs all passes in priority order
// ═══════════════════════════════════════════════════════════════════════════════

export function parseCommand(raw: string): ParsedCommand | null {
  const c = norm(raw);
  if (!c) return null;

  // Run each pass. Return on first match.
  return (
    tryMemory(c)            ||  // memory first — "my name is" beats "call me"
    tryStudy(c)             ||
    tryOpenApp(c)           ||
    tryCallContact(c)       ||
    trySendSms(c)           ||
    tryAlarm(c)             ||
    tryTimer(c)             ||
    tryStopwatch(c)         ||
    tryReminder(c)          ||
    tryCalendar(c)          ||
    tryFlashlight(c)        ||
    tryBrightness(c)        ||  // brightness before volume ("max brightness" vs "max volume")
    tryVolume(c)            ||
    tryBattery(c)           ||
    tryConnectivity(c)      ||
    tryMediaControl(c)      ||
    tryReadNotifications(c) ||
    tryDeviceInfo(c)        ||
    tryQuickAction(c)       ||
    null
  );
}
