/**
 * AISourceBadge.tsx — Shows whether the last response came from Offline or Online AI.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type AISource = 'offline' | 'online' | 'error';

interface Props {
  source: AISource;
  providerName?: string;
}

export default function AISourceBadge({ source, providerName }: Props) {
  const colors = useColors();

  const label =
    source === 'online'
      ? `Online · ${providerName ?? 'AI'}`
      : source === 'error'
      ? 'AI Error'
      : 'Offline';

  const dotColor =
    source === 'online'  ? '#22c55e' :
    source === 'error'   ? '#ef4444' : '#6366f1';

  const borderColor =
    source === 'online'  ? '#16a34a33' :
    source === 'error'   ? '#ef444433' : '#6366f133';

  return (
    <View style={[styles.badge, { borderColor, backgroundColor: borderColor }]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.label, { color: dotColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start',
  },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
});
