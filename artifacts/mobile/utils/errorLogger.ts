/**
 * errorLogger.ts — Vedra Local Error Logger (v1.0)
 *
 * Stores recoverable errors locally so users can view them in the
 * Diagnostics screen. Never uploads anything. Capped at 100 entries.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface VedraError {
  id: string;
  timestamp: number;
  severity: ErrorSeverity;
  module: string;
  message: string;
  detail?: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const KEY        = '@vedra/error_log_v1';
const MAX_ERRORS = 100;

let _cache: VedraError[] | null = null;

async function _load(): Promise<VedraError[]> {
  if (_cache !== null) return _cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    _cache = raw ? JSON.parse(raw) : [];
  } catch {
    _cache = [];
  }
  return _cache!;
}

async function _save(errors: VedraError[]): Promise<void> {
  _cache = errors;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(errors));
  } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Log an error. Fire-and-forget — never throws.
 */
export function logError(
  module: string,
  message: string,
  err?: unknown,
  severity: ErrorSeverity = 'error',
): void {
  const detail = err instanceof Error
    ? `${err.message}${err.stack ? `\n${err.stack.split('\n').slice(0, 3).join('\n')}` : ''}`
    : err != null ? String(err) : undefined;

  // Write async, but don't await — this is fire-and-forget
  (async () => {
    try {
      const errors = await _load();
      const entry: VedraError = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        severity,
        module,
        message,
        detail,
      };
      errors.unshift(entry);
      if (errors.length > MAX_ERRORS) errors.length = MAX_ERRORS;
      await _save(errors);
    } catch {}
  })();

  // Also log to console for development
  if (__DEV__) {
    const prefix = `[Vedra:${module}]`;
    if (severity === 'error' || severity === 'critical') {
      console.error(prefix, message, err ?? '');
    } else {
      console.warn(prefix, message, err ?? '');
    }
  }
}

/** Get all logged errors, newest first. */
export async function getErrorLog(): Promise<VedraError[]> {
  return _load();
}

/** Get the most recent N errors. */
export async function getRecentErrors(n = 10): Promise<VedraError[]> {
  const errors = await _load();
  return errors.slice(0, n);
}

/** Clear all logged errors. */
export async function clearErrorLog(): Promise<void> {
  _cache = [];
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

/** Count errors by severity. */
export async function getErrorCounts(): Promise<Record<ErrorSeverity, number>> {
  const errors = await _load();
  return errors.reduce(
    (acc, e) => { acc[e.severity] = (acc[e.severity] ?? 0) + 1; return acc; },
    { info: 0, warning: 0, error: 0, critical: 0 } as Record<ErrorSeverity, number>,
  );
}
