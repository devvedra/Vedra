/**
 * useSpeechRecognition
 *
 * Wraps @react-native-voice/voice to provide a clean state machine for
 * Android's SpeechRecognizer API.
 *
 * States:
 *   idle             → ready to start
 *   listening        → microphone open, waiting for speech
 *   processing       → speech captured, waiting for result
 *   result           → transcript ready
 *   error            → recognition error (message in `error`)
 *   permission_denied → mic permission was refused
 *   unavailable      → native module not loaded (Expo Go / web preview)
 *
 * The hook requests RECORD_AUDIO on Android before starting.
 * It prefers offline recognition when the device supports it.
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

// ── Dynamic import guard ──────────────────────────────────────────────────────
// @react-native-voice/voice requires native linking and is NOT available in
// Expo Go. We load it dynamically so the UI still renders in the web preview.
let Voice: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Voice = require('@react-native-voice/voice').default;
} catch {
  Voice = null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecognitionState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'result'
  | 'error'
  | 'permission_denied'
  | 'unavailable';

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
  const [state, setState] = useState<RecognitionState>(
    Voice ? 'idle' : 'unavailable',
  );
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState('');

  // ── Register Voice event listeners ─────────────────────────────────────────
  useEffect(() => {
    if (!Voice) return;

    Voice.onSpeechStart = () => {
      setState('listening');
    };

    Voice.onSpeechEnd = () => {
      // Only move to processing if we haven't already received a result
      setState((prev) =>
        prev === 'listening' || prev === 'processing' ? 'processing' : prev,
      );
    };

    Voice.onSpeechResults = (e: any) => {
      const text: string = e?.value?.[0] ?? '';
      if (text) {
        setTranscript(text);
        setPartialTranscript('');
        setState('result');
      }
    };

    Voice.onSpeechPartialResults = (e: any) => {
      const text: string = e?.value?.[0] ?? '';
      setPartialTranscript(text);
    };

    Voice.onSpeechError = (e: any) => {
      const msg: string =
        e?.error?.message ?? e?.error?.code ?? 'Speech recognition error';

      // "7" is the Android "no match" error — treat as empty result rather
      // than a hard failure so the UI returns gracefully to idle.
      if (msg.includes('7') || msg.includes('No match')) {
        setState('idle');
      } else {
        setError(msg);
        setState('error');
      }
    };

    // Cleanup listeners when component unmounts
    return () => {
      Voice.destroy().then(() => Voice?.removeAllListeners());
    };
  }, []);

  // ── Request microphone permission (Android only) ────────────────────────────
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true; // iOS & web: handled by system

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message:
            'Vedra needs access to your microphone to understand what you say.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not now',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  // ── Start listening ─────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (!Voice) {
      setState('unavailable');
      return;
    }

    try {
      // Clear previous session
      setTranscript('');
      setPartialTranscript('');
      setError('');

      const granted = await requestPermission();
      if (!granted) {
        setState('permission_denied');
        return;
      }

      setState('listening');

      // EXTRA_PREFER_OFFLINE asks Android to use on-device recognition when
      // available — faster and works without internet.
      await Voice.start('en-US', {
        EXTRA_PREFER_OFFLINE: true,
      });
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('not available') || msg.includes('not found')) {
        setState('unavailable');
      } else {
        setError(msg || 'Failed to start recognition');
        setState('error');
      }
    }
  }, [requestPermission]);

  // ── Stop listening ─────────────────────────────────────────────────────────
  const stopListening = useCallback(async () => {
    if (!Voice) return;
    try {
      await Voice.stop();
    } catch {
      setState('idle');
    }
  }, []);

  // ── Reset to idle ─────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState(Voice ? 'idle' : 'unavailable');
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
