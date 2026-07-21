/**
 * StopwatchDisplay.tsx — Persistent stopwatch card.
 *
 * Shown when the stopwatch is running or paused. Disappears in idle state.
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
import type { StopwatchHookState } from '@/hooks/useStopwatch';
import type { StopwatchAction } from '@/utils/stopwatchManager';

interface Props {
  state: StopwatchHookState;
  onAction: (action: StopwatchAction) => void;
}

export default function StopwatchDisplay({ state, onAction }: Props) {
  const colors = useColors();
  const opacity = useSharedValue(0);
  const ty = useSharedValue(-12);

  const visible = state.status !== 'idle' || state.elapsedMs > 0;

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

  const accent = state.status === 'running' ? colors.listeningRing : colors.processingRing;

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: colors.card, borderColor: accent + '55' }, anim]}
    >
      <View style={styles.row}>
        <Feather
          name={state.status === 'running' ? 'watch' : 'pause-circle'}
          size={20}
          color={accent}
        />

        <View style={styles.info}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            {state.status === 'running' ? 'Stopwatch' : state.status === 'paused' ? 'Stopwatch paused' : 'Stopwatch'}
          </Text>
          <Text style={[styles.elapsed, { color: colors.foreground }]}>{state.display}</Text>
        </View>

        {/* Controls */}
        <View style={styles.actions}>
          {state.status === 'running' && (
            <Pressable onPress={() => onAction('pause')} style={styles.btn} hitSlop={8}>
              <Feather name="pause" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
          {state.status === 'paused' && (
            <Pressable onPress={() => onAction('resume')} style={styles.btn} hitSlop={8}>
              <Feather name="play" size={18} color={accent} />
            </Pressable>
          )}
          <Pressable onPress={() => onAction('reset')} style={styles.btn} hitSlop={8}>
            <Feather name="rotate-ccw" size={16} color={colors.destructive} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginVertical: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1 },
  label: { fontSize: 11, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.8 },
  elapsed: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 4 },
  btn: { padding: 6 },
});
