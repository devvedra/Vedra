/**
 * commandParser.ts — Vedra Command Parser
 *
 * Parses a free-form voice transcript into a structured command completely
 * offline, using nothing but string matching against a registry of known apps.
 *
 * ── Extending the registry ───────────────────────────────────────────────────
 * To add a new app, push a new entry into APP_REGISTRY:
 *
 *   { displayName: 'Spotify',
 *     keywords: ['spotify', 'music'],
 *     packageName: 'com.spotify.music' }
 *
 * For apps that vary by manufacturer (calculator, gallery…), use
 * `packageOptions` — the launcher will try each entry in order and use the
 * first one that is installed.
 *
 * For apps launched via Android intent actions (camera, settings…), set
 * `intentAction` instead of a package name.
 *
 * ── Adding new verb types ────────────────────────────────────────────────────
 * The parser currently only understands OPEN_APP commands. To add more
 * command types (e.g. SET_ALARM, CALL_CONTACT…), extend ParsedCommand with
 * a new union member and add a new parsing pass below parseCommand().
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single entry in the app registry.
 * Add new apps by pushing entries to APP_REGISTRY below.
 */
export type AppDefinition = {
  /** Human-readable name used in TTS and UI ("WhatsApp", "Chrome"…) */
  displayName: string;
  /** Lower-case keywords that identify this app in a voice command */
  keywords: string[];
  /** Single Android package name for apps that are consistent across devices */
  packageName?: string;
  /**
   * Multiple package names tried in order; first installed one wins.
   * Use this for apps that ship under different package names per manufacturer.
   */
  packageOptions?: string[];
  /**
   * Android intent action for system-level apps (Camera, Settings…).
   * When set, the launcher fires this action directly instead of looking up
   * a package name.
   */
  intentAction?: string;
};

/**
 * The result of a successful parse.
 * Add new union members here to support additional command types.
 */
export type ParsedCommand = {
  type: 'OPEN_APP';
  app: AppDefinition;
};

// ── App Registry ──────────────────────────────────────────────────────────────
// One source of truth for all supported apps.
// Order matters for keyword matching — more specific entries should come first.

const APP_REGISTRY: AppDefinition[] = [
  // ── Communication ──
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

  // ── Google apps ──
  {
    displayName: 'Chrome',
    keywords: ['chrome', 'google chrome', 'browser', 'web browser', 'internet'],
    packageOptions: [
      'com.android.chrome',
      'com.chrome.beta',
      'com.chrome.dev',
    ],
  },
  {
    displayName: 'YouTube',
    keywords: ['youtube', 'you tube', 'yt', 'videos'],
    packageName: 'com.google.android.youtube',
  },
  {
    displayName: 'Google Photos',
    keywords: [
      'google photos',
      'photos',
      'gallery',
      'pictures',
      'photo gallery',
      'my photos',
      'images',
    ],
    packageOptions: [
      'com.google.android.apps.photos', // Google Photos
      'com.sec.android.gallery3d',       // Samsung Gallery
      'com.miui.gallery',                // Xiaomi
      'com.android.gallery3d',           // Stock Android
      'com.oneplus.gallery',             // OnePlus
      'com.coloros.gallery3d',           // OPPO
    ],
  },
  {
    displayName: 'Maps',
    keywords: ['maps', 'google maps', 'navigation', 'directions'],
    packageName: 'com.google.android.apps.maps',
  },

  // ── System apps ──
  {
    displayName: 'Camera',
    // Uses an intent action so it works regardless of which camera app is installed
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
      'com.google.android.calculator',  // Pixel / stock
      'com.sec.android.calculator',     // Samsung
      'com.miui.calculator',            // Xiaomi
      'com.android.calculator2',        // AOSP
      'com.oneplus.calculator',         // OnePlus
      'com.coloros.calculator',         // OPPO
      'com.realme.calculator',          // Realme
    ],
  },
  {
    displayName: 'Files',
    keywords: [
      'files',
      'file manager',
      'my files',
      'file explorer',
      'documents',
      'storage',
    ],
    packageOptions: [
      'com.google.android.documentsui',  // Pixel / stock "Files"
      'com.sec.android.app.myfiles',     // Samsung "My Files"
      'com.miui.fileexplorer',           // Xiaomi
      'com.android.documentsui',         // Older AOSP
      'com.oneplus.filemanager',         // OnePlus
    ],
  },
];

// ── Verb List ─────────────────────────────────────────────────────────────────
// All verbs that can precede an app name in a voice command.
// Keep this list sorted by specificity (longer phrases first) so the regex
// loop matches "go to" before it could partially match "go".

const OPEN_VERBS: string[] = [
  'navigate to',
  'take me to',
  'go to',
  'open',
  'launch',
  'start',
  'run',
  'show',
  'load',
  'bring up',
];

// Polite prefixes stripped before verb matching
const POLITE_PREFIXES: RegExp[] = [
  /^please\s+/,
  /^can you\s+/,
  /^could you\s+/,
  /^hey vedra[,\s]+/,
  /^vedra[,\s]+/,
  /^ok vedra[,\s]+/,
];

// Article/pronoun words between the verb and the app name
const FILLER_WORDS = /^(?:my|the|a|an)\s+/;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a voice transcript into a structured command.
 *
 * Returns `null` when the transcript doesn't match any known command shape,
 * letting the caller fall back to generic "I heard…" behaviour.
 *
 * @param text - Raw transcript from the speech recogniser
 */
export function parseCommand(text: string): ParsedCommand | null {
  // 1. Normalise: lowercase, strip punctuation, collapse whitespace
  const normalised = text
    .toLowerCase()
    .replace(/[.,!?'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Strip polite prefixes
  let cleaned = normalised;
  for (const prefix of POLITE_PREFIXES) {
    cleaned = cleaned.replace(prefix, '');
  }

  // 3. Try each open-verb in turn
  for (const verb of OPEN_VERBS) {
    // Build regex: "^<verb> <optional filler> <rest>"
    // Escape spaces in multi-word verbs (e.g. "go to" → "go\s+to")
    const escapedVerb = verb.replace(/\s+/g, '\\s+');
    const pattern = new RegExp(`^${escapedVerb}\\s+(.+)$`);
    const match = cleaned.match(pattern);

    if (!match) continue;

    // 4. Strip filler words between verb and app name
    const candidate = match[1].trim().replace(FILLER_WORDS, '').trim();

    // 5. Look up candidate in the registry
    const app = findAppByKeyword(candidate);
    if (app) {
      return { type: 'OPEN_APP', app };
    }
  }

  return null; // No command recognised
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Find an app whose keyword list matches the given candidate text.
 *
 * Matching strategy (in priority order):
 *   1. Exact keyword match
 *   2. Candidate contains a keyword
 *   3. Keyword contains the candidate (handles dropped words)
 */
function findAppByKeyword(candidate: string): AppDefinition | undefined {
  // Pass 1: exact match
  for (const app of APP_REGISTRY) {
    if (app.keywords.some((kw) => kw === candidate)) return app;
  }

  // Pass 2: candidate contains a keyword
  for (const app of APP_REGISTRY) {
    if (app.keywords.some((kw) => candidate.includes(kw))) return app;
  }

  // Pass 3: keyword contains candidate (e.g. user said "whatsapp" → kw is "whatsapp")
  for (const app of APP_REGISTRY) {
    if (app.keywords.some((kw) => kw.includes(candidate))) return app;
  }

  return undefined;
}
