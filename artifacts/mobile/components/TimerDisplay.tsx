/**
 * TimerDisplay.tsx — Persistent active-timer card shown above other panels.
 *
 * Visible whenever a timer is running or paused; disappears when idle.
 * Shows the live countdown and a cancel button.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { TimerState } from '@/hooks/useTimerManager';

interface Props {
  state: TimerState;
  onCancel: () => void;
  onDismiss: () => void;
}

export default function TimerDisplay({ state, onCancel, onDismiss }: Props) {
  const colors = useColors();
  const opacity = useSharedValue(0);
  const ty = useSharedValue(-12);

  const visible = !state.isIdle;

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 280 });
      ty.value = withSpring(0, { damping: 20, stiffness: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      ty.value = withTiming(-12, { duration: 200 });
    }
  }, [visible]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  if (!visible) return null;

  const isCompleted = state.isCompleted;
  const accentColor = isCompleted ? colors.listeningRing : colors.accent;
  const label = state.record?.durationDisplay ?? '';

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: colors.card, borderColor: accentColor + '55' }, anim]}
    >
      <View style={styles.row}>
        <Feather
          name={isCompleted ? 'check-circle' : state.isPaused ? 'pause-circle' : 'clock'}
          size={20}
          color={accentColor}
        />

        <View style={styles.info}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            {isCompleted ? 'Timer finished' : state.isPaused ? 'Timer paused' : 'Timer'}
          </Text>
          <Text style={[styles.countdown, { color: colors.foreground }]}>
            {isCompleted ? label : state.countdownDisplay}
          </Text>
        </View>

        <View style={styles.actions}>
          {isCompleted ? (
            <Pressable onPress={onDismiss} style={styles.btn} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <Pressable onPress={onCancel} style={styles.btn} hitSlop={8}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Progress bar */}
      {!isCompleted && state.record && (
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: state.isPaused ? colors.processingRing : accentColor,
                width: `${Math.min(100, 100 - (state.remainingMs / state.record.totalMs) * 100)}%`,
              },
            ]}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginVertical: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1 },
  label: { fontSize: 11, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.8 },
  countdown: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: 2, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { padding: 6 },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
});
