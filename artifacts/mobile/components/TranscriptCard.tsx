/**
 * TranscriptCard
 *
 * Displays the speech recognition result inside a frosted-style dark card.
 *
 * - Fades in smoothly when new text arrives.
 * - Shows a secondary label "I heard you say:" above the transcript.
 * - Shows a speaker icon + "Speaking…" badge while TTS is active.
 * - Hidden completely when there is no transcript.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

// ── Component ─────────────────────────────────────────────────────────────────

interface TranscriptCardProps {
  transcript: string;
  isSpeaking: boolean;
}

export default function TranscriptCard({
  transcript,
  isSpeaking,
}: TranscriptCardProps) {
  const colors = useColors();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  // Fade-in / slide-up when transcript appears
  useEffect(() => {
    if (transcript) {
      opacity.value = withTiming(1, { duration: 350 });
      translateY.value = withTiming(0, { duration: 350 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(12, { duration: 200 });
    }
  }, [transcript]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!transcript) return null;

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        animStyle,
      ]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <Feather name="message-circle" size={14} color={colors.accent} />
        <Text style={[styles.label, { color: colors.accent }]}>
          I heard you say
        </Text>
      </View>

      {/* Transcript text */}
      <Text style={[styles.transcript, { color: colors.foreground }]}>
        "{transcript}"
      </Text>

      {/* TTS speaking indicator */}
      {isSpeaking && (
        <View style={styles.speakingRow}>
          <Feather
            name="volume-2"
            size={13}
            color={colors.listeningRing}
            style={styles.speakerIcon}
          />
          <Text style={[styles.speakingText, { color: colors.listeningRing }]}>
            Speaking…
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  transcript: {
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    lineHeight: 26,
  },
  speakingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  speakerIcon: {},
  speakingText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
