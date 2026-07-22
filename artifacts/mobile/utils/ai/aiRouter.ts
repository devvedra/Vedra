/**
 * aiRouter.ts — Vedra AI Router (v0.9)
 *
 * Central routing layer. After the offline pipeline (commandParser → intentEngine
 * → smallTalk) fails to match a transcript, this router decides:
 *
 *  1. Cloud AI enabled + key configured + reachable  → call provider
 *  2. Cloud AI disabled or not configured             → polite offline fallback
 *  3. Network / provider error                        → graceful error message
 *
 * Never call this for commands already handled offline.
 */

import { getSettings, getApiKey } from '../settingsStore';
import { OpenAIProvider }  from './providers/openaiProvider';
import { GeminiProvider }  from './providers/geminiProvider';
import { type AIProvider, type AIMessage, type AIResponse, errorResponse } from './aiProvider';
import { getAIHistory } from '../conversationManager';

// ─── Provider registry ────────────────────────────────────────────────────────

const PROVIDERS: Record<string, AIProvider> = {
  openai: new OpenAIProvider(),
  gemini: new GeminiProvider(),
};

export function getProvider(id: string): AIProvider | undefined {
  return PROVIDERS[id];
}

export function listProviders(): AIProvider[] {
  return Object.values(PROVIDERS);
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Vedra, an intelligent Android AI assistant.
You answer questions clearly and helpfully.
When the user asks about device features (calls, flashlight, alarms, etc.), remind them those work offline with a voice command.
Keep responses concise — under 150 words unless the user explicitly asks for detail.
Never make up facts. If unsure, say so honestly.`;

// ─── Route ────────────────────────────────────────────────────────────────────

export interface RouterResult {
  handled: boolean;
  response: string;
  source: 'offline' | 'online';
  providerName?: string;
  isError?: boolean;
}

/**
 * Route a transcript to the best available intelligence layer.
 * @param transcript  The user's raw spoken input.
 * @param maxHistory  How many prior turns to send as context (default 8).
 */
export async function routeToAI(
  transcript: string,
  maxHistory = 8,
): Promise<RouterResult> {
  const settings = await getSettings();

  // ── Cloud AI disabled ─────────────────────────────────────────────────────
  if (!settings.cloudAIEnabled) {
    return {
      handled: true,
      source: 'offline',
      response:
        "I'm in offline mode. I can still help with device commands — opening apps, calls, alarms, flashlight, reminders, and more. Say something like "Open WhatsApp" or "Set an alarm for 7 AM".",
    };
  }

  const provider = PROVIDERS[settings.selectedProvider];
  if (!provider) {
    return {
      handled: true,
      source: 'offline',
      response: 'No AI provider configured. Please add a provider in Settings.',
    };
  }

  // ── Key not set ───────────────────────────────────────────────────────────
  const hasKey = await provider.isConfigured();
  if (!hasKey) {
    return {
      handled: true,
      source: 'offline',
      response: `${provider.displayName} is selected but no API key is configured. Add one in Settings → AI Provider.`,
    };
  }

  // ── Build message history for context ─────────────────────────────────────
  const history = await getAIHistory(maxHistory);
  const messages: AIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: transcript },
  ];

  // ── Call provider ─────────────────────────────────────────────────────────
  let aiResponse: AIResponse;
  try {
    aiResponse = await provider.complete(messages);
  } catch (err: any) {
    aiResponse = errorResponse(
      provider.displayName,
      `Could not reach ${provider.displayName}: ${err?.message ?? 'Unknown error'}`,
    );
  }

  if (aiResponse.isError) {
    return {
      handled: true,
      source: 'online',
      providerName: provider.displayName,
      isError: true,
      response:
        `I can't reach the online AI right now. ${aiResponse.error ?? ''}\n\nI can still help offline — try "Set a reminder", "Open YouTube", or "What's my battery?".`,
    };
  }

  return {
    handled: true,
    source: 'online',
    providerName: provider.displayName,
    response: aiResponse.text,
  };
}
