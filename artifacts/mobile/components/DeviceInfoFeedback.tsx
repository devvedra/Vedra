/**
 * DeviceInfoFeedback.tsx — Vedra v0.7
 *
 * Feedback card for device information queries:
 * storage, RAM, battery health, device model, Android version, date/time.
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

export type DeviceInfoFeedbackState =
  | { phase: 'none' }
  | { phase: 'loading';  transcript: string; queryLabel: string }
  | { phase: 'success';  transcript: string; queryLabel: string; message: string; info?: Record<string, string> }
  | { phase: 'failed';   transcript: string; queryLabel: string; message: string };

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

function InfoGrid({ info }: { info: Record<string, string> }) {
  const colors = useColors();
  const entries = Object.entries(info);
  return (
    <View style={styles.grid}>
      {entries.map(([key, val]) => (
        <View key={key} style={[styles.gridItem, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.gridKey, { color: colors.mutedForeground }]}>{key}</Text>
          <Text style={[styles.gridVal, { color: colors.foreground }]}>{val}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Status content ────────────────────────────────────────────────────────────

function StatusContent({ state }: { state: DeviceInfoFeedbackState }) {
  const colors = useColors();

  if (state.phase === 'none') return null;

  if (state.phase === 'loading') {
    return (
      <Row icon="cpu" label="STATUS" value={
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={colors.processingRing} />
          <Text style={[styles.rowValue, { color: colors.processingRing }]}>Reading…</Text>
        </View>
      } />
    );
  }

  if (state.phase === 'success') {
    return (
      <>
        {state.info && Object.keys(state.info).length > 0 && (
          <>
            <InfoGrid info={state.info} />
            <Divider />
          </>
        )}
        <Row icon="check-circle" label="STATUS" value={
          <View style={styles.statusRow}>
            <Feather name="check-circle" size={16} color={colors.listeningRing} />
            <Text style={[styles.rowValue, { color: colors.listeningRing }]}>Done</Text>
          </View>
        } />
      </>
    );
  }

  // failed
  return (
    <Row icon="alert-circle" label="STATUS" value={
      <View style={styles.statusRow}>
        <Feather name="x-circle" size={16} color={colors.destructive} />
        <Text style={[styles.rowValue, { color: colors.destructive }]}>{state.message}</Text>
      </View>
    } />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DeviceInfoFeedback({ state }: { state: DeviceInfoFeedbackState }) {
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
  const queryLabel = (state as any).queryLabel  ?? '';

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, animStyle]}>
      <Row icon="message-circle" label="YOU SAID" value={`"${transcript}"`} />
      <Divider />
      <Row icon="cpu" label="QUERY" value={queryLabel} />
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  divider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  gridItem: {
    borderRadius: 10, borderWidth: 1,
    paddingVertical: 8, paddingHorizontal: 12,
    minWidth: '44%', flex: 1,
  },
  gridKey: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  gridVal: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
