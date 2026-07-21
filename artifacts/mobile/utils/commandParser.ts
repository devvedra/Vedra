/**
 * commandParser.ts — Vedra Command Parser  (v0.3)
 *
 * Parses free-form voice transcripts into structured commands, entirely
 * offline using string matching. No network calls, no AI services.
 *
 * ── Supported command types ───────────────────────────────────────────────────
 *
 *  OPEN_APP      — "Open WhatsApp", "Launch Chrome", "Start Calculator"…
 *  CALL_CONTACT  — "Call Mom", "Phone Rahul", "Dial Dad", "Make a call to John"…
 *
 * ── Extending the parser ─────────────────────────────────────────────────────
 *
 *  To add a new app:    push an AppDefinition into APP_REGISTRY.
 *  To add a new verb:   add a string to OPEN_VERBS or CALL_VERBS.
 *  To add a command type: add a union member to ParsedCommand and a new
 *                         parse pass inside parseCommand().
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Metadata for a launchable Android app. */
export type AppDefinition = {
  /** Human-readable name for TTS and UI */
  displayName: string;
  /** Lower-case keywords that identify this app in a voice command */
  keywords: string[];
  /** Single Android package name (consistent across devices) */
  packageName?: string;
  /**
   * Multiple package names tried in order; first installed wins.
   * For apps that ship under different names per manufacturer.
   */
  packageOptions?: string[];
  /**
   * Android intent action for system-level features (Camera, Settings…).
   * When set the launcher fires this action without a package name.
   */
  intentAction?: string;
};

/**
 * A successfully parsed voice command.
 * Add new union members here to support additional command types.
 */
export type ParsedCommand =
  | { type: 'OPEN_APP'; app: AppDefinition }
  | { type: 'CALL_CONTACT'; contactName: string };

// ═══════════════════════════════════════════════════════════════════════════════
// App Registry  (OPEN_APP data)
// ═══════════════════════════════════════════════════════════════════════════════

