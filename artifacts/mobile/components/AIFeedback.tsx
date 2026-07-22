/**
 * AIFeedback.tsx — Displays the AI's response with source badge (v0.9)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import AISourceBadge, { type AISource } from './AISourceBadge';

export interface AIFeedbackState {
  phase: 'none' | 'thinking' | 'response' | 'error' | 'offline_fallback';
  response?: string;
  source?: AISource;
  providerName?: string;
}

interface Props { state: AIFeedbackState }

export default function AIFeedback({ state }: Props) {
  const colors = useColors();
  if (state.phase === 'none') return null;

  const isThinking = state.phase === 'thinking';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        {state.source && !isThinking ? (
          <AISourceBadge source={state.source} providerName={state.providerName} />
        ) : (
          <View style={[styles.thinkingBadge, { borderColor: colors.border }]}>
            <Text style={[styles.thinkingText, { color: colors.mutedForeground }]}>
              {isThinking ? 'Thinking…' : 'Vedra'}
            </Text>
          </View>
        )}
      </View>

      {state.response ? (
        <Text style={[styles.responseText, { color: colors.foreground }]}>
          {state.response}
        </Text>
      ) : isThinking ? (
        <View style={styles.dots}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, marginTop: 12, gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  thinkingBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  thinkingText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  responseText: {
    fontSize: 15, fontFamily: 'Inter_400Regular',
    lineHeight: 24,
  },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
