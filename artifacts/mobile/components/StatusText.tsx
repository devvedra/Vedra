/**
 * StatusText — Vedra v0.6 Premium
 *
 * Pill badge with a glowing dot indicator — cross-fades on state change.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, withRepeat, Easing,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import type { RecognitionState } from '@/hooks/useSpeechRecognition';

const LABELS: Record<RecognitionState, string> = {
  idle:             'Tap to speak',
  listening:        'Listening',
  processing:       'Processing',
  result:           'Got it',
  error:            'Try again',
  permission_denied:'Mic access denied',
  unavailable:      'Not available',
};

function dotColor(state: RecognitionState, colors: ReturnType<typeof useColors>) {
  if (state === 'listening')   return colors.listeningRing;
  if (state === 'processing')  return colors.processingRing;
  if (state === 'error' || state === 'permission_denied') return colors.destructive;
  if (state === 'result')      return colors.listeningRing;
  return colors.mutedForeground;
}

export default function StatusText({ state }: { state: RecognitionState }) {
  const colors  = useColors();
  const opacity = useSharedValue(1);
  const dotPulse = useSharedValue(1);
  const isActive = state === 'listening' || state === 'processing';

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(0, { duration: 100 }),
      withTiming(1, { duration: 220 }),
    );
  }, [state]);

  useEffect(() => {
    if (isActive) {
      dotPulse.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ), -1, false,
      );
    } else {
      dotPulse.value = withTiming(1, { duration: 300 });
    }
  }, [isActive]);

  const wrapStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const dotStyle  = useAnimatedStyle(() => ({ transform: [{ scale: dotPulse.value }] }));

  const dc = dotColor(state, colors);
  const textColor = state === 'unavailable' ? colors.mutedForeground : colors.foreground;

  return (
    <Animated.View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.07)' }, wrapStyle]}>
      <Animated.View style={[styles.dot, { backgroundColor: dc }, dotStyle]} />
      <Text style={[styles.label, { color: textColor }]}>{LABELS[state]}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.4,
  },
});
