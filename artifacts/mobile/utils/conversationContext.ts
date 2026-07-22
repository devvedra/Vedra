/**
 * conversationContext.ts — Vedra Conversation Context (v0.8)
 *
 * Maintains a short-term in-memory context window so Vedra can resolve
 * pronouns and handle follow-up commands naturally.
 *
 * Context expires after CONTEXT_TTL_MS of inactivity (5 minutes).
 *
 * Example:
 *   User: "Call Rahul"     → stores { lastContact: "Rahul" }
 *   User: "Send him a text"→ resolves "him" → "Rahul"
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationTurn {
  transcript: string;
  commandType: string;
  response: string;
  timestamp: number;
}

export interface ConversationContext {
  // Last mentioned contact (for pronoun resolution)
  lastContact?: { name: string; phoneNumber?: string };
  // Last mentioned app
  lastApp?: { displayName: string };
  // Last action category for implicit follow-ups
  lastCategory?: string;
  // When context was last updated (epoch ms)
  updatedAt: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

const CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_HISTORY = 20;

let _context: ConversationContext = { updatedAt: 0 };
let _history: ConversationTurn[] = [];

// ─── Getters ──────────────────────────────────────────────────────────────────

export function getContext(): ConversationContext | null {
  if (Date.now() - _context.updatedAt > CONTEXT_TTL_MS) {
    _context = { updatedAt: 0 };
    return null;
  }
  return _context;
}

export function getHistory(): ConversationTurn[] {
  return [..._history];
}

export function getRecentHistory(n = 5): ConversationTurn[] {
  return _history.slice(0, n);
}

// ─── Setters ──────────────────────────────────────────────────────────────────

export function updateContact(name: string, phoneNumber?: string): void {
  _context = { ..._context, lastContact: { name, phoneNumber }, updatedAt: Date.now() };
}

export function updateApp(displayName: string): void {
  _context = { ..._context, lastApp: { displayName }, updatedAt: Date.now() };
}

export function updateCategory(category: string): void {
  _context = { ..._context, lastCategory: category, updatedAt: Date.now() };
}

export function addTurn(transcript: string, commandType: string, response: string): void {
  _history.unshift({ transcript, commandType, response, timestamp: Date.now() });
  if (_history.length > MAX_HISTORY) _history.length = MAX_HISTORY;
  _context = { ..._context, updatedAt: Date.now() };
}

export function clearContext(): void {
  _context = { updatedAt: 0 };
  _history = [];
}

// ─── Pronoun resolution ───────────────────────────────────────────────────────

const CONTACT_PRONOUNS = /\b(him|her|them|he|she|they)\b/i;
const APP_PRONOUNS     = /\b(it)\b/i;

/**
 * Resolves pronouns in `text` using the current context.
 * Returns the resolved string (may be unchanged if no pronouns or no context).
 */
export function resolvePronouns(text: string): { resolved: string; didResolve: boolean } {
  const ctx = getContext();
  if (!ctx) return { resolved: text, didResolve: false };

  let resolved = text;
  let didResolve = false;

  if (CONTACT_PRONOUNS.test(text) && ctx.lastContact) {
    resolved = resolved.replace(CONTACT_PRONOUNS, ctx.lastContact.name);
    didResolve = true;
  }

  if (APP_PRONOUNS.test(text) && ctx.lastApp) {
    resolved = resolved.replace(APP_PRONOUNS, ctx.lastApp.displayName);
    didResolve = true;
  }

  return { resolved, didResolve };
}
