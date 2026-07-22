/**
 * types.ts — Vedra Plugin System Types (v1.0)
 *
 * Core interfaces for the plugin architecture.
 * All plugins implement VedraPlugin and register with PluginManager.
 */

// ─── Context passed to every plugin execution ─────────────────────────────────

export interface PluginContext {
  /** Speak text aloud via TTS */
  speak: (text: string) => void;
  /** User's current settings */
  offlineFirst: boolean;
  cloudAIEnabled: boolean;
  language: string;
}

// ─── Result returned by a plugin ─────────────────────────────────────────────

export interface PluginPanelItem {
  label: string;
  value: string;
  icon?: string;
  highlight?: boolean;
}

export interface PluginPanelData {
  title: string;
  subtitle?: string;
  items: PluginPanelItem[];
  badge?: string;
}

export interface PluginResult {
  success: boolean;
  /** Text spoken aloud */
  response: string;
  /** Optional structured data for the UI panel */
  panelData?: PluginPanelData;
  /** Set when success = false for error reporting */
  error?: string;
  /** Internal error for logging (not shown to user) */
  internalError?: string;
}

// ─── Plugin interface ─────────────────────────────────────────────────────────

export interface VedraPlugin {
  /** Unique stable identifier, e.g. "calculator" */
  readonly id: string;
  /** Display name shown in settings / diagnostics */
  readonly name: string;
  /** One-line description */
  readonly description: string;
  /** Semver string */
  readonly version: string;
  /** Android permission strings required (for documentation / diagnostics) */
  readonly requiredPermissions: string[];
  /** Words/phrases that hint this plugin handles the query */
  readonly triggerKeywords: string[];

  /**
   * Fast path: return true if this plugin can handle the transcript.
   * Should be O(1) — no async work.
   */
  canHandle(transcript: string): boolean;

  /**
   * Execute the command and return a result.
   * MUST NOT throw — return a failure PluginResult instead.
   */
  execute(transcript: string, context: PluginContext): Promise<PluginResult>;

  /** Called once when the plugin is registered. Optional setup. */
  onLoad?(): Promise<void>;

  /** Called when plugin is unregistered. Optional cleanup. */
  onUnload?(): Promise<void>;
}
