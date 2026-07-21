/**
 * stopwatchManager.ts — Vedra Stopwatch
 *
 * Pure in-memory stopwatch. No persistence needed since a stopwatch
 * is a live, session-scoped tool — resetting on app restart is expected.
 *
 * State machine:
 *   idle → start → running → pause → paused → resume → running → stop → idle
 *                                          ↓
 *                                        reset → idle
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type StopwatchStatus = 'idle' | 'running' | 'paused';

export interface StopwatchState {
  status: StopwatchStatus;
  /** Total elapsed ms (including all resumed segments) */
  elapsedMs: number;
  /** Timestamp when the current running segment started */
  segmentStartedAt: number | null;
}

// ── Module-level state ─────────────────────────────────────────────────────

let _state: StopwatchState = {
  status: 'idle',
  elapsedMs: 0,
  segmentStartedAt: null,
};

// ── Accessors ──────────────────────────────────────────────────────────────

export function getStopwatchState(): StopwatchState {
  return { ..._state };
}

/**
 * Current elapsed ms — accounts for the live running segment if active.
 */
export function getCurrentElapsedMs(): number {
  if (_state.status === 'running' && _state.segmentStartedAt !== null) {
    return _state.elapsedMs + (Date.now() - _state.segmentStartedAt);
  }
  return _state.elapsedMs;
}

// ── Mutations ──────────────────────────────────────────────────────────────

export type StopwatchAction = 'start' | 'pause' | 'resume' | 'stop' | 'reset';

export interface StopwatchActionResult {
  success: boolean;
  state: StopwatchState;
  message: string;
}

export function applyStopwatchAction(action: StopwatchAction): StopwatchActionResult {
  const now = Date.now();

  switch (action) {
    case 'start': {
      if (_state.status !== 'idle') {
        return { success: false, state: { ..._state }, message: 'Stopwatch is already running.' };
      }
      _state = { status: 'running', elapsedMs: 0, segmentStartedAt: now };
      return { success: true, state: { ..._state }, message: 'Stopwatch started.' };
    }

    case 'pause': {
      if (_state.status !== 'running') {
        return { success: false, state: { ..._state }, message: 'Stopwatch is not running.' };
      }
      const elapsed = _state.elapsedMs + (now - (_state.segmentStartedAt ?? now));
      _state = { status: 'paused', elapsedMs: elapsed, segmentStartedAt: null };
      return { success: true, state: { ..._state }, message: 'Stopwatch paused.' };
    }

    case 'resume': {
      if (_state.status !== 'paused') {
        return { success: false, state: { ..._state }, message: 'Stopwatch is not paused.' };
      }
      _state = { status: 'running', elapsedMs: _state.elapsedMs, segmentStartedAt: now };
      return { success: true, state: { ..._state }, message: 'Stopwatch resumed.' };
    }

    case 'stop': {
      if (_state.status === 'idle') {
        return { success: false, state: { ..._state }, message: 'Stopwatch is not running.' };
      }
      const elapsed =
        _state.status === 'running'
          ? _state.elapsedMs + (now - (_state.segmentStartedAt ?? now))
          : _state.elapsedMs;
      _state = { status: 'idle', elapsedMs: elapsed, segmentStartedAt: null };
      return { success: true, state: { ..._state }, message: 'Stopwatch stopped.' };
    }

    case 'reset': {
      _state = { status: 'idle', elapsedMs: 0, segmentStartedAt: null };
      return { success: true, state: { ..._state }, message: 'Stopwatch reset.' };
    }
  }
}
