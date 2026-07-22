/**
 * MemoryFeedback.tsx — Vedra v0.8
 *
 * Shown when Vedra stores or recalls something from local memory.
 * Displays a compact card indicating what was remembered.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type MemoryFeedbackState =
  | { phase: 'none' }
  | { phase: 'stored'; key: string; value: string }
  | { phase: 'recalled'; key: string; value: string }
  | { phase: 'not_found'; key: string };

interface Props { state: MemoryFeedbackState }

export default function MemoryFeedback({ state }: Props) {
  const colors = useColors();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const visible = state.phase !== 'none';

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(12, { duration: 200 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const icon = state.phase === 'stored' ? 'save' : state.phase === 'recalled' ? 'database' : 'help-circle';
  const label = state.phase === 'stored' ? 'REMEMBERED' : state.phase === 'recalled' ? 'RECALLED' : 'NOT FOUND';
  const accentColor = state.phase === 'not_found' ? colors.mutedForeground : colors.accent;

  let content = '';
  if (state.phase === 'stored') content = `${state.key}: ${state.value}`;
  else if (state.phase === 'recalled') content = `${state.key}: ${state.value}`;
  else content = `I don't know your ${state.key} yet.`;

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, animStyle]}>
      <View style={styles.row}>
        <Feather name={icon as any} size={14} color={accentColor} />
        <Text style={[styles.label, { color: accentColor }]}>{label}</Text>
      </View>
      <Text style={[styles.content, { color: colors.foreground }]}>{content}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 6,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2 },
  content: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
});
