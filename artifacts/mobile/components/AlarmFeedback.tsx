/**
 * AlarmFeedback.tsx — Alarm set / list / cancel result card
 */

import React, { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { AlarmRecord } from '@/utils/alarmManager';

// ── State type ────────────────────────────────────────────────────────────────

export type AlarmFeedbackState =
  | { phase: 'none' }
  | { phase: 'setting' }
  | { phase: 'set';     alarm: AlarmRecord }
  | { phase: 'failed';  message: string }
  | { phase: 'list';    alarms: AlarmRecord[] }
  | { phase: 'cancelled'; alarm: AlarmRecord }
  | { phase: 'cancel_failed'; message: string };

interface Props {
  state: AlarmFeedbackState;
}

export default function AlarmFeedback({ state }: Props) {
  const colors = useColors();
  const opacity = useSharedValue(0);
  const ty = useSharedValue(20);
  const visible = state.phase !== 'none';

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 280 });
      ty.value = withSpring(0, { damping: 18, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(20, { duration: 180 });
    }
  }, [visible, state.phase]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  if (!visible) return null;

  const cardBg = colors.card;
  const fg = colors.cardForeground;
  const muted = colors.mutedForeground;
  const accent = colors.accent;
  const destructive = colors.destructive;

  function iconColor(): string {
    if (state.phase === 'set' || state.phase === 'list' || state.phase === 'cancelled') return accent;
    return destructive;
  }

  function headerText(): string {
    switch (state.phase) {
      case 'setting':     return 'Setting alarm…';
      case 'set':         return `Alarm set for ${state.alarm.display}`;
      case 'failed':      return 'Alarm failed';
      case 'list':        return state.alarms.length === 0 ? 'No alarms set' : `${state.alarms.length} alarm${state.alarms.length !== 1 ? 's' : ''}`;
      case 'cancelled':   return `Alarm at ${state.alarm.display} removed`;
      case 'cancel_failed': return 'Could not cancel alarm';
      default:            return '';
    }
  }

  function bodyText(): string {
    switch (state.phase) {
      case 'failed':        return state.message;
      case 'cancel_failed': return state.message;
      case 'set':           return 'Opening your clock app to confirm.';
      case 'cancelled':     return 'Confirm deletion in your clock app.';
      default:              return '';
    }
  }

  return (
    <Animated.View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }, anim]}>
      <View style={styles.header}>
        <Feather name="clock" size={18} color={iconColor()} />
        <Text style={[styles.title, { color: fg }]}>{headerText()}</Text>
      </View>

      {bodyText() ? (
        <Text style={[styles.body, { color: muted }]}>{bodyText()}</Text>
      ) : null}

      {state.phase === 'list' && state.alarms.length > 0 && (
        <FlatList
          data={state.alarms}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: colors.border }]} />}
          renderItem={({ item }) => (
            <View style={styles.alarmRow}>
              <Feather name="bell" size={14} color={accent} />
              <Text style={[styles.alarmTime, { color: fg }]}>{item.display}</Text>
              {item.label ? <Text style={[styles.alarmLabel, { color: muted }]}>{item.label}</Text> : null}
            </View>
          )}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginVertical: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  body:  { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  divider: { height: 1, marginVertical: 4 },
  alarmRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  alarmTime:  { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  alarmLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
