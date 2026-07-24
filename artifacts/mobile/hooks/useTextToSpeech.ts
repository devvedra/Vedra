/**
 * useTextToSpeech
 *
 * Thin wrapper around expo-speech.
 * Exposes a `speak(text)` function that reads text aloud and tracks
 * whether the device is currently speaking.
 *
 * On Android, expo-speech uses the system TTS engine (Google TTS by default).
 * Works in Expo Go and production builds.
 *
 * Speech rate and pitch adapt automatically to the active tone strategy:
 *   • hinglish-mentor   → 1.05× rate (upbeat)
 *   • focused-academic  → 0.95× rate (steady, clear)
 *   • local-companion   → 1.00× rate (natural conversational)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { getSettings } from '@/utils/settingsStore';
import type { ToneStrategy } from '@/utils/settingsStore';

// ─── Tone defaults ────────────────────────────────────────────────────────────

const TONE_RATE: Record<ToneStrategy, number> = {
  'hinglish-mentor':  1.05,
  'focused-academic': 0.95,
  'local-companion':  1.00,
};

const TONE_PITCH: Record<ToneStrategy, number> = {
  'hinglish-mentor':  1.05,
  'focused-academic': 1.00,
  'local-companion':  0.95,
};

export interface TextToSpeechResult {
  /** Speak a sentence aloud. Stops any in-progress speech first. */
  speak: (text: string) => Promise<void>;
  /** Stop speaking immediately */
  stop: () => Promise<void>;
  /** True while the device is reading text */
  isSpeaking: boolean;
}

export function useTextToSpeech(): TextToSpeechResult {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Cache the user's settings so speak() doesn't hit AsyncStorage every call.
  const rateRef  = useRef<number>(1.0);
  const pitchRef = useRef<number>(1.05);
  const langRef  = useRef<string>('en-US');

  useEffect(() => {
    getSettings().then(s => {
      const tone = s.toneStrategy ?? 'hinglish-mentor';
      // User-set sliders take priority if they differ from the default 1.0 centre;
      // otherwise fall back to the tone-specific default.
      rateRef.current  = s.voiceSpeed !== 1.0 ? s.voiceSpeed : TONE_RATE[tone];
      pitchRef.current = s.voicePitch !== 1.0 ? s.voicePitch : TONE_PITCH[tone];
      langRef.current  = s.language ?? 'en-US';
    });
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      const alreadySpeaking = await Speech.isSpeakingAsync();
      if (alreadySpeaking) {
        await Speech.stop();
      }

      setIsSpeaking(true);

      Speech.speak(text, {
        language: langRef.current,
        pitch: pitchRef.current,
        rate:  rateRef.current,
        onDone:    () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError:   () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await Speech.stop();
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  return { speak, stop, isSpeaking };
}
