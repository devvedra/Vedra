/**
 * useSpeechRecognition
 *
 * Wraps expo-speech-recognition to provide a clean state machine for
 * Android's SpeechRecognizer API (and iOS SFSpeechRecognizer / Web Speech API).
 *
 * States:
 *   idle             → ready to start
 *   listening        → microphone open, waiting for speech
 *   processing       → speech captured, waiting for final result
 *   result           → transcript ready
 *   error            → recognition error (message in `error`)
 *   permission_denied → mic / speech-recognition permission was refused
 *   unavailable      → reserved for future use; not emitted by this implementation
 *
 * The hook requests RECORD_AUDIO + SPEECH_RECOGNITION permissions before
 * starting. On Android it prefers on-device recognition when available.
 */

import { useState, useCallback } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecognitionState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'result'
  | 'error'
  | 'permission_denied'
  | 'unavailable'; // kept in the union for component compatibility

export interface SpeechRecognitionResult {
  /** Current recognition state */
  state: RecognitionState;
  /** Final recognised text (set when state === 'result') */
  transcript: string;
  /** Live partial text while still listening */
  partialTranscript: string;
  /** Human-readable error message (set when state === 'error') */
  error: string;
  /** Start listening — handles permission request internally */
  startListening: () => Promise<void>;
  /** Manually stop the microphone */
  stopListening: () => Promise<void>;
  /** Reset to idle and clear transcript */
  reset: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpeechRecognition(): SpeechRecognitionResult {
  const [state, setState] = useState<RecognitionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState('');

  // ── Event: recognition session started ────────────────────────────────────
  useSpeechRecognitionEvent('start', () => {
    setState('listening');
  });

  // ── Event: session ended (mic closed) ─────────────────────────────────────
  useSpeechRecognitionEvent('end', () => {
    setState((prev) =>
      prev === 'listening' || prev === 'processing' ? 'processing' : prev,
    );
  });

  // ── Event: results available ───────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    const text: string = event.results?.[0]?.transcript ?? '';
    if (event.isFinal) {
      if (text) {
        setTranscript(text);
        setPartialTranscript('');
        setState('result');
      } else {
        // Final with empty text — silently return to idle
        setState('idle');
      }
    } else {
      // Interim / partial result
      setPartialTranscript(text);
      setState('listening');
    }
  });

  // ── Event: error ───────────────────────────────────────────────────────────
  useSpeechRecognitionEvent('error', (event) => {
    const code = String(event.error ?? '');
    const msg  = String(event.message ?? '');

    // "no-speech" (Android code 7) — user was silent; return to idle gracefully
    if (code === 'no-speech' || code === '7' || msg.includes('7')) {
      setState('idle');
    } else if (code === 'not-allowed' || code === 'service-not-allowed') {
      setState('permission_denied');
    } else {
      setError(msg || code || 'Speech recognition error');
      setState('error');
    }
  });

  // ── Request permissions ────────────────────────────────────────────────────
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { granted } =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return granted;
    } catch {
      return false;
    }
  }, []);

  // ── Start listening ────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    try {
      setTranscript('');
      setPartialTranscript('');
      setError('');

      const granted = await requestPermissions();
      if (!granted) {
        setState('permission_denied');
        return;
      }

      // Start recognition — prefer on-device when available (offline-first)
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false, // allow cloud fallback if offline model unavailable
        addsPunctuation: false,
      });
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      setError(msg || 'Failed to start recognition');
      setState('error');
    }
  }, [requestPermissions]);

  // ── Stop listening ─────────────────────────────────────────────────────────
  const stopListening = useCallback(async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setState('idle');
    }
  }, []);

  // ── Reset to idle ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState('idle');
    setTranscript('');
    setPartialTranscript('');
    setError('');
  }, []);

  return {
    state,
    transcript,
    partialTranscript,
    error,
    startListening,
    stopListening,
    reset,
  };
}
