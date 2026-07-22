/**
 * QuickActionFeedback.tsx — Vedra v0.7
 *
 * Feedback card for system quick-action commands:
 * recent apps, go home, notifications, quick settings, app info, settings shortcuts.
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

export type QuickActionFeedbackState =
  | { phase: 'none' }
  | { phase: 'working';  transcript: string; actionLabel: string }
  | { phase: 'success';  transcript: string; actionLabel: string; detail: string }
  | { phase: 'settings'; transcript: string; actionLabel: string; detail: string }
  | { phase: 'failed';   transcript: string; actionLabel: string; detail: string };

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Feather name={icon as any} size={12} color={colors.accent} />
        <Text style={[styles.rowLabel, { color: colors.accent }]}>{label}</Text>
      </View>
      {typeof value === 'string'
        ? <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
        : value}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── Status content ────────────────────────────────────────────────────────────

function StatusContent({ state }: { state: QuickActionFeedbackState }) {
  const colors = useColors();
  if (state.phase === 'none') return null;

  if (state.phase === 'working') {
    return (
      <Row icon="zap" label="STATUS" value={
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={colors.processingRing} />
          <Text style={[styles.rowValue, { color: colors.processingRing }]}>Executing…</Text>
        </View>
      } />
    );
  }

  if (state.phase === 'success') {
    return (
      <>
        <Row icon="zap" label="ACTION" value={state.detail} />
        <Divider />
        <Row icon="check-circle" label="STATUS" value={
          <View style={styles.statusRow}>
            <Feather name="check-circle" size={16} color={colors.listeningRing} />
            <Text style={[styles.rowValue, { color: colors.listeningRing }]}>Done</Text>
          </View>
        } />
      </>
    );
  }

  if (state.phase === 'settings') {
    return (
      <>
        <Row icon="settings" label="ACTION" value={state.detail} />
        <Divider />
        <Row icon="external-link" label="STATUS" value={
          <View style={styles.statusRow}>
            <Feather name="external-link" size={15} color={colors.processingRing} />
            <Text style={[styles.rowValue, { color: colors.processingRing }]}>Settings opened</Text>
          </View>
        } />
      </>
    );
  }

  // failed
  return (
    <>
      <Row icon="slash" label="ACTION" value={state.actionLabel} />
      <Divider />
      <Row icon="alert-circle" label="STATUS" value={
        <View style={styles.statusRow}>
          <Feather name="x-circle" size={16} color={colors.destructive} />
          <Text style={[styles.rowValue, { color: colors.destructive, flex: 1 }]}>{state.detail}</Text>
        </View>
      } />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuickActionFeedback({ state }: { state: QuickActionFeedbackState }) {
  const colors     = useColors();
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(16);
  const visible    = state.phase !== 'none';

  useEffect(() => {
    if (visible) {
      opacity.value    = withTiming(1,  { duration: 320 });
      translateY.value = withSpring(0,  { damping: 18, stiffness: 200 });
    } else {
      opacity.value    = withTiming(0,  { duration: 200 });
      translateY.value = withTiming(16, { duration: 200 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;
  const transcript = (state as any).transcript  ?? '';
  const actionLabel= (state as any).actionLabel ?? '';

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, animStyle]}>
      <Row icon="message-circle" label="YOU SAID"    value={`"${transcript}"`} />
      <Divider />
      <Row icon="layout"         label="QUICK ACTION" value={actionLabel} />
      <Divider />
      <StatusContent state={state} />
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: '100%', borderRadius: 20, borderWidth: 1,
    paddingVertical: 18, paddingHorizontal: 20, gap: 12,
  },
  row:       { gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowLabel:  { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, textTransform: 'uppercase' },
  rowValue:  { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flex: 1 },
  divider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
});
