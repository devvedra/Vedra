/**
 * MicButton
 *
 * The centrepiece of Vedra's voice interface — a large circular microphone
 * button that reacts visually to every recognition state.
 *
 * Idle       → solid indigo circle
 * Listening  → green circle with three concentric pulsing rings
 * Processing → amber circle with slow breathing scale animation
 * Result     → brief green flash, then returns to idle
 * Error      → red circle
 *
 * The button is intentionally large (BUTTON_SIZE = 120) so it works well as
 * the primary tap target. Press feedback uses a quick scale spring.
 */

import React, { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { RecognitionState } from '@/hooks/useSpeechRecognition';

// ── Constants ─────────────────────────────────────────────────────────────────

const BUTTON_SIZE = 120;
const RING_SIZE = BUTTON_SIZE + 24;
const ICON_SIZE = 40;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the background colour for the mic circle based on current state. */
function getStateColor(
  state: RecognitionState,
  colors: ReturnType<typeof useColors>,
): string {
  switch (state) {
    case 'listening':
      return colors.listeningRing;
    case 'processing':
      return colors.processingRing;
    case 'error':
    case 'permission_denied':
      return colors.destructive;
    case 'unavailable':
      return colors.mutedForeground;
    default:
      return colors.primary;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MicButtonProps {
  state: RecognitionState;
  onPress: () => void;
}

export default function MicButton({ state, onPress }: MicButtonProps) {
  const colors = useColors();

  // Button press scale
  const pressScale = useSharedValue(1);

  // Pulsing rings (three independent shared values)
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0);
  const ring3Scale = useSharedValue(1);
  const ring3Opacity = useSharedValue(0);

  // Processing "breathing" scale
  const breathScale = useSharedValue(1);

  const isListening = state === 'listening';
  const isProcessing = state === 'processing';

  // ── Listening pulse animation ─────────────────────────────────────────────
  useEffect(() => {
    if (isListening) {
      const DURATION = 1600;

      // Ring 1 — starts immediately
      ring1Scale.value = withRepeat(
        withTiming(2.2, { duration: DURATION, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      );
      ring1Opacity.value = withRepeat(
        withTiming(0, { duration: DURATION }),
        -1,
        false,
      );

      // Ring 2 — starts 500 ms later
      ring2Scale.value = withDelay(
        500,
        withRepeat(
          withTiming(2.2, { duration: DURATION, easing: Easing.out(Easing.cubic) }),
          -1,
          false,
        ),
      );
      ring2Opacity.value = withDelay(
        500,
        withRepeat(withTiming(0, { duration: DURATION }), -1, false),
      );

      // Ring 3 — starts 1000 ms later
      ring3Scale.value = withDelay(
        1000,
        withRepeat(
          withTiming(2.2, { duration: DURATION, easing: Easing.out(Easing.cubic) }),
          -1,
          false,
        ),
      );
      ring3Opacity.value = withDelay(
        1000,
        withRepeat(withTiming(0, { duration: DURATION }), -1, false),
      );
    } else {
      // Stop all rings
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);
      cancelAnimation(ring3Scale);
      cancelAnimation(ring3Opacity);

      ring1Scale.value = withTiming(1, { duration: 300 });
      ring1Opacity.value = withTiming(0, { duration: 300 });
      ring2Scale.value = withTiming(1, { duration: 300 });
      ring2Opacity.value = withTiming(0, { duration: 300 });
      ring3Scale.value = withTiming(1, { duration: 300 });
      ring3Opacity.value = withTiming(0, { duration: 300 });
    }
  }, [isListening]);

  // ── Processing breathing animation ────────────────────────────────────────
  useEffect(() => {
    if (isProcessing) {
      breathScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(breathScale);
      breathScale.value = withTiming(1, { duration: 300 });
    }
  }, [isProcessing]);

  // ── Animated styles ───────────────────────────────────────────────────────
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * breathScale.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));
  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring3Scale.value }],
    opacity: ring3Opacity.value,
  }));

  // ── Press handlers ────────────────────────────────────────────────────────
  const handlePressIn = () => {
    pressScale.value = withSpring(0.92, { damping: 10, stiffness: 300 });
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  const ringColor = isListening ? colors.listeningRing : colors.primary;
  const buttonColor = getStateColor(state, colors);

  return (
    <View style={styles.wrapper}>
      {/* ── Pulsing rings (only rendered while listening) ── */}
      <Animated.View
        style={[
          styles.ring,
          { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderColor: ringColor },
          ring1Style,
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.ring,
          { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderColor: ringColor },
          ring2Style,
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.ring,
          { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderColor: ringColor },
          ring3Style,
        ]}
        pointerEvents="none"
      />

      {/* ── Main mic circle ── */}
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={
          state === 'listening' ? 'Stop listening' : 'Start listening'
        }
        testID="mic-button"
      >
        <Animated.View
          style={[
            styles.circle,
            { backgroundColor: buttonColor },
            buttonStyle,
          ]}
        >
          <Feather
            name={state === 'listening' ? 'mic' : 'mic'}
            size={ICON_SIZE}
            color="#FFFFFF"
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    width: RING_SIZE * 2.5,
    height: RING_SIZE * 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0,
  },
  circle: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow (iOS / web)
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
});
