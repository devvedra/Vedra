/**
 * ListeningWave
 *
 * Five vertical bars that animate up and down when the microphone is active,
 * mimicking an audio waveform. Each bar has a staggered start delay so they
 * don't all pulse in unison — the visual effect feels organic and alive.
 *
 * When `isListening` is false the bars shrink to their minimum height.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

// ── Config ────────────────────────────────────────────────────────────────────

const BAR_WIDTH = 5;
const BAR_MIN_HEIGHT = 6;
const BAR_MAX_HEIGHT = 36;
const BAR_BORDER_RADIUS = 4;
const BAR_SPACING = 7;
const ANIMATION_DURATION = 380; // ms for one bar movement

// Relative amplitude pattern — centre bar is tallest
const AMPLITUDES = [0.45, 0.72, 1.0, 0.72, 0.45];
const DELAYS_MS = [0, 120, 60, 180, 90];

// ── Component ─────────────────────────────────────────────────────────────────

interface ListeningWaveProps {
  isListening: boolean;
}

function Bar({
  amplitude,
  delayMs,
  isListening,
  color,
}: {
  amplitude: number;
  delayMs: number;
  isListening: boolean;
  color: string;
}) {
  const maxH = BAR_MIN_HEIGHT + (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) * amplitude;
  const height = useSharedValue(BAR_MIN_HEIGHT);

  useEffect(() => {
    if (isListening) {
      height.value = withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(maxH, {
              duration: ANIMATION_DURATION,
              easing: Easing.inOut(Easing.quad),
            }),
            withTiming(BAR_MIN_HEIGHT, {
              duration: ANIMATION_DURATION,
              easing: Easing.inOut(Easing.quad),
            }),
          ),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(height);
      height.value = withTiming(BAR_MIN_HEIGHT, { duration: 250 });
    }
  }, [isListening]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: BAR_WIDTH,
          borderRadius: BAR_BORDER_RADIUS,
          backgroundColor: color,
          marginHorizontal: BAR_SPACING / 2,
        },
        animStyle,
      ]}
    />
  );
}

export default function ListeningWave({ isListening }: ListeningWaveProps) {
  const colors = useColors();
  const barColor = colors.listeningRing;

  return (
    <View style={styles.container}>
      {AMPLITUDES.map((amplitude, i) => (
        <Bar
          key={i}
          amplitude={amplitude}
          delayMs={DELAYS_MS[i]}
          isListening={isListening}
          color={barColor}
        />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_MAX_HEIGHT + 8,
    paddingHorizontal: 8,
  },
  bar: {
    alignSelf: 'center',
  },
});
