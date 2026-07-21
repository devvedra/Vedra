/**
 * IntentDisplay.tsx — Vedra v0.8
 *
 * Debug/transparency panel: shows detected intent, entities, and
 * whether pronouns were resolved from conversation context.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export interface IntentDisplayState {
  intent: string;
  confidence: number;          // 0–1
  entities: Record<string, string>;
  resolvedFrom?: string;       // pronoun that was resolved, e.g. "him" → "Rahul"
}

interface Props {
  state: IntentDisplayState | null;
}

export default function IntentDisplay({ state }: Props) {
  const colors = useColors();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(state ? 1 : 0, { duration: 250 });
  }, [state]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!state) return null;

  const confidencePct = Math.round(state.confidence * 100);
  const entityEntries = Object.entries(state.entities).filter(([, v]) => v && v.trim());

  return (
    <Animated.View style={[styles.card, { backgroundColor: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.22)' }, animStyle]}>
      <View style={styles.headerRow}>
        <Feather name="cpu" size={11} color={colors.accent} />
        <Text style={[styles.header, { color: colors.accent }]}>INTENT DETECTED</Text>
        <View style={[styles.badge, { backgroundColor: 'rgba(124,58,237,0.2)' }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>{confidencePct}%</Text>
        </View>
      </View>
      <Text style={[styles.intent, { color: colors.foreground }]}>{state.intent.replace(/_/g, ' ')}</Text>
      {entityEntries.length > 0 && (
        <View style={styles.entities}>
          {entityEntries.map(([k, v]) => (
            <View key={k} style={[styles.entityChip, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
              <Text style={[styles.entityKey, { color: colors.accent }]}>{k}: </Text>
              <Text style={[styles.entityVal, { color: colors.foreground }]}>{v}</Text>
            </View>
          ))}
        </View>
      )}
      {state.resolvedFrom && (
        <View style={styles.resolveRow}>
          <Feather name="link" size={10} color={colors.mutedForeground} />
          <Text style={[styles.resolveText, { color: colors.mutedForeground }]}>
            "{state.resolvedFrom}" resolved from context
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  header: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.3, flex: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  intent: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  entities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  entityChip: { flexDirection: 'row', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  entityKey: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  entityVal: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  resolveRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  resolveText: { fontSize: 10, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
});
