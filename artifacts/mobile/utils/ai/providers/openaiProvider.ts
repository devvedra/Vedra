/**
 * openaiProvider.ts — OpenAI Provider (v0.9)
 *
 * Implements AIProvider using the OpenAI Chat Completions API.
 * Model defaults to gpt-4o-mini (fast + cheap); override via env or settings.
 */

import { type AIMessage, type AIProvider, type AIResponse, errorResponse } from '../aiProvider';
import { getApiKey } from '../../settingsStore';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL   = 'gpt-4o-mini';
const TIMEOUT = 20_000; // 20 s

export class OpenAIProvider implements AIProvider {
  readonly id          = 'openai';
  readonly displayName = 'OpenAI GPT-4o mini';

  async isConfigured(): Promise<boolean> {
    const key = await getApiKey('openai');
    return !!key && key.length > 10;
  }

  async complete(messages: AIMessage[], signal?: AbortSignal): Promise<AIResponse> {
    const key = await getApiKey('openai');
    if (!key) return errorResponse(this.displayName, 'OpenAI API key not set.');

    // Combine external signal with built-in timeout
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const combined = signal
      ? combineSignals(signal, ctrl.signal)
      : ctrl.signal;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: 512, temperature: 0.7 }),
        signal: combined,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as any)?.error?.message ?? `HTTP ${res.status}`;
        return errorResponse(this.displayName, `OpenAI error: ${msg}`);
      }

      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? '';
      const tokens: number | undefined = data?.usage?.total_tokens;
      return { text: text.trim(), provider: this.displayName, tokensUsed: tokens, isError: false };
    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === 'AbortError') {
        return errorResponse(this.displayName, 'Request timed out. Check your internet connection.');
      }
      return errorResponse(this.displayName, `Could not reach OpenAI: ${err?.message ?? 'Unknown error'}`);
    }
  }
}

/** Aborts when either signal fires */
function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  a.addEventListener('abort', abort, { once: true });
  b.addEventListener('abort', abort, { once: true });
  return ctrl.signal;
}