const APP_REGISTRY: AppDefinition[] = [
  // ── Communication ──────────────────────────────────────────────────────────
  {
    displayName: 'WhatsApp',
    keywords: ['whatsapp', 'whats app'],
    packageName: 'com.whatsapp',
  },
  {
    displayName: 'Gmail',
    keywords: ['gmail', 'g mail', 'email', 'mail', 'my email'],
    packageName: 'com.google.android.gm',
  },

  // ── Google apps ────────────────────────────────────────────────────────────
  {
    displayName: 'Chrome',
    keywords: ['chrome', 'google chrome', 'browser', 'web browser', 'internet'],
    packageOptions: ['com.android.chrome', 'com.chrome.beta', 'com.chrome.dev'],
  },
  {
    displayName: 'YouTube',
    keywords: ['youtube', 'you tube', 'yt', 'videos'],
    packageName: 'com.google.android.youtube',
  },
  {
    displayName: 'Maps',
    keywords: ['maps', 'google maps', 'navigation', 'directions'],
    packageName: 'com.google.android.apps.maps',
  },
  {
    displayName: 'Google Photos',
    keywords: ['google photos', 'photos', 'gallery', 'pictures', 'photo gallery', 'my photos', 'images'],
    packageOptions: [
      'com.google.android.apps.photos',
      'com.sec.android.gallery3d',
      'com.miui.gallery',
      'com.android.gallery3d',
      'com.oneplus.gallery',
      'com.coloros.gallery3d',
    ],
  },

  // ── System apps ────────────────────────────────────────────────────────────
  {
    displayName: 'Camera',
    keywords: ['camera', 'take photo', 'take picture', 'take a photo', 'selfie'],
    intentAction: 'android.media.action.STILL_IMAGE_CAMERA',
  },
  {
    displayName: 'Settings',
    keywords: ['settings', 'setting', 'preferences', 'configuration', 'system settings'],
    intentAction: 'android.settings.SETTINGS',
  },
  {
    displayName: 'Calculator',
    keywords: ['calculator', 'calc', 'calculate'],
    packageOptions: [
      'com.google.android.calculator',
      'com.sec.android.calculator',
      'com.miui.calculator',
      'com.android.calculator2',
      'com.oneplus.calculator',
      'com.coloros.calculator',
      'com.realme.calculator',
    ],
  },
  {
    displayName: 'Files',
    keywords: ['files', 'file manager', 'my files', 'file explorer', 'documents', 'storage'],
    packageOptions: [
      'com.google.android.documentsui',
      'com.sec.android.app.myfiles',
      'com.miui.fileexplorer',
      'com.android.documentsui',
      'com.oneplus.filemanager',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Verb lists
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verbs that precede an app name in an OPEN_APP command.
 * Sorted longest-first so multi-word phrases match before their prefixes.
 */
const OPEN_VERBS: string[] = [
  'navigate to',
  'take me to',
  'go to',
  'bring up',
  'open',
  'launch',
  'start',
  'run',
  'show',
  'load',
];

/**
 * Verbs that precede a contact name in a CALL_CONTACT command.
 * Sorted longest-first.
 */
const CALL_VERBS: string[] = [
  'make a phone call to',
  'make a call to',
  'give a call to',
  'place a call to',
  'call up',
  'phone up',
  'ring up',
  'call',
  'phone',
  'dial',
  'ring',
];

/**
 * Polite prefixes stripped before verb matching.
 * Order matters: strip longer phrases before shorter ones.
 */
const POLITE_PREFIXES: RegExp[] = [
  /^please\s+/,
  /^can you please\s+/,
  /^can you\s+/,
  /^could you please\s+/,
  /^could you\s+/,
  /^hey vedra[,.]?\s+/,
  /^ok vedra[,.]?\s+/,
  /^vedra[,.]?\s+/,
];

/** Articles / possessives between a verb and the target ("my", "the", "a"…) */
const FILLER_WORDS = /^(?:my|the|a|an)\s+/;

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a raw voice transcript into a typed command.
 *
 * Parsing order:
 *   1. OPEN_APP  (tried first — apps have distinctive names)
 *   2. CALL_CONTACT
 *
 * Returns null if the transcript matches no known command pattern.
 *
 * @param text - Raw transcript from the speech recogniser
 */
export function parseCommand(text: string): ParsedCommand | null {
  const cleaned = normalise(text);

  return (
    tryOpenApp(cleaned) ??
    tryCallContact(cleaned) ??
    null
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Parse passes
// ═══════════════════════════════════════════════════════════════════════════════

/** Try to match an OPEN_APP command. Returns null on no match. */
function tryOpenApp(cleaned: string): ParsedCommand | null {
  for (const verb of OPEN_VERBS) {
    const pattern = buildVerbPattern(verb);
    const match = cleaned.match(pattern);
    if (!match) continue;

    const candidate = match[1].trim().replace(FILLER_WORDS, '').trim();
    const app = findApp(candidate);
    if (app) return { type: 'OPEN_APP', app };
  }
  return null;
}

/** Try to match a CALL_CONTACT command. Returns null on no match. */
function tryCallContact(cleaned: string): ParsedCommand | null {
  for (const verb of CALL_VERBS) {
    const pattern = buildVerbPattern(verb);
    const match = cleaned.match(pattern);
    if (!match) continue;

    // Strip filler words like "my dad" → "dad"
    const contactName = match[1].trim().replace(FILLER_WORDS, '').trim();
    if (contactName.length >= 2) {
      return { type: 'CALL_CONTACT', contactName };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Normalise text: lowercase, strip punctuation, collapse whitespace, strip polite prefixes. */
function normalise(text: string): string {
  let s = text
    .toLowerCase()
    .replace(/[.,!?'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const prefix of POLITE_PREFIXES) {
    s = s.replace(prefix, '');
  }

  return s;
}

/** Build a regex that matches "^<verb> <rest>$". Verb spaces become \s+. */
function buildVerbPattern(verb: string): RegExp {
  const escaped = verb.replace(/\s+/g, '\\s+');
  return new RegExp(`^${escaped}\\s+(.+)$`);
}

/**
 * Look up an app in the registry by keyword.
 * Priority: exact match → candidate contains keyword → keyword contains candidate.
 */
function findApp(candidate: string): AppDefinition | undefined {
  // Pass 1: exact
  for (const app of APP_REGISTRY) {
    if (app.keywords.some((kw) => kw === candidate)) return app;
  }
  // Pass 2: candidate ⊇ keyword
  for (const app of APP_REGISTRY) {
    if (app.keywords.some((kw) => candidate.includes(kw))) return app;
  }
  // Pass 3: keyword ⊇ candidate
  for (const app of APP_REGISTRY) {
    if (app.keywords.some((kw) => kw.includes(candidate))) return app;
  }
  return undefined;
}
