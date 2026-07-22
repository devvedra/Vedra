/**
 * ConversationHistory.tsx — Scrollable conversation log (v0.9)
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import AISourceBadge, { type AISource } from './AISourceBadge';
import { type ConversationTurn } from '@/utils/conversationManager';

interface Props {
  turns: ConversationTurn[];
  onClear?: () => void;
  maxVisible?: number;
}

export default function ConversationHistory({ turns, onClear, maxVisible = 10 }: Props) {
  const colors = useColors();
  if (turns.length === 0) return null;

  const visible = turns.slice(0, maxVisible);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.mutedForeground }]}>
          Conversation History
        </Text>
        {onClear && (
          <TouchableOpacity onPress={onClear} hitSlop={12}>
            <Text style={[styles.clearBtn, { color: '#ef4444' }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Turns */}
      {visible.map(turn => (
        <View key={turn.id} style={styles.turn}>
          {/* User bubble */}
          <View style={[styles.userBubble, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.userText, { color: colors.foreground }]}>{turn.userText}</Text>
          </View>

          {/* Assistant bubble */}
          <View style={styles.assistantRow}>
            <AISourceBadge
              source={(turn.source === 'online' ? 'online' : 'offline') as AISource}
              providerName={turn.providerName}
            />
            <Text style={[styles.assistantText, { color: colors.mutedForeground }]}>
              {turn.assistantText}
            </Text>
          </View>
        </View>
      ))}

      {turns.length > maxVisible && (
        <Text style={[styles.more, { color: colors.mutedForeground }]}>
          +{turns.length - maxVisible} earlier turns
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, marginTop: 12, gap: 12,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' },
  clearBtn: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  turn: { gap: 8 },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1,
  },
  userText: { fontSize: 14, fontFamily: 'Inter_400Regular' },

  assistantRow: { gap: 6 },
  assistantText: {
    fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20,
  },

  more: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
