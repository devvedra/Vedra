/**
 * useStopwatch — React hook that drives the stopwatch display.
 *
 * Updates the elapsed display every 50 ms while running (smooth centisecond
 * display). Delegates all state mutations to stopwatchManager.ts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  applyStopwatchAction,
  getCurrentElapsedMs,
  getStopwatchState,
  type StopwatchStatus,
  type StopwatchAction,
} from '@/utils/stopwatchManager';
import { formatElapsed } from '@/utils/timeParser';

export interface StopwatchHookState {
  status: StopwatchStatus;
  elapsedMs: number;
  display: string;
}

export function useStopwatch() {
  const [state, setState] = useState<StopwatchHookState>({
    status: 'idle',
    elapsedMs: 0,
    display: '00:00.00',
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const ms = getCurrentElapsedMs();
    setState((prev) => ({
      ...prev,
      elapsedMs: ms,
      display: formatElapsed(ms),
    }));
  }, []);

  const startTicking = useCallback(() => {
    stopTick();
    intervalRef.current = setInterval(tick, 50);
  }, [stopTick, tick]);

  useEffect(() => () => stopTick(), [stopTick]);

  const dispatch = useCallback(
    (action: StopwatchAction) => {
      const result = applyStopwatchAction(action);
      if (!result.success) return result;

      const sw = getStopwatchState();
      const ms = getCurrentElapsedMs();

      setState({
        status: sw.status,
        elapsedMs: ms,
        display: formatElapsed(ms),
      });

      if (sw.status === 'running') {
        startTicking();
      } else {
        stopTick();
      }

      return result;
    },
    [startTicking, stopTick],
  );

  return { state, dispatch };
}
