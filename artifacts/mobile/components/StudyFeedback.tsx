/**
 * StudyFeedback.tsx — Vedra v0.8 Study Assistant
 *
 * Shows results for study-related commands:
 *  - Study timer started
 *  - Today's study reminders
 *  - Study checklist
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { StudyReminder, ChecklistItem } from '@/utils/studyAssistant';

export type StudyFeedbackState =
  | { phase: 'none' }
  | { phase: 'timer_started'; minutes: number }
  | { phase: 'reminders'; reminders: StudyReminder[] }
  | { phase: 'checklist'; items: ChecklistItem[]; generated: boolean }
  | { phase: 'no_study_data' };

interface Props {
  state: StudyFeedbackState;
  onToggleItem?: (id: string) => void;
}

export default function StudyFeedback({ state, onToggleItem }: Props) {
  const colors = useColors();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  const visible = state.phase !== 'none';

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(16, { duration: 200 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));
  if (!visible) return null;

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, animStyle]}>
      <View style={styles.header}>
        <Feather name="book-open" size={14} color={colors.accent} />
        <Text style={[styles.headerText, { color: colors.accent }]}>STUDY ASSISTANT</Text>
      </View>

      {state.phase === 'timer_started' && (
        <View style={styles.section}>
          <Feather name="clock" size={24} color={colors.listeningRing} />
          <Text style={[styles.bigText, { color: colors.foreground }]}>{state.minutes} min focus session</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Stay focused. You've got this! 💪</Text>
        </View>
      )}

      {state.phase === 'reminders' && (
        <View>
          {state.reminders.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No study reminders for today.</Text>
          ) : (
            state.reminders.map(r => (
              <View key={r.id} style={[styles.reminderItem, { borderColor: colors.border }]}>
                <Feather name="bell" size={12} color={colors.accent} />
                <View style={styles.reminderText}>
                  <Text style={[styles.reminderMsg, { color: colors.foreground }]}>{r.message}</Text>
                  <Text style={[styles.reminderTime, { color: colors.mutedForeground }]}>{r.timeDisplay}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {state.phase === 'checklist' && (
        <View>
          {state.generated && (
            <Text style={[styles.generated, { color: colors.mutedForeground }]}>
              Generated from your study reminders
            </Text>
          )}
          {state.items.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              No checklist items yet. Add study reminders to auto-generate.
            </Text>
          ) : (
            state.items.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.checkItem}
                onPress={() => onToggleItem?.(item.id)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: item.done ? colors.listeningRing : colors.border },
                  item.done && { backgroundColor: colors.listeningRing },
                ]}>
                  {item.done && <Feather name="check" size={10} color="#000" />}
                </View>
                <Text style={[
                  styles.checkText,
                  { color: item.done ? colors.mutedForeground : colors.foreground },
                  item.done && styles.strikethrough,
                ]}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {state.phase === 'no_study_data' && (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          No study data yet. Try "Remind me to revise Chemistry at 7 PM".
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  section: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  bigText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  empty: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  generated: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 10, fontStyle: 'italic' },
  reminderItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
  reminderText: { flex: 1 },
  reminderMsg: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  reminderTime: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.5 },
});
