/**
 * StatusText
 *
 * A single line of instructional / state text shown below the mic button.
 * Cross-fades when the state changes so transitions feel smooth rather than
 * jarring.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import type { RecognitionState } from '@/hooks/useSpeechRecognition';

// ── Label map ─────────────────────────────────────────────────────────────────

const STATE_LABELS: Record<RecognitionState, string> = {
  idle: 'Tap to speak',
  listening: 'Listening…',
  processing: 'Processing…',
  result: 'Got it!',
  error: 'Try again',
  permission_denied: 'Microphone access denied',
  unavailable: 'Voice unavailable in preview',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface StatusTextProps {
  state: RecognitionState;
}

export default function StatusText({ state }: StatusTextProps) {
  const colors = useColors();
  const opacity = useSharedValue(1);

  // Brief cross-fade on state change
  useEffect(() => {
    opacity.value = withSequence(
      withTiming(0, { duration: 120 }),
      withTiming(1, { duration: 200 }),
    );
  }, [state]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const textColor =
    state === 'listening'
      ? colors.listeningRing
      : state === 'processing'
        ? colors.processingRing
        : state === 'error' || state === 'permission_denied'
          ? colors.destructive
          : state === 'unavailable'
            ? colors.mutedForeground
            : colors.mutedForeground;

  return (
    <Animated.View style={animStyle}>
      <Text style={[styles.text, { color: textColor }]}>
        {STATE_LABELS[state]}
      </Text>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
