/**
 * smallTalk.ts — Vedra v0.7
 *
 * Lightweight offline rule-based small talk engine.
 * No network calls, no AI services — pure string matching.
 */

export type SmallTalkResult = {
  matched: boolean;
  response: string;
};

// ── Response table ────────────────────────────────────────────────────────────

type SmallTalkRule = {
  patterns: string[];
  responses: string[];
};

const RULES: SmallTalkRule[] = [
  // Greetings
  {
    patterns: ['hello', 'hi', 'hey', 'howdy', 'what\'s up', 'whats up', 'sup'],
    responses: [
      'Hello! How can I help you?',
      'Hi there! What can I do for you?',
      'Hey! Ready to help.',
    ],
  },
  {
    patterns: ['good morning', 'morning'],
    responses: [
      'Good morning! Hope you have a productive day.',
      'Good morning! How can I help you start your day?',
    ],
  },
  {
    patterns: ['good afternoon', 'afternoon'],
    responses: [
      'Good afternoon! What can I do for you?',
      'Good afternoon! How can I help?',
    ],
  },
  {
    patterns: ['good evening', 'evening'],
    responses: [
      'Good evening! How can I help you tonight?',
      'Good evening! What do you need?',
    ],
  },
  {
    patterns: ['good night', 'night night', 'goodnight'],
    responses: [
      'Good night! Sleep well.',
      'Good night! See you tomorrow.',
    ],
  },

  // Politeness
  {
    patterns: ['thank you', 'thanks', 'thank you so much', 'thanks a lot', 'many thanks', 'cheers'],
    responses: [
      'You\'re welcome!',
      'Happy to help!',
      'Of course! Anything else?',
      'Glad I could help.',
    ],
  },
  {
    patterns: ['please', 'ok thanks', 'okay thanks', 'alright thanks'],
    responses: ['Sure thing!', 'Of course!', 'On it!'],
  },
  {
    patterns: ['sorry', 'my bad', 'apologies', 'excuse me'],
    responses: ['No problem at all!', 'That\'s okay!', 'No worries!'],
  },

  // Identity
  {
    patterns: ['who are you', 'what are you', 'what is your name', 'whats your name', 'tell me about yourself'],
    responses: [
      'I\'m Vedra, your offline personal assistant. I can control your phone, set alarms, make calls, and much more.',
    ],
  },
  {
    patterns: ['what can you do', 'what are your features', 'help', 'what do you know', 'list features', 'show features'],
    responses: [
      'I can: set alarms & timers, make calls, send texts, open apps, control media, read notifications, get device info, open quick settings, and have a conversation — all offline!',
    ],
  },
  {
    patterns: ['are you ai', 'are you an ai', 'are you real', 'are you a robot', 'are you human'],
    responses: [
      'I\'m an AI assistant running entirely on your device — no internet required!',
      'I\'m Vedra, an offline AI assistant built for Android.',
    ],
  },

  // Wellbeing
  {
    patterns: ['how are you', 'how are you doing', 'how do you do', 'how\'s it going', 'hows it going', 'you okay'],
    responses: [
      'I\'m doing great, thanks for asking! How can I help?',
      'All systems running smoothly! What do you need?',
      'Ready and waiting! What can I do for you?',
    ],
  },

  // Affirmations
  {
    patterns: ['great', 'awesome', 'excellent', 'perfect', 'amazing', 'fantastic', 'wonderful', 'brilliant'],
    responses: ['Glad to hear it!', 'That\'s great!', 'Wonderful!'],
  },
  {
    patterns: ['ok', 'okay', 'alright', 'sure', 'got it', 'understood', 'i see'],
    responses: ['Got it! Anything else I can help with?', 'Sure! Let me know if you need anything.'],
  },

  // Farewells
  {
    patterns: ['goodbye', 'bye', 'see you', 'see ya', 'later', 'take care', 'farewell', 'ciao'],
    responses: [
      'Goodbye! I\'m here whenever you need me.',
      'See you! Just say my name when you need help.',
      'Take care!',
    ],
  },

  // Misc
  {
    patterns: ['what time is it', 'current time', 'tell me the time'],
    responses: [], // handled by DEVICE_INFO in the command parser; fallback here
  },
  {
    patterns: ['i love you', 'i like you', 'you\'re great', 'you are great'],
    responses: ['That\'s very kind, thank you! I\'m here to help anytime.'],
  },
  {
    patterns: ['tell me a joke', 'say a joke', 'joke'],
    responses: [
      'Why don\'t scientists trust atoms? Because they make up everything!',
      'Why did the smartphone go to therapy? It had too many hang-ups.',
      'I told my phone to remind me to exercise. It said "Remind who?"',
    ],
  },
  {
    patterns: ['what is the meaning of life', 'meaning of life', '42'],
    responses: [
      'The answer is 42. At least, that\'s what I\'ve heard.',
      'To help you as much as I can, I suppose!',
    ],
  },
];

// ── Engine ────────────────────────────────────────────────────────────────────

/** Index built once at module load time: pattern → responses */
const _index: Map<string, string[]> = new Map();

for (const rule of RULES) {
  for (const pattern of rule.patterns) {
    _index.set(pattern, rule.responses);
  }
}

/**
 * Try to match the text against the small-talk rules.
 * Returns matched=false if no rule matches (so the caller can handle it).
 */
export function trySmallTalk(text: string): SmallTalkResult {
  const normalised = text
    .toLowerCase()
    .replace(/[.,!?'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Exact match first
  const exact = _index.get(normalised);
  if (exact && exact.length > 0) {
    return { matched: true, response: _pick(exact) };
  }

  // Substring match
  for (const [pattern, responses] of _index) {
    if (responses.length === 0) continue;
    if (normalised.includes(pattern) || pattern.includes(normalised)) {
      return { matched: true, response: _pick(responses) };
    }
  }

  return { matched: false, response: '' };
}

function _pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}
