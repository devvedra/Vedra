/**
 * CalendarFeedback.tsx — Calendar event create / list / delete result card
 */

import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { CalendarEventInfo } from '@/utils/calendarManager';

// ── State type ─────────────────────────────────────────────────────────────

export type CalendarFeedbackState =
  | { phase: 'none' }
  | { phase: 'creating' }
  | { phase: 'created'; event: CalendarEventInfo }
  | { phase: 'failed';  message: string }
  | { phase: 'list';    events: CalendarEventInfo[] }
  | { phase: 'list_failed'; message: string }
  | { phase: 'deleted'; title: string }
  | { phase: 'delete_confirm'; events: CalendarEventInfo[] }
  | { phase: 'delete_failed'; message: string };

interface Props {
  state: CalendarFeedbackState;
  onDeleteEvent?: (event: CalendarEventInfo) => void;
}

export default function CalendarFeedback({ state, onDeleteEvent }: Props) {
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

  const isError = ['failed', 'list_failed', 'delete_failed'].includes(state.phase);
  const iconColor = isError ? colors.destructive : colors.accent;

  function headerText(): string {
    switch (state.phase) {
      case 'creating':        return 'Adding to calendar…';
      case 'created':         return `"${state.event.title}" added`;
      case 'failed':          return 'Could not create event';
      case 'list':            return state.events.length === 0 ? 'No events today' : `Today — ${state.events.length} event${state.events.length !== 1 ? 's' : ''}`;
      case 'list_failed':     return 'Could not read calendar';
      case 'deleted':         return `"${state.title}" deleted`;
      case 'delete_confirm':  return 'Which event to delete?';
      case 'delete_failed':   return 'Could not delete event';
      default:                return '';
    }
  }

  function bodyText(): string {
    switch (state.phase) {
      case 'failed':       return state.message;
      case 'list_failed':  return state.message;
      case 'delete_failed':return state.message;
      default:             return '';
    }
  }

  function formatEventTime(date: Date): string {
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    const mm = m.toString().padStart(2, '0');
    return `${hh}:${mm} ${ampm}`;
  }

  const listData =
    state.phase === 'list' ? state.events :
    state.phase === 'delete_confirm' ? state.events : [];
  const isDeleteConfirm = state.phase === 'delete_confirm';

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, anim]}>
      <View style={styles.header}>
        <Feather name="calendar" size={18} color={iconColor} />
        <Text style={[styles.title, { color: colors.cardForeground }]}>{headerText()}</Text>
      </View>

      {bodyText() ? (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{bodyText()}</Text>
      ) : null}

      {state.phase === 'created' && (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          {formatEventTime(state.event.startDate)} – {formatEventTime(state.event.endDate)}
        </Text>
      )}

      {listData.length > 0 && (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={isDeleteConfirm && onDeleteEvent ? () => onDeleteEvent(item) : undefined}
              style={({ pressed }) => [
                styles.eventRow,
                isDeleteConfirm && pressed && { opacity: 0.6 },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <View style={styles.eventInfo}>
                <Text style={[styles.eventTitle, { color: colors.cardForeground }]}>{item.title}</Text>
                <Text style={[styles.eventTime, { color: colors.mutedForeground }]}>
                  {formatEventTime(item.startDate)}
                </Text>
              </View>
              {isDeleteConfirm && (
                <Feather name="trash-2" size={14} color={colors.destructive} />
              )}
            </Pressable>
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
  divider: { height: 1, marginVertical: 4 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  eventTime:  { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
});
