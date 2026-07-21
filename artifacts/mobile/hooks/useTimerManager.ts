/**
 * useTimerManager — React hook that wraps timerManager with live countdown.
 *
 * Polls the timer record every 500 ms while running so the UI stays in sync.
 * When the countdown reaches 0 it marks the timer completed and speaks the
 * finish message via TTS.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getTimer,
  startTimer as _start,
  cancelTimer as _cancel,
  completeTimer as _complete,
  getRemainingMs,
  type TimerRecord,
} from '@/utils/timerManager';
import { formatCountdown } from '@/utils/timeParser';

export interface TimerState {
  record: TimerRecord | null;
  remainingMs: number;
  countdownDisplay: string;
  isIdle: boolean;
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
}

const IDLE: TimerState = {
  record: null,
  remainingMs: 0,
  countdownDisplay: '00:00',
  isIdle: true,
  isRunning: false,
  isPaused: false,
  isCompleted: false,
};

export function useTimerManager(onFinished?: (display: string) => void) {
  const [state, setState] = useState<TimerState>(IDLE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const record = await getTimer();
    if (!record || record.status === 'idle') {
      stopPolling();
      setState(IDLE);
      return;
    }

    const remaining = getRemainingMs(record);

    if (remaining <= 0 && record.status === 'running') {
      // Timer finished — mark completed
      stopPolling();
      const completed = await _complete();
      setState({
        record: completed,
        remainingMs: 0,
        countdownDisplay: '00:00',
        isIdle: false,
        isRunning: false,
        isPaused: false,
        isCompleted: true,
      });
      onFinished?.(record.durationDisplay);
      return;
    }

    setState({
      record,
      remainingMs: remaining,
      countdownDisplay: formatCountdown(remaining),
      isIdle: false,
      isRunning: record.status === 'running',
      isPaused: record.status === 'paused',
      isCompleted: record.status === 'completed',
    });
  }, [stopPolling, onFinished]);

  // Start polling while there's an active timer
  const startPolling = useCallback(() => {
    stopPolling();
    intervalRef.current = setInterval(refresh, 500);
  }, [stopPolling, refresh]);

  // Load initial state and auto-start polling if a timer is already running
  useEffect(() => {
    refresh().then(async () => {
      const record = await getTimer();
      if (record && (record.status === 'running' || record.status === 'paused')) {
        startPolling();
      }
    });
    return stopPolling;
  }, []);

  const startNewTimer = useCallback(
    async (totalMs: number, durationDisplay: string) => {
      const result = await _start(totalMs, durationDisplay);
      if (result.success) {
        await refresh();
        startPolling();
      }
      return result;
    },
    [refresh, startPolling],
  );

  const cancelActiveTimer = useCallback(async () => {
    stopPolling();
    const result = await _cancel();
    setState(IDLE);
    return result;
  }, [stopPolling]);

  const dismissCompleted = useCallback(() => {
    setState(IDLE);
  }, []);

  return { state, startNewTimer, cancelActiveTimer, dismissCompleted, refresh };
}
