/**
 * PluginFeedback.tsx — Vedra Plugin Result Card (v1.0)
 *
 * Displays the structured result from any plugin.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import type { PluginResult } from '@/utils/plugins/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PluginFeedbackState {
  phase: 'none' | 'result' | 'error';
  result?: PluginResult;
  pluginName?: string;
}

interface Props {
  state: PluginFeedbackState;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PluginFeedback({ state }: Props) {
  const colors = useThemeColors();

  if (state.phase === 'none') return null;

  const { result, pluginName } = state;
  const panelData = result?.panelData;

  const borderColor =
    state.phase === 'error' || result?.success === false
      ? colors.destructive
      : colors.accent;

  const iconColor =
    state.phase === 'error' || result?.success === false
      ? colors.destructive
      : colors.success;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor }]}>
      {/* Plugin name badge */}
      {pluginName && (
        <View style={[styles.badge, { backgroundColor: `${colors.primary}22` }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>
            {pluginName.toUpperCase()}
          </Text>
        </View>
      )}

      {/* Panel title */}
      {panelData && (
        <Text style={[styles.title, { color: colors.foreground }]}>
          {panelData.title}
        </Text>
      )}

      {/* Panel subtitle */}
      {panelData?.subtitle && (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {panelData.subtitle}
        </Text>
      )}

      {/* Items */}
      {panelData?.items?.map((item, i) => (
        <View
          key={i}
          style={[
            styles.item,
            { borderTopColor: colors.border },
            i === 0 && styles.itemFirst,
          ]}
        >
          <Text style={[styles.itemLabel, { color: colors.mutedForeground }]}>
            {item.label}
          </Text>
          <Text
            style={[
              styles.itemValue,
              { color: item.highlight ? colors.accent : colors.foreground },
              item.highlight && styles.itemHighlight,
            ]}
          >
            {item.value}
          </Text>
        </View>
      ))}

      {/* Badge for overflow */}
      {panelData?.badge && (
        <Text style={[styles.overflowBadge, { color: colors.mutedForeground }]}>
          {panelData.badge}
        </Text>
      )}

      {/* Error message */}
      {(state.phase === 'error' || result?.success === false) && result?.error && (
        <View style={[styles.errorRow, { backgroundColor: `${colors.destructive}18` }]}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            ⚠ {result.error}
          </Text>
        </View>
      )}

      {/* Response text (shown when no panel data) */}
      {!panelData && result?.response && (
        <Text style={[styles.responseText, { color: colors.foreground }]}>
          {result.response}
        </Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },

  badge: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
  },

  title: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  itemFirst: {
    borderTopWidth: 0,
  },
  itemLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  itemValue: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    flex: 2,
    textAlign: 'right',
  },
  itemHighlight: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },

  overflowBadge: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 8,
  },

  errorRow: {
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },

  responseText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
