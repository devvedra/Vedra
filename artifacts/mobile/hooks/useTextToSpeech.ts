/**
 * useTextToSpeech
 *
 * Thin wrapper around expo-speech.
 * Exposes a `speak(text)` function that reads text aloud and tracks
 * whether the device is currently speaking.
 *
 * On Android, expo-speech uses the system TTS engine (Google TTS by default).
 * Works in Expo Go and production builds.
 */

import { useCallback, useState } from 'react';
import * as Speech from 'expo-speech';

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

  const speak = useCallback(async (text: string) => {
    try {
      // Stop any ongoing speech before starting new one
      const alreadySpeaking = await Speech.isSpeakingAsync();
      if (alreadySpeaking) {
        await Speech.stop();
      }

      setIsSpeaking(true);

      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.05,  // slightly warmer than flat
        rate: 0.92,   // natural conversational pace
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
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
