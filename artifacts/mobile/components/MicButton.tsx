/**
 * MicButton — Vedra v0.6 Premium
 *
 * Multi-layer glass orb with ambient glow, gradient fill, and
 * staggered pulse rings. Each state has a distinct visual signature:
 *
 *  Idle       — violet gradient, static ambient halo
 *  Listening  — cyan/mint accent, 4 ripple rings
 *  Processing — amber gradient, slow breathing pulse
 *  Result     — brief mint flash
 *  Error      — red gradient
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { RecognitionState } from '@/hooks/useSpeechRecognition';

// ── Constants ──────────────────────────────────────────────────────────────────
const BTN   = 132;          // main circle diameter
const ICON  = 42;
const RINGS = 4;            // number of ripple rings while listening
const RING_MAX_SCALE = 2.6;
const RING_DURATION  = 1800;

// ── Colour helpers ─────────────────────────────────────────────────────────────
function getGradient(
  state: RecognitionState,
  colors: ReturnType<typeof useColors>,
): [string, string] {
  switch (state) {
    case 'listening':
      return ['#0FDFAA', '#06B6D4'];
    case 'processing':
      return ['#F59E0B', '#EF8C1A'];
    case 'error':
    case 'permission_denied':
      return ['#EF4444', '#DC2626'];
    case 'unavailable':
      return [colors.mutedForeground, '#2A2A50'];
    default:
      return ['#7C3AED', '#4F46E5'];
  }
}

// ── Ring sub-component ─────────────────────────────────────────────────────────
function Ring({
  index,
  color,
  isActive,
}: {
  index: number;
  color: string;
  isActive: boolean;
}) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0);
  const delay   = index * (RING_DURATION / RINGS);

  useEffect(() => {
    if (isActive) {
      opacity.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(0.55, { duration: 80 }),
          withTiming(0,    { duration: RING_DURATION - 80, easing: Easing.out(Easing.quad) }),
        ), -1, false,
      ));
      scale.value = withDelay(delay, withRepeat(
        withTiming(RING_MAX_SCALE, { duration: RING_DURATION, easing: Easing.out(Easing.cubic) }),
        -1, false,
      ));
    } else {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value   = withTiming(1,   { duration: 400 });
      opacity.value = withTiming(0,   { duration: 400 });
    }
  }, [isActive]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    position: 'absolute',
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    borderWidth: 1.5,
    borderColor: color,
  }));

  return <Animated.View style={style} pointerEvents="none" />;
}

// ── Main component ─────────────────────────────────────────────────────────────
interface MicButtonProps {
  state: RecognitionState;
  onPress: () => void;
}

export default function MicButton({ state, onPress }: MicButtonProps) {
  const colors     = useColors();
  const pressScale = useSharedValue(1);
  const breathScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  const isListening  = state === 'listening';
  const isProcessing = state === 'processing';
  const [gradFrom, gradTo] = getGradient(state, colors);
  const ringColor = isListening ? colors.listeningRing : colors.accent;

  // Ambient glow pulse — always on but faster while listening
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(isListening ? 0.9 : 0.35, { duration: isListening ? 900 : 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(isListening ? 0.4 : 0.15, { duration: isListening ? 900 : 2400, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
  }, [isListening]);

  // Processing breath
  useEffect(() => {
    if (isProcessing) {
      breathScale.value = withRepeat(
        withSequence(
          withTiming(1.07, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.00, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ), -1, false,
      );
    } else {
      cancelAnimation(breathScale);
      breathScale.value = withTiming(1, { duration: 300 });
    }
  }, [isProcessing]);

  const btnStyle   = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value * breathScale.value }] }));
  const glowStyle  = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const handlePressIn  = () => { pressScale.value = withSpring(0.90, { damping: 10, stiffness: 350 }); };
  const handlePressOut = () => { pressScale.value = withSpring(1,    { damping: 10, stiffness: 350 }); };

  return (
    <View style={styles.wrapper}>
      {/* ── Ambient background glow ── */}
      <Animated.View
        pointerEvents="none"
        style={[styles.ambientGlow, { backgroundColor: isListening ? 'rgba(16,255,170,0.10)' : 'rgba(124,58,237,0.14)' }, glowStyle]}
      />

      {/* ── Ripple rings ── */}
      {Array.from({ length: RINGS }).map((_, i) => (
        <Ring key={i} index={i} color={ringColor} isActive={isListening} />
      ))}

      {/* ── Static outer decoration ring ── */}
      <View style={[styles.decorRing, { borderColor: isListening ? 'rgba(16,255,170,0.18)' : 'rgba(124,58,237,0.22)' }]} />
      <View style={[styles.decorRingInner, { borderColor: isListening ? 'rgba(16,255,170,0.09)' : 'rgba(79,70,229,0.14)' }]} />

      {/* ── Button ── */}
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={state === 'listening' ? 'Stop listening' : 'Start listening'}
      >
        <Animated.View style={[styles.btnOuter, btnStyle]}>
          {/* Glass rim */}
          <View style={styles.glassRim} />
          {/* Gradient fill */}
          <LinearGradient
            colors={[gradFrom, gradTo]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.gradient}
          >
            {/* Inner gloss highlight */}
            <View style={styles.gloss} />
            <Feather name="mic" size={ICON} color="#FFFFFF" style={styles.icon} />
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    width: BTN * 3.2,
    height: BTN * 3.2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ambientGlow: {
    position: 'absolute',
    width: BTN * 2.2,
    height: BTN * 2.2,
    borderRadius: BTN * 1.1,
  },

  decorRing: {
    position: 'absolute',
    width: BTN * 1.55,
    height: BTN * 1.55,
    borderRadius: BTN * 0.775,
    borderWidth: 1,
  },
  decorRingInner: {
    position: 'absolute',
    width: BTN * 1.28,
    height: BTN * 1.28,
    borderRadius: BTN * 0.64,
    borderWidth: 1,
  },

  btnOuter: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    ...Platform.select({
      ios: { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 28 },
      android: { elevation: 18 },
    }),
  },
  glassRim: {
    position: 'absolute',
    inset: 0,
    borderRadius: BTN / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 2,
  },
  gradient: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    top: 6,
    left: 16,
    width: BTN * 0.52,
    height: BTN * 0.28,
    borderRadius: BTN * 0.14,
    backgroundColor: 'rgba(255,255,255,0.13)',
    zIndex: 1,
  },
  icon: {
    zIndex: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
