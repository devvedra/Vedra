/**
 * intentEngine.ts — Vedra Natural Language Intent Engine (v0.8)
 *
 * Enhances the command parser with fuzzy phrase matching so Vedra understands
 * varied natural language phrasings — not just exact keyword prefixes.
 *
 * Architecture:
 *  1. Normalise input (lowercase, strip punctuation, strip polite prefixes)
 *  2. Run exact-keyword parse (existing commandParser logic — fast path)
 *  3. If no match, run intent-pattern scoring (this module)
 *  4. Return best-scoring IntentResult (or UNKNOWN if below threshold)
 *
 * Adding a new intent:
 *  1. Add its pattern group to INTENT_PATTERNS below.
 *  2. Add entity extractors if needed.
 *  3. Handle the new intent type in index.tsx.
 */

import { APP_REGISTRY_PUBLIC, type AppDefinition } from './commandParser';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IntentType =
  | 'OPEN_APP'
  | 'CALL_CONTACT'
  | 'SEND_SMS'
  | 'ALARM'
  | 'TIMER'
  | 'STOPWATCH'
  | 'REMINDER'
  | 'CALENDAR'
  | 'FLASHLIGHT'
  | 'VOLUME'
  | 'BRIGHTNESS'
  | 'BATTERY'
  | 'WIFI'
  | 'BLUETOOTH'
  | 'MEMORY_STORE_NAME'
  | 'MEMORY_QUERY_NAME'
  | 'SMALL_TALK'
  | 'STUDY_TIMER'
  | 'STUDY_REMINDERS'
  | 'STUDY_CHECKLIST'
  | 'DEVICE_INFO'
  | 'NOTIFICATIONS'
  | 'UNKNOWN';

export interface IntentResult {
  intent: IntentType;
  confidence: number;        // 0–1
  entities: Record<string, string>;
  rawInput: string;
  normalisedInput: string;
}

// ─── Pattern groups ────────────────────────────────────────────────────────────

interface PatternGroup {
  intent: IntentType;
  /**
   * Each pattern is a regex.  Named capture groups become entities.
   * Patterns are scored by length (more specific = higher confidence).
   */
  patterns: RegExp[];
  /**
   * Simple substring triggers — cheaper than regex, checked first.
   * Any match short-circuits to this intent at confidence 0.7.
   */
  triggers?: string[];
}

