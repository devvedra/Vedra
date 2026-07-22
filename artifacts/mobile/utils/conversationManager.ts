/**
 * conversationManager.ts — Vedra Conversation Manager (v0.9)
 *
 * Persists full conversation history to AsyncStorage.
 * Provides the AI message array for context-aware cloud calls.
 * Separate from conversationContext.ts (which handles in-memory pronoun resolution).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AIMessage } from './ai/aiProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TurnSource = 'offline' | 'online' | 'system';

export interface ConversationTurn {
  id: string;
  userText: string;
  assistantText: string;
  source: TurnSource;
  providerName?: string;
  timestamp: number;
}

const K = { HISTORY: '@vedra/conversation_v9' };
const MAX_TURNS = 50;

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _turns: ConversationTurn[] | null = null;

async function _load(): Promise<ConversationTurn[]> {
  if (_turns !== null) return _turns;
  try {
    const raw = await AsyncStorage.getItem(K.HISTORY);
    _turns = raw ? JSON.parse(raw) : [];
  } catch {
    _turns = [];
  }
  return _turns!;
}

async function _save(turns: ConversationTurn[]): Promise<void> {
  _turns = turns;
  try {
    await AsyncStorage.setItem(K.HISTORY, JSON.stringify(turns));
  } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Append a completed exchange to the history. */
export async function addConversationTurn(
  userText: string,
  assistantText: string,
  source: TurnSource,
  providerName?: string,
): Promise<void> {
  const turns = await _load();
  const turn: ConversationTurn = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userText,
    assistantText,
    source,
    providerName,
    timestamp: Date.now(),
  };
  turns.unshift(turn);           // newest first
  if (turns.length > MAX_TURNS) turns.length = MAX_TURNS;
  await _save(turns);
}

/** Get all stored turns (newest first). */
export async function getConversationHistory(): Promise<ConversationTurn[]> {
  return _load();
}

/**
 * Get the last `n` turns as an AIMessage array suitable for sending to a provider.
 * Returns oldest-first (chronological) for correct context ordering.
 */
export async function getAIHistory(n = 8): Promise<AIMessage[]> {
  const turns = await _load();
  // Take n most-recent turns, then reverse to chronological order
  const recent = turns.slice(0, n).reverse();
  const messages: AIMessage[] = [];
  for (const t of recent) {
    messages.push({ role: 'user',      content: t.userText });
    messages.push({ role: 'assistant', content: t.assistantText });
  }
  return messages;
}

/** Clear all conversation history. */
export async function clearConversationHistory(): Promise<void> {
  _turns = [];
  await AsyncStorage.removeItem(K.HISTORY);
}

/** Return turn count. */
export async function getConversationTurnCount(): Promise<number> {
  const turns = await _load();
  return turns.length;
}
