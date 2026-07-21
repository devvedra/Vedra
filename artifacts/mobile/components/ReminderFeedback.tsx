/**
 * ReminderFeedback.tsx — Reminder set / list / delete result card
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
import type { Reminder } from '@/utils/reminderManager';

// ── State type ─────────────────────────────────────────────────────────────

export type ReminderFeedbackState =
  | { phase: 'none' }
  | { phase: 'setting' }
  | { phase: 'set';     reminder: Reminder }
  | { phase: 'failed';  message: string }
  | { phase: 'list';    reminders: Reminder[] }
  | { phase: 'deleted'; reminder: Reminder }
  | { phase: 'delete_failed'; message: string };

interface Props {
  state: ReminderFeedbackState;
}

export default function ReminderFeedback({ state }: Props) {
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

  const isError = state.phase === 'failed' || state.phase === 'delete_failed';
  const iconColor = isError ? colors.destructive : colors.accent;

  function headerText(): string {
    switch (state.phase) {
      case 'setting':       return 'Setting reminder…';
      case 'set':           return `Reminder set for ${state.reminder.timeDisplay}`;
      case 'failed':        return 'Could not set reminder';
      case 'list':          return state.reminders.length === 0
                              ? 'No upcoming reminders'
                              : `${state.reminders.length} reminder${state.reminders.length !== 1 ? 's' : ''}`;
      case 'deleted':       return 'Reminder deleted';
      case 'delete_failed': return 'Could not delete reminder';
      default:              return '';
    }
  }

  function bodyText(): string {
    switch (state.phase) {
      case 'set':           return `"${state.reminder.message}"`;
      case 'failed':        return state.message;
      case 'deleted':       return `"${state.reminder.message}"`;
      case 'delete_failed': return state.message;
      default:              return '';
    }
  }

  function formatTrigger(ms: number): string {
    const d = new Date(ms);
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    const mm = m.toString().padStart(2, '0');
    return `${hh}:${mm} ${ampm}`;
  }

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, anim]}>
      <View style={styles.header}>
        <Feather name="bell" size={18} color={iconColor} />
        <Text style={[styles.title, { color: colors.cardForeground }]}>{headerText()}</Text>
      </View>

      {bodyText() ? (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{bodyText()}</Text>
      ) : null}

      {state.phase === 'list' && state.reminders.length > 0 && (
        <FlatList
          data={state.reminders}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          )}
          renderItem={({ item }) => (
            <View style={styles.reminderRow}>
              <Feather name="bell" size={13} color={colors.accent} />
              <View style={styles.reminderInfo}>
                <Text style={[styles.reminderMsg, { color: colors.cardForeground }]}>{item.message}</Text>
                <Text style={[styles.reminderTime, { color: colors.mutedForeground }]}>
                  {formatTrigger(item.triggerMs)}
                </Text>
              </View>
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
  title:  { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  body:   { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  divider:{ height: 1, marginVertical: 4 },
  reminderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  reminderInfo: { flex: 1 },
  reminderMsg:  { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  reminderTime: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
});