const INTENT_PATTERNS: PatternGroup[] = [
  // ── Memory: store name ────────────────────────────────────────────────────
  {
    intent: 'MEMORY_STORE_NAME',
    triggers: ['my name is', 'call me ', 'i am called', 'people call me', 'you can call me'],
    patterns: [
      /my name is (?<name>\w+)/,
      /call me (?<name>\w+)/,
      /i(?:'m| am) (?<name>\w+)/,
      /(?:people |you can )?call me (?<name>\w+)/,
    ],
  },
  // ── Memory: query name ────────────────────────────────────────────────────
  {
    intent: 'MEMORY_QUERY_NAME',
    triggers: ["what's my name", 'what is my name', 'do you know my name', 'my name'],
    patterns: [
      /what(?:'s| is) my name/,
      /do you (?:know|remember) my name/,
      /tell me my name/,
    ],
  },
  // ── Open app — extra phrasings beyond commandParser ───────────────────────
  {
    intent: 'OPEN_APP',
    triggers: ['i want to use', 'i want to open', 'take me to', 'go to', 'pull up', 'get me'],
    patterns: [
      /i (?:want|need) to (?:use|open|access|check) (?<app>.+)/,
      /(?:get|bring) me (?<app>.+)/,
      /(?:pull up|open up|fire up) (?<app>.+)/,
      /(?:switch|jump) to (?<app>.+)/,
    ],
  },
  // ── Call — extra phrasings ────────────────────────────────────────────────
  {
    intent: 'CALL_CONTACT',
    triggers: ['i want to call', 'i need to call', 'connect me to', 'get me', 'speak to', 'talk to', 'reach'],
    patterns: [
      /i (?:want|need|have) to (?:call|phone|ring|reach) (?<name>.+)/,
      /connect (?:me )?(?:to|with) (?<name>.+)/,
      /(?:get me|reach) (?<name>.+) (?:on the )?phone/,
      /(?:speak|talk|chat) (?:to|with) (?<name>.+)/,
      /(?:give|make) (?<name>.+) a (?:call|ring)/,
    ],
  },
  // ── SMS — extra phrasings ─────────────────────────────────────────────────
  {
    intent: 'SEND_SMS',
    triggers: ['i want to message', 'i want to text', 'drop a message', 'shoot a text', 'send a message to', 'write to'],
    patterns: [
      /i (?:want|need) to (?:message|text|sms) (?<name>.+)/,
      /(?:drop|shoot|fire|send) (?<name>.+) a (?:message|text|sms)/,
      /write (?:a message )?to (?<name>.+)/,
      /(?:msg|message) (?<name>.+)/,
    ],
  },
  // ── Small talk ─────────────────────────────────────────────────────────────
  {
    intent: 'SMALL_TALK',
    triggers: ['hello', 'hi vedra', 'hey vedra', 'how are you', "what's up", 'good morning', 'good evening', 'good afternoon', 'good night', 'who are you', 'what can you do', 'help me', 'what do you do', 'thanks', 'thank you'],
    patterns: [
      /^(hello|hi|hey)(?:\s+vedra)?$/,
      /how are you/,
      /what('s| is) up/,
      /good (morning|afternoon|evening|night)/,
      /who are you/,
      /what can you do/,
      /^(thanks|thank you)$/,
    ],
  },
  // ── Study timer ────────────────────────────────────────────────────────────
  {
    intent: 'STUDY_TIMER',
    triggers: ['study timer', 'pomodoro', 'study session', 'focus timer', 'study for'],
    patterns: [
      /(?:start )?(?:a )?(?<minutes>\d+)[- ]?(?:minute|min)s? (?:study|focus|work) (?:timer|session)/,
      /study (?:for|timer) (?<minutes>\d+) (?:minute|min)s?/,
      /pomodoro (?:timer)?(?:\s+(?<minutes>\d+))?/,
      /focus (?:for )?(?<minutes>\d+) (?:minute|min)s?/,
      /work(?:ing)? (?:for )?(?<minutes>\d+) (?:minute|min)s?/,
    ],
  },
  // ── Study reminders ────────────────────────────────────────────────────────
  {
    intent: 'STUDY_REMINDERS',
    triggers: ["today's study reminders", 'my study reminders', 'show study reminders', 'study schedule'],
    patterns: [
      /(?:show|list|what are) (?:my |today'?s? )?study (?:reminders?|schedule)/,
      /study (?:reminders?|schedule) (?:for )?today/,
    ],
  },
  // ── Study checklist ────────────────────────────────────────────────────────
  {
    intent: 'STUDY_CHECKLIST',
    triggers: ['study checklist', 'generate checklist', 'my checklist', 'show checklist', 'learning checklist'],
    patterns: [
      /(?:generate|create|show|make|get) (?:a |my )?(?:study )?checklist/,
      /study checklist/,
      /(?:what|show) (?:do )?i (?:need to|have to|should) (?:study|revise|review)/,
    ],
  },
  // ── Battery ────────────────────────────────────────────────────────────────
  {
    intent: 'BATTERY',
    triggers: ['battery', 'how much charge', 'charging status', 'power level'],
    patterns: [
      /(?:how much|what(?:'s| is) (?:the|my)) (?:battery|charge|power)/,
      /(?:is (?:my )?(?:phone|device) )?charging/,
      /battery (?:status|level|percentage|percent|info)/,
    ],
  },
  // ── Device info ────────────────────────────────────────────────────────────
  {
    intent: 'DEVICE_INFO',
    triggers: ['device info', 'phone info', 'about my phone', 'phone model'],
    patterns: [
      /(?:what(?:'s| is) (?:my|this) (?:phone|device))/,
      /(?:device|phone) (?:info|information|details|model|specs)/,
    ],
  },
];

// ─── Small talk responses ──────────────────────────────────────────────────────

const SMALL_TALK_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hey! I'm here. Just tap the mic and tell me what you need.",
    "Hello! Ready to help. What can I do for you?",
    "Hi there! What would you like me to do?",
  ],
  how_are_you: [
    "I'm running perfectly, thanks for asking! What can I help you with?",
    "All systems good! What do you need?",
  ],
  who_are_you: [
    "I'm Vedra, your offline AI assistant. I can control your device, set alarms, send messages, and much more — all without the internet.",
    "I'm Vedra — your personal AI assistant. Everything I do stays on your device.",
  ],
  what_can_you_do: [
    "I can open apps, make calls, send messages, set alarms and timers, control your flashlight, volume, brightness, and much more. All offline!",
    "Try me! I can call contacts, send SMS, control device settings, set reminders, manage your calendar — and remember your preferences.",
  ],
  thanks: [
    "Happy to help! Anything else?",
    "Of course! Let me know if you need anything.",
    "You're welcome!",
  ],
  good_morning: [
    "Good morning! Ready to make your day productive.",
    "Morning! What can I help you with today?",
  ],
  good_night: [
    "Good night! Sleep well.",
    "Goodnight! See you tomorrow.",
  ],
  default: [
    "I'm here. What would you like me to do?",
    "Go ahead — I'm listening.",
  ],
};

export function getSmallTalkResponse(input: string): string {
  const n = input.toLowerCase();
  let key = 'default';
  if (/hello|hi |^hey/.test(n))                       key = 'greeting';
  else if (/how are you/.test(n))                      key = 'how_are_you';
  else if (/who are you/.test(n))                      key = 'who_are_you';
  else if (/what can you do|what do you do/.test(n))   key = 'what_can_you_do';
  else if (/thank/.test(n))                            key = 'thanks';
  else if (/good morning/.test(n))                     key = 'good_morning';
  else if (/good (?:night|evening)/.test(n))           key = 'good_night';
  const options = SMALL_TALK_RESPONSES[key] ?? SMALL_TALK_RESPONSES['default'];
  return options[Math.floor(Math.random() * options.length)];
}

// ─── App matching helper ───────────────────────────────────────────────────────

export function findAppByKeyword(text: string): AppDefinition | null {
  const lc = text.toLowerCase();
  for (const app of APP_REGISTRY_PUBLIC) {
    if (app.keywords.some(kw => lc.includes(kw))) return app;
  }
  return null;
}

// ─── Normalise ────────────────────────────────────────────────────────────────

const POLITE = [
  /^please\s+/, /^can you please\s+/, /^can you\s+/, /^could you please\s+/,
  /^could you\s+/, /^hey vedra[,.]?\s+/, /^ok vedra[,.]?\s+/, /^vedra[,.]?\s+/,
  /^i'd like (?:you )?to\s+/, /^i would like (?:you )?to\s+/,
];

function normalise(text: string): string {
  let s = text.toLowerCase().trim().replace(/['']/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const p of POLITE) s = s.replace(p, '');
  return s.trim();
}

// ─── Main scoring function ────────────────────────────────────────────────────

/**
 * Run the intent engine on raw input.
 * Returns null if no intent scores above THRESHOLD.
 */
const THRESHOLD = 0.4;

export function classifyIntent(rawInput: string): IntentResult | null {
  const norm = normalise(rawInput);

  let best: IntentResult | null = null;

  for (const group of INTENT_PATTERNS) {
    // Quick trigger check
    if (group.triggers?.some(t => norm.includes(t))) {
      const entities: Record<string, string> = {};
      // Try to extract entities via patterns
      for (const pat of group.patterns) {
        const m = norm.match(pat);
        if (m?.groups) Object.assign(entities, m.groups);
      }
      const result: IntentResult = { intent: group.intent, confidence: 0.7, entities, rawInput, normalisedInput: norm };
      if (!best || result.confidence > best.confidence) best = result;
      continue;
    }

    // Full pattern match
    for (const pat of group.patterns) {
      const m = norm.match(pat);
      if (!m) continue;
      const entities: Record<string, string> = m.groups ? { ...m.groups } : {};
      // Longer match = higher confidence
      const conf = Math.min(0.95, 0.55 + (m[0].length / norm.length) * 0.4);
      if (!best || conf > best.confidence) {
        best = { intent: group.intent, confidence: conf, entities, rawInput, normalisedInput: norm };
      }
    }
  }

  if (!best || best.confidence < THRESHOLD) return null;
  return best;
}

// ─── Export public app registry (needed by intentEngine) ──────────────────────
// commandParser.ts re-exports this so we can import it here without circular dep.
