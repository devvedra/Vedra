/**
 * Vedra — Voice Screen (v0.3)
 *
 * Extends v0.2 with offline voice-controlled phone calling.
 *
 * ── Command flow ──────────────────────────────────────────────────────────────
 *
 *   idle → tap mic → listening → speech captured → result
 *     │
 *     ├─ OPEN_APP command  → launch app via intent  → CommandFeedback
 *     │
 *     ├─ CALL_CONTACT cmd  → search contacts
 *     │     ├─ 0 matches   → "I couldn't find that contact"
 *     │     ├─ 1 match     → request CALL_PHONE → initiateCall
 *     │     └─ 2+ matches  → show contact picker → user taps → initiateCall
 *     │
 *     └─ No command        → "I heard: <text>"
 *
 * ── Modules used ─────────────────────────────────────────────────────────────
 *
 *  Voice:          useSpeechRecognition, useTextToSpeech
 *  CommandParser:  parseCommand  (utils/commandParser)
 *  AppLauncher:    launchApp     (utils/appLauncher)
 *  Contacts:       findContactsByName, requestContactsPermission (utils/contactsManager)
 *  PhoneCall:      initiateCall  (utils/phoneCall)
 *  UI:             MicButton, ListeningWave, StatusText,
 *                  TranscriptCard, CommandFeedback, CallFeedback
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// ── Hooks ────────────────────────────────────────────────────────────────────
import { useColors } from '@/hooks/useColors';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

// ── Utilities ────────────────────────────────────────────────────────────────
import { parseCommand } from '@/utils/commandParser';
import { launchApp } from '@/utils/appLauncher';
import {
  findContactsByName,
  requestContactsPermission,
  type ContactMatch,
} from '@/utils/contactsManager';
import { initiateCall } from '@/utils/phoneCall';

// ── Components ────────────────────────────────────────────────────────────────
import MicButton from '@/components/MicButton';
import ListeningWave from '@/components/ListeningWave';
import StatusText from '@/components/StatusText';
import TranscriptCard from '@/components/TranscriptCard';
import CommandFeedback, { type FeedbackState } from '@/components/CommandFeedback';
import CallFeedback, { type CallFeedbackState } from '@/components/CallFeedback';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Which feedback panel is currently active. */
type ActivePanel = 'none' | 'open_app' | 'call';

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function VoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // ── Voice ──────────────────────────────────────────────────────────────────
  const {
    state: voiceState,
    transcript,
    partialTranscript,
    startListening,
    stopListening,
    reset: resetVoice,
  } = useSpeechRecognition();

  const { speak, stop: stopSpeaking } = useTextToSpeech();

  // ── Feedback panels ────────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [appFeedback, setAppFeedback] = useState<FeedbackState>({ phase: 'none' });
  const [callFeedback, setCallFeedback] = useState<CallFeedbackState>({ phase: 'none' });

  // Prevent double-processing in React strict-mode double invocations
  const lastProcessed = useRef<string>('');

  // ═════════════════════════════════════════════════════════════════════════════
  // Core: process voice result
  // ═════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (voiceState !== 'result' || !transcript) return;
    if (transcript === lastProcessed.current) return;
    lastProcessed.current = transcript;

    const command = parseCommand(transcript);

    if (!command) {
      // ── Unrecognised — generic fallback ─────────────────────────────────
      setActivePanel('none');
      speak(`I heard: ${transcript}`);
      return;
    }

    if (command.type === 'OPEN_APP') {
      handleOpenApp(transcript, command.app);
    } else if (command.type === 'CALL_CONTACT') {
      handleCallContact(transcript, command.contactName);
    } else {
      // SEND_SMS and any future types — fall back gracefully so the app
      // doesn't silently get stuck in 'result' state.
      setActivePanel('none');
      speak(`I heard: ${transcript}`);
    }
  }, [voiceState, transcript]);

  // ═════════════════════════════════════════════════════════════════════════════
  // OPEN_APP handler
  // ═════════════════════════════════════════════════════════════════════════════

  async function handleOpenApp(
    raw: string,
    app: Parameters<typeof launchApp>[0],
  ) {
    setActivePanel('open_app');
    setAppFeedback({ phase: 'launching', transcript: raw, appName: app.displayName });
    speak(`Opening ${app.displayName}`);

    const result = await launchApp(app);

    if (result.success) {
      setAppFeedback({ phase: 'success', transcript: raw, appName: app.displayName });
    } else {
      speak("I couldn't find that app.");
      setAppFeedback({ phase: 'failed', transcript: raw, appName: app.displayName });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // CALL_CONTACT handler
  // ═════════════════════════════════════════════════════════════════════════════

  async function handleCallContact(raw: string, contactName: string) {
    setActivePanel('call');
    setCallFeedback({ phase: 'searching', transcript: raw, contactName });

    // 1. Request contacts permission
    const hasContacts = await requestContactsPermission();
    if (!hasContacts) {
      speak("I need access to your contacts to make calls.");
      setCallFeedback({
        phase: 'contacts_error',
        transcript: raw,
        contactName,
        reason: 'Contacts permission denied. Please grant it in Settings.',
      });
      return;
    }

    // 2. Search for contacts
    let matches: ContactMatch[];
    try {
      matches = await findContactsByName(contactName);
    } catch {
      speak("I couldn't access your contacts.");
      setCallFeedback({
        phase: 'contacts_error',
        transcript: raw,
        contactName,
        reason: 'Failed to read contacts. Please try again.',
      });
      return;
    }

    // 3. Handle results
    if (matches.length === 0) {
      speak(`I couldn't find ${contactName} in your contacts.`);
      setCallFeedback({ phase: 'not_found', transcript: raw, contactName });
    } else if (matches.length === 1) {
      await placeCall(raw, contactName, matches[0]);
    } else {
      // Multiple matches — show picker
      speak(`I found ${matches.length} contacts named ${contactName}. Please tap the one you want to call.`);
      setCallFeedback({ phase: 'multiple_found', transcript: raw, contactName, contacts: matches });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Shared: place the actual call
  // ═════════════════════════════════════════════════════════════════════════════

  const placeCall = useCallback(
    async (raw: string, contactName: string, contact: ContactMatch) => {
      setCallFeedback({ phase: 'calling', transcript: raw, contactName, contact });
      speak(`Calling ${contact.displayName}.`);

      const result = await initiateCall(contact.phoneNumber);

      if (result.success) {
        setCallFeedback({
          phase: 'call_started',
          transcript: raw,
          contactName,
          contact,
          method: result.method,
        });
      } else {
        speak("I couldn't place the call. Please try again.");
        setCallFeedback({ phase: 'call_failed', transcript: raw, contactName, contact });
      }
    },
    [speak],
  );

  // Called when the user taps a contact in the multi-match picker
  const handleContactSelected = useCallback(
    (contact: ContactMatch) => {
      if (callFeedback.phase !== 'multiple_found') return;
      const { transcript: raw, contactName } = callFeedback;
      placeCall(raw, contactName, contact);
    },
    [callFeedback, placeCall],
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // Mic button handler
  // ═════════════════════════════════════════════════════════════════════════════

  const handleMicPress = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (voiceState === 'listening') {
      await stopListening();
    } else if (voiceState === 'result' || voiceState === 'error') {
      // Reset everything and start fresh
      lastProcessed.current = '';
      setActivePanel('none');
      setAppFeedback({ phase: 'none' });
      setCallFeedback({ phase: 'none' });
      stopSpeaking();
      resetVoice();
      setTimeout(startListening, 120);
    } else if (voiceState === 'idle') {
      lastProcessed.current = '';
      setActivePanel('none');
      setAppFeedback({ phase: 'none' });
      setCallFeedback({ phase: 'none' });
      await startListening();
    }
  }, [voiceState, startListening, stopListening, stopSpeaking, resetVoice]);

  // ═════════════════════════════════════════════════════════════════════════════
  // Render helpers
  // ═════════════════════════════════════════════════════════════════════════════

  const showLiveTranscript =
    (voiceState === 'listening' || voiceState === 'processing') &&
    !!partialTranscript;

  const showHint = activePanel === 'none' && !showLiveTranscript;

  // ═════════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════════

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

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.appName, { color: colors.foreground }]}>VEDRA</Text>
        <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
          Your voice assistant
        </Text>
      </View>

      {/* ── Centre: mic + wave ── */}
      <View style={styles.centre}>
        <View style={styles.waveContainer}>
          <ListeningWave isListening={voiceState === 'listening'} />
        </View>

        <MicButton state={voiceState} onPress={handleMicPress} />

        <View style={styles.statusContainer}>
          <StatusText state={voiceState} />
        </View>
      </View>

      {/* ── Bottom: feedback panels ── */}
      <ScrollView
        style={styles.bottomScroll}
        contentContainerStyle={styles.bottomContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={callFeedback.phase === 'multiple_found'}
        keyboardShouldPersistTaps="handled"
      >
        {/* Live partial transcript while listening */}
        {showLiveTranscript && (
          <TranscriptCard transcript={partialTranscript} isSpeaking={false} />
        )}

        {/* App-open feedback (OPEN_APP) */}
        {activePanel === 'open_app' && (
          <CommandFeedback state={appFeedback} />
        )}

        {/* Call feedback (CALL_CONTACT) */}
        {activePanel === 'call' && (
          <CallFeedback
            state={callFeedback}
            onContactSelected={handleContactSelected}
          />
        )}

        {/* Idle hint */}
        {showHint && (
          <View style={styles.emptyCard}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {voiceState === 'unavailable'
                ? 'Build the APK to enable voice recognition'
                : 'Try: "Call Mom" · "Open WhatsApp" · "Launch Chrome"'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },

  header: { alignItems: 'center', paddingTop: 24, gap: 6 },
  appName: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: 8 },
  appTagline: { fontSize: 13, fontFamily: 'Inter_400Regular', letterSpacing: 0.5 },

  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 280,
  },
  waveContainer: { height: 52, justifyContent: 'center' },
  statusContainer: { marginTop: 16, height: 24, justifyContent: 'center' },

  bottomScroll: { flexShrink: 1 },
  bottomContent: { paddingBottom: 28, flexGrow: 1, justifyContent: 'flex-end' },

  emptyCard: { paddingVertical: 20, alignItems: 'center' },
  hint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
