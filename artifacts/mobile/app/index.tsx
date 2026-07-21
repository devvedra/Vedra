/**
 * Vedra — Voice Screen (root screen)
 *
 * This is the entire UI for Vedra v0.1. It wires together:
 *  - useSpeechRecognition — Android SpeechRecognizer via @react-native-voice/voice
 *  - useTextToSpeech     — expo-speech for reading the result aloud
 *  - MicButton           — the large animated microphone button
 *  - ListeningWave       — animated sound-wave bars during listening
 *  - TranscriptCard      — the recognised text displayed in a card
 *  - StatusText          — a one-line description of the current state
 *
 * State flow:
 *   idle → tap mic → listening → (speech detected) → processing → result
 *   → TTS reads "I heard: <text>" → tap again → idle
 */

import React, { useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/hooks/useColors';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

import MicButton from '@/components/MicButton';
import ListeningWave from '@/components/ListeningWave';
import TranscriptCard from '@/components/TranscriptCard';
import StatusText from '@/components/StatusText';

// ── Component ─────────────────────────────────────────────────────────────────

export default function VoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const {
    state,
    transcript,
    partialTranscript,
    startListening,
    stopListening,
    reset,
  } = useSpeechRecognition();

  const { speak, isSpeaking } = useTextToSpeech();

  // ── Auto-trigger TTS when a result arrives ──────────────────────────────
  useEffect(() => {
    if (state === 'result' && transcript) {
      speak(`I heard: ${transcript}`);
    }
  }, [state, transcript]);

  // ── Handle mic button tap ───────────────────────────────────────────────
  const handleMicPress = async () => {
    // Haptic feedback for a satisfying tap feel
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (state === 'listening') {
      // Tap again while listening → stop early
      await stopListening();
    } else if (state === 'result' || state === 'error') {
      // Tap after a result → reset and listen again
      reset();
      setTimeout(startListening, 100); // small delay so state updates first
    } else if (state === 'idle') {
      await startListening();
    }
    // Other states (processing, permission_denied, unavailable) — do nothing
  };

  // ── Derive display transcript ───────────────────────────────────────────
  // Show partial results in real-time while listening
  const displayTranscript =
    state === 'result' ? transcript : partialTranscript;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0),
        },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* ── Top: App identity ── */}
      <View style={styles.header}>
        <Text style={[styles.appName, { color: colors.foreground }]}>
          VEDRA
        </Text>
        <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
          Your voice assistant
        </Text>
      </View>

      {/* ── Centre: Mic button + wave ── */}
      <View style={styles.centre}>
        {/* Listening wave — visible during active listening */}
        <View style={styles.waveContainer}>
          <ListeningWave isListening={state === 'listening'} />
        </View>

        {/* The microphone button */}
        <MicButton state={state} onPress={handleMicPress} />

        {/* Status label below the button */}
        <View style={styles.statusContainer}>
          <StatusText state={state} />
        </View>
      </View>

      {/* ── Bottom: Transcript & help text ── */}
      <View style={styles.bottom}>
        {/* Show transcript card when there is recognised or partial text */}
        {displayTranscript ? (
          <TranscriptCard
            transcript={displayTranscript}
            isSpeaking={isSpeaking}
          />
        ) : (
          /* Placeholder so layout doesn't shift */
          <View style={styles.emptyCard}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {state === 'unavailable'
                ? 'Build the APK to enable voice recognition'
                : 'Your words will appear here'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    paddingTop: 24,
    gap: 6,
  },
  appName: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 8,
  },
  appTagline: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.5,
  },

  // ── Centre ──
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  waveContainer: {
    height: 52,
    justifyContent: 'center',
  },
  statusContainer: {
    marginTop: 16,
    height: 24, // fixed height so layout doesn't jump
    justifyContent: 'center',
  },

  // ── Bottom ──
  bottom: {
    paddingBottom: 32,
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  emptyCard: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
