/**
 * aiProvider.ts — Vedra AI Provider Interface (v0.9)
 *
 * Common contract for all AI backends.
 * Add a new provider by implementing AIProvider and registering it in aiRouter.ts.
 */

// ─── Message types ─────────────────────────────────────────────────────────────

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  provider: string;       // display name e.g. "OpenAI GPT-4o"
  tokensUsed?: number;
  error?: string;
  isError: boolean;
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface AIProvider {
  /** Stable identifier e.g. "openai" */
  readonly id: string;
  /** Human-readable name shown in UI */
  readonly displayName: string;
  /** Returns true if an API key is configured */
  isConfigured(): Promise<boolean>;
  /**
   * Send messages to the provider and return a completion.
   * Implementations must respect the AbortSignal for timeouts.
   */
  complete(messages: AIMessage[], signal?: AbortSignal): Promise<AIResponse>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function errorResponse(provider: string, message: string): AIResponse {
  return { text: message, provider, isError: true, error: message };
}
