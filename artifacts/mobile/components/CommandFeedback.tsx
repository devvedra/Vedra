/**
 * CommandFeedback
 *
 * Shows the user what happened after a voice command was processed.
 * Three rows are displayed inside a single animated card:
 *
 *   1. "You said"   — the raw transcript from the speech recogniser
 *   2. "Command"    — the detected app name, or "Not recognised" if no match
 *   3. "Status"     — Success ✓ or Failed ✗ with a brief explanation
 *
 * The card slides up and fades in when new content arrives, and fades out
 * when cleared. On the "launching" phase the status row shows a small spinner
 * instead of a final icon.
 *
 * ── Props ─────────────────────────────────────────────────────────────────────
 * Pass a `FeedbackState` object that is updated by the main screen as the
 * command moves through its lifecycle:
 *
 *   none        → card is hidden
 *   unrecognised → shows transcript + "No command detected"
 *   launching   → shows transcript + app name + spinner
 *   success     → shows transcript + app name + ✓
 *   failed      → shows transcript + app name + ✗ + message
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeedbackState =
  | { phase: 'none' }
  | { phase: 'unrecognized'; transcript: string }
  | { phase: 'launching'; transcript: string; appName: string }
  | { phase: 'success'; transcript: string; appName: string }
  | { phase: 'failed'; transcript: string; appName: string };

// ── Sub-components ────────────────────────────────────────────────────────────

/** A single labelled row inside the feedback card. */
function Row({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Feather name={icon as any} size={12} color={colors.accent} />
        <Text style={[styles.rowLabel, { color: colors.accent }]}>{label}</Text>
      </View>
      {typeof value === 'string' ? (
        <Text style={[styles.rowValue, { color: valueColor ?? colors.foreground }]}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/** Status row content — varies by phase. */
function StatusContent({ state }: { state: FeedbackState }) {
  const colors = useColors();

  if (state.phase === 'none' || state.phase === 'unrecognized') {
    return (
      <Row
        icon="info"
        label="COMMAND"
        value="No command detected"
        valueColor={colors.mutedForeground}
      />
    );
  }

  const statusRow =
    state.phase === 'launching' ? (
      <View style={styles.statusRow}>
        <ActivityIndicator size="small" color={colors.processingRing} />
        <Text style={[styles.rowValue, { color: colors.processingRing }]}>
          Launching…
        </Text>
      </View>
    ) : state.phase === 'success' ? (
      <View style={styles.statusRow}>
        <Feather name="check-circle" size={16} color={colors.listeningRing} />
        <Text style={[styles.rowValue, { color: colors.listeningRing }]}>
          Success
        </Text>
      </View>
    ) : (
      <View style={styles.statusRow}>
        <Feather name="x-circle" size={16} color={colors.destructive} />
        <Text style={[styles.rowValue, { color: colors.destructive }]}>
          Failed — app not found
        </Text>
      </View>
    );

  return (
    <>
      <Row icon="terminal" label="COMMAND" value={`Open ${state.appName}`} />
      <View style={styles.divider} />
      <Row icon="activity" label="STATUS" value={statusRow} />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CommandFeedbackProps {
  state: FeedbackState;
}

export default function CommandFeedback({ state }: CommandFeedbackProps) {
  const colors = useColors();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  const visible = state.phase !== 'none';

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 320 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(16, { duration: 200 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const transcript =
    state.phase !== 'none' ? state.transcript : '';

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        animStyle,
      ]}
    >
      {/* ── Row 1: What the user said ── */}
      <Row
        icon="message-circle"
        label="YOU SAID"
        value={`"${transcript}"`}
      />

      <View style={styles.divider} />

      {/* ── Row 2 & 3: Command + Status ── */}
      <StatusContent state={state} />
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },

  // ── Row ──
  row: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rowLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
