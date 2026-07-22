/**
 * SmallTalkFeedback.tsx — Vedra v0.8
 *
 * Friendly card shown for small-talk responses and unknown commands.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type SmallTalkState =
  | { phase: 'none' }
  | { phase: 'response'; response: string }
  | { phase: 'unknown'; transcript: string; suggestion: string };

interface Props { state: SmallTalkState }

export default function SmallTalkFeedback({ state }: Props) {
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

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));
  if (!visible) return null;

  const isUnknown = state.phase === 'unknown';

  return (
    <Animated.View style={[
      styles.card,
      { backgroundColor: colors.card, borderColor: isUnknown ? 'rgba(255,200,50,0.3)' : colors.border },
      animStyle,
    ]}>
      <View style={styles.row}>
        <Feather
          name={isUnknown ? 'help-circle' : 'message-circle'}
          size={14}
          color={isUnknown ? '#F59E0B' : colors.accent}
        />
        <Text style={[styles.label, { color: isUnknown ? '#F59E0B' : colors.accent }]}>
          {isUnknown ? 'NOT UNDERSTOOD' : 'VEDRA SAYS'}
        </Text>
      </View>
      {isUnknown ? (
        <>
          <Text style={[styles.transcript, { color: colors.mutedForeground }]}>
            I heard: "{(state as any).transcript}"
          </Text>
          <Text style={[styles.response, { color: colors.foreground }]}>
            {(state as any).suggestion}
          </Text>
        </>
      ) : (
        <Text style={[styles.response, { color: colors.foreground }]}>
          {(state as any).response}
        </Text>
      )}
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
    gap: 8,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  transcript: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  response: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
});
