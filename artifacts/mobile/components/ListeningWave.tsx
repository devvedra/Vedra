/**
 * ListeningWave — Vedra v0.6 Premium
 *
 * Nine animated bars with a violet→cyan gradient colour walk.
 * Centre bar is tallest; outer bars are thinner and shorter.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withDelay,
  cancelAnimation, Easing,
} from 'react-native-reanimated';

// ── Config ─────────────────────────────────────────────────────────────────────
const BARS = 9;
const MAX_H = 44;
const MIN_H = 4;
const DURATION = 340;

// Amplitude envelope — centred bell curve
const AMP  = [0.28, 0.48, 0.70, 0.88, 1.0, 0.88, 0.70, 0.48, 0.28];
// Stagger delays so no two adjacent bars move together
const DELAY = [0, 180, 80, 260, 40, 220, 100, 300, 60];
// Gradient: violet → cyan across the bar array
const BAR_COLORS = [
  '#7C3AED','#6D44EF','#5B52F0','#2A8FE8','#06B6D4',
  '#2A8FE8','#5B52F0','#6D44EF','#7C3AED',
];
const BAR_WIDTHS  = [3,4,4,5,6,5,4,4,3];
const BAR_SPACING = 5;

// ── Bar ────────────────────────────────────────────────────────────────────────
function Bar({ i, isListening }: { i: number; isListening: boolean }) {
  const maxH = MIN_H + (MAX_H - MIN_H) * AMP[i];
  const h    = useSharedValue(MIN_H);

  useEffect(() => {
    if (isListening) {
      h.value = withDelay(DELAY[i], withRepeat(
        withSequence(
          withTiming(maxH, { duration: DURATION, easing: Easing.inOut(Easing.quad) }),
          withTiming(MIN_H, { duration: DURATION, easing: Easing.inOut(Easing.quad) }),
        ), -1, false,
      ));
    } else {
      cancelAnimation(h);
      h.value = withTiming(MIN_H, { duration: 280 });
    }
  }, [isListening]);

  const animStyle = useAnimatedStyle(() => ({ height: h.value }));

  return (
    <Animated.View
      style={[
        {
          width: BAR_WIDTHS[i],
          borderRadius: BAR_WIDTHS[i],
          backgroundColor: BAR_COLORS[i],
          marginHorizontal: BAR_SPACING / 2,
          alignSelf: 'center',
          opacity: isListening ? 1 : 0.35,
        },
        animStyle,
      ]}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ListeningWave({ isListening }: { isListening: boolean }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: BARS }).map((_, i) => (
        <Bar key={i} i={i} isListening={isListening} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: MAX_H + 8,
    paddingHorizontal: 4,
  },
});
