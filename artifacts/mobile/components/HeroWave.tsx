/**
 * HeroWave — Vedra AI Waveform Visualizer
 *
 * A faithful React Native port of the HTML canvas waveform:
 *  - 60 animated bars driven by a Reanimated frame callback (UI thread, ~60 fps)
 *  - Bell-curve amplitude envelope (Gaussian, centred)
 *  - Idle: sinusoidal breathing pattern (wave1 × wave2 product)
 *  - Listening: same pattern amplified 3× for a live-voice feel
 *  - Gradient: purple #E040FB → blue-cyan #4FACFE, mirrored across centre
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  type SharedValue,
} from 'react-native-reanimated';

// ── Config ─────────────────────────────────────────────────────────────────────
const BARS        = 60;
const BAR_W       = 3.2;   // px
const BAR_GAP     = 2.0;   // px between bars
const MAX_H       = 120;   // max bar height (idle, envelope = 1.0)
const MIN_H       = 3;     // minimum bar height (always visible)
const LISTEN_MULT = 3.0;   // amplitude multiplier when listening

// Pre-compute the Gaussian envelope (never changes)
function gaussianEnvelope(index: number, total: number): number {
  const normalizedX = (index / (total - 1)) * 2 - 1; // -1 → +1
  return Math.exp(-Math.pow(normalizedX * 2.2, 2));
}

// Pre-compute a purple→cyan gradient per bar
// progress 0.0→0.5: #E040FB → ~#7C72FE  (red drops, green rises)
// progress 0.5→1.0: #7C72FE → #4FACFE   (red drops, green rises)
function barColor(index: number, total: number): string {
  const p = index / (total - 1); // 0→1
  let r: number, g: number, b: number;
  if (p < 0.5) {
    r = Math.round(224 - p * 2 * 200);   // 224→24
    g = Math.round(64  + p * 2 * 100);   // 64→164
    b = 251;
  } else {
    const q = (p - 0.5) * 2;             // 0→1
    r = Math.round(24  - q * 24);        // 24→0
    g = Math.round(164 + q * 28);        // 164→192 (approx)
    b = Math.round(251 + q * 3);         // ~254
  }
  return `rgb(${Math.max(0,Math.min(255,r))},${Math.max(0,Math.min(255,g))},${Math.max(0,Math.min(255,b))})`;
}

// ── Single bar ─────────────────────────────────────────────────────────────────
interface BarProps {
  index: number;
  envelope: number;
  color: string;
  timeRef: SharedValue<number>;
  isListening: boolean;
}

function Bar({ index, envelope, color, timeRef, isListening }: BarProps) {
  const mult = isListening ? LISTEN_MULT : 1;

  const style = useAnimatedStyle(() => {
    'worklet';
    const t = timeRef.value;
    const wave1 = Math.sin(t * 2 + index * 0.15);
    const wave2 = Math.cos(t * 1.5 + index * 0.25);
    const rawAmp = (Math.abs(wave1 * wave2) * 40 + 4) * envelope * mult;
    const h = Math.max(rawAmp, MIN_H * envelope);
    return { height: h };
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        { width: BAR_W, backgroundColor: color, marginHorizontal: BAR_GAP / 2 },
        style,
      ]}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
interface HeroWaveProps {
  isListening: boolean;
}

export default function HeroWave({ isListening }: HeroWaveProps) {
  const timeRef = useSharedValue(0);

  // Advance time on every frame (~60 fps) on the UI thread
  useFrameCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    timeRef.value = timeRef.value + (timeSincePreviousFrame ?? 16) * 0.00004;
  });

  // Pre-compute static per-bar data (memo — never changes)
  const barData = useMemo(
    () =>
      Array.from({ length: BARS }, (_, i) => ({
        envelope: gaussianEnvelope(i, BARS),
        color:    barColor(i, BARS),
      })),
    [],
  );

  return (
    <View style={styles.container}>
      {barData.map((d, i) => (
        <Bar
          key={i}
          index={i}
          envelope={d.envelope}
          color={d.color}
          timeRef={timeRef}
          isListening={isListening}
        />
      ))}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MAX_H + 16,
    width: '100%',
    paddingHorizontal: 8,
  },
  bar: {
    borderRadius: 2,
    alignSelf: 'center',
  },
});
