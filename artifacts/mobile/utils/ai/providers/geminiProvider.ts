/**
 * geminiProvider.ts — Google Gemini Provider (v0.9)
 *
 * Implements AIProvider using the Gemini generateContent REST API.
 * Model defaults to gemini-1.5-flash (fast + free tier friendly).
 */

import { type AIMessage, type AIProvider, type AIResponse, errorResponse } from '../aiProvider';
import { getApiKey } from '../../settingsStore';

const MODEL   = 'gemini-1.5-flash';
const TIMEOUT = 20_000;

function apiUrl(key: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
}

export class GeminiProvider implements AIProvider {
  readonly id          = 'gemini';
  readonly displayName = 'Google Gemini 1.5 Flash';

  async isConfigured(): Promise<boolean> {
    const key = await getApiKey('gemini');
    return !!key && key.length > 10;
  }

  async complete(messages: AIMessage[], signal?: AbortSignal): Promise<AIResponse> {
    const key = await getApiKey('gemini');
    if (!key) return errorResponse(this.displayName, 'Gemini API key not set.');

    // Convert OpenAI-style messages to Gemini format
    // Gemini uses { role: 'user'|'model', parts: [{ text }] }
    // System messages are prepended to the first user turn
    const systemParts = messages.filter(m => m.role === 'system').map(m => m.content);
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map((m, i) => {
      let text = m.content;
      if (i === 0 && systemParts.length) {
        text = systemParts.join('\n\n') + '\n\n' + text;
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text }] };
    });

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const combined = signal ? combineSignals(signal, ctrl.signal) : ctrl.signal;

    try {
      const res = await fetch(apiUrl(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
        }),
        signal: combined,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as any)?.error?.message ?? `HTTP ${res.status}`;
        return errorResponse(this.displayName, `Gemini error: ${msg}`);
      }

      const data = await res.json();
      const text: string =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return { text: text.trim(), provider: this.displayName, isError: false };
    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === 'AbortError') {
        return errorResponse(this.displayName, 'Request timed out. Check your internet connection.');
      }
      return errorResponse(this.displayName, `Could not reach Gemini: ${err?.message ?? 'Unknown error'}`);
    }
  }
}

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  a.addEventListener('abort', abort, { once: true });
  b.addEventListener('abort', abort, { once: true });
  return ctrl.signal;
}
