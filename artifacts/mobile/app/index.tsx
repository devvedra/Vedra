/**
 * Vedra — Voice Screen (v0.2)
 *
 * Extends v0.1 with offline voice-command parsing and Android app launching.
 *
 * Flow:
 *   idle → tap mic → listening → speech captured → processing → result
 *     ├─ command recognised  → launch app → speak "Opening <App>" → show status
 *     └─ no command detected → speak "I heard: <text>"  → show transcript
 *
 * Components wired here:
 *   MicButton         — large animated microphone button
 *   ListeningWave     — animated waveform bars while listening
 *   StatusText        — one-line state description
 *   TranscriptCard    — live partial-transcript display while listening
 *   CommandFeedback   — final result card (transcript + command + status)
 *
 * Utilities:
 *   useSpeechRecognition — Android SpeechRecognizer hook
 *   useTextToSpeech      — expo-speech hook
 *   parseCommand         — offline command parser (commandParser.ts)
 *   launchApp            — Android intent launcher (appLauncher.ts)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/hooks/useColors';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { parseCommand } from '@/utils/commandParser';
import { launchApp } from '@/utils/appLauncher';

import MicButton from '@/components/MicButton';
import ListeningWave from '@/components/ListeningWave';
import StatusText from '@/components/StatusText';
import TranscriptCard from '@/components/TranscriptCard';
import CommandFeedback, { type FeedbackState } from '@/components/CommandFeedback';

// ── Component ─────────────────────────────────────────────────────────────────

export default function VoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // ── Voice recognition ────────────────────────────────────────────────────
  const {
    state: voiceState,
    transcript,
    partialTranscript,
    startListening,
    stopListening,
    reset: resetVoice,
  } = useSpeechRecognition();

  // ── Text-to-speech ────────────────────────────────────────────────────────
  const { speak, isSpeaking } = useTextToSpeech();

  // ── Command feedback state ────────────────────────────────────────────────
  // Tracks the current phase of command execution so CommandFeedback can
  // render the correct UI. Reset to 'none' each time the user starts a new
  // recording session.
  const [feedback, setFeedback] = useState<FeedbackState>({ phase: 'none' });

  // Prevent the effect from firing twice on strict-mode double invocations
  const lastProcessedTranscript = useRef<string>('');

  // ── Process result ────────────────────────────────────────────────────────
  useEffect(() => {
    if (voiceState !== 'result' || !transcript) return;
    if (transcript === lastProcessedTranscript.current) return;
    lastProcessedTranscript.current = transcript;

    const command = parseCommand(transcript);

    if (!command) {
      // ── No command — fall back to generic "I heard…" response ──────────
      setFeedback({ phase: 'unrecognized', transcript });
      speak(`I heard: ${transcript}`);
      return;
    }

    // ── Command recognised — launch the app ──────────────────────────────
    const { app } = command;

    // Immediately update UI to "launching" and start speaking
    setFeedback({ phase: 'launching', transcript, appName: app.displayName });
    speak(`Opening ${app.displayName}`);

    // Attempt the launch asynchronously
    launchApp(app).then((result) => {
      if (result.success) {
        setFeedback({ phase: 'success', transcript, appName: app.displayName });
      } else {
        // App not found or not installed
        speak("I couldn't find that app.");
        setFeedback({ phase: 'failed', transcript, appName: app.displayName });
      }
    });
  }, [voiceState, transcript]);

  // ── Mic button handler ────────────────────────────────────────────────────
  const handleMicPress = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (voiceState === 'listening') {
      // Tap again while listening → stop early
      await stopListening();
    } else if (voiceState === 'result' || voiceState === 'error') {
      // Start a new session — clear previous feedback first
      lastProcessedTranscript.current = '';
      setFeedback({ phase: 'none' });
      resetVoice();
      setTimeout(startListening, 100);
    } else if (voiceState === 'idle') {
      lastProcessedTranscript.current = '';
      setFeedback({ phase: 'none' });
      await startListening();
    }
  }, [voiceState, startListening, stopListening, resetVoice]);

  // ── Derived display values ────────────────────────────────────────────────
  // Show live partial transcript while listening; hide once we have a result
  // (CommandFeedback handles the final display)
  const showLiveTranscript =
    (voiceState === 'listening' || voiceState === 'processing') &&
    !!partialTranscript;

  const showFeedbackCard = feedback.phase !== 'none';
  const showHint = !showLiveTranscript && !showFeedbackCard;

  // ── Render ────────────────────────────────────────────────────────────────
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

      {/* ── Header — app identity ── */}
      <View style={styles.header}>
        <Text style={[styles.appName, { color: colors.foreground }]}>
          VEDRA
        </Text>
        <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
          Your voice assistant
        </Text>
      </View>

      {/* ── Centre — mic button area ── */}
      <View style={styles.centre}>
        {/* Waveform: animated bars while listening */}
        <View style={styles.waveContainer}>
          <ListeningWave isListening={voiceState === 'listening'} />
        </View>

        {/* Primary interaction: the microphone button */}
        <MicButton state={voiceState} onPress={handleMicPress} />

        {/* One-line state description */}
        <View style={styles.statusContainer}>
          <StatusText state={voiceState} />
        </View>
      </View>

      {/* ── Bottom — result display ── */}
      <View style={styles.bottom}>
        {/* Live partial transcript while the microphone is open */}
        {showLiveTranscript && (
          <TranscriptCard
            transcript={partialTranscript}
            isSpeaking={false}
          />
        )}

        {/* Command feedback card: transcript + detected command + status */}
        {showFeedbackCard && (
          <CommandFeedback state={feedback} />
        )}

        {/* Idle hint when nothing has been said yet */}
        {showHint && (
          <View style={styles.emptyCard}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {voiceState === 'unavailable'
                ? 'Build the APK to enable voice recognition'
                : 'Try: "Open WhatsApp" or "Launch Chrome"'}
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
    paddingHorizontal: 24,
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
    height: 24,
    justifyContent: 'center',
  },

  // ── Bottom ──
  bottom: {
    paddingBottom: 28,
    minHeight: 130,
    justifyContent: 'flex-end',
  },
  emptyCard: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
