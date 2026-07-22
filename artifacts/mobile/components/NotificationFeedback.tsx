/**
 * NotificationFeedback.tsx — Vedra v0.7
 *
 * Feedback card for notification reading commands.
 * Shows permission guidance + any available notification items.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { NotificationItem } from '@/utils/notificationReader';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationFeedbackState =
  | { phase: 'none' }
  | { phase: 'reading';       transcript: string }
  | { phase: 'permission';    transcript: string; message: string; items?: NotificationItem[] }
  | { phase: 'items';         transcript: string; items: NotificationItem[] }
  | { phase: 'failed';        transcript: string; message: string };

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

function NotifItem({ item }: { item: NotificationItem }) {
  const colors = useColors();
  const ts = new Date(item.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  return (
    <View style={[styles.notifItem, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <View style={styles.notifHeader}>
        <Text style={[styles.notifApp,  { color: colors.accent }]}>{item.appName}</Text>
        <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>{ts}</Text>
      </View>
      <Text style={[styles.notifTitle, { color: colors.foreground }]}>{item.title}</Text>
      {!!item.body && (
        <Text style={[styles.notifBody, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.body}
        </Text>
      )}
    </View>
  );
}

// ── Status content ────────────────────────────────────────────────────────────

function StatusContent({ state }: { state: NotificationFeedbackState }) {
  const colors = useColors();

  if (state.phase === 'none') return null;

  if (state.phase === 'reading') {
    return (
      <Row icon="bell" label="STATUS" value={
        <Text style={[styles.rowValue, { color: colors.processingRing }]}>Reading notifications…</Text>
      } />
    );
  }

  if (state.phase === 'permission') {
    return (
      <>
        <Row icon="lock" label="PERMISSION NEEDED" value={
          <View style={styles.statusRow}>
            <Feather name="alert-circle" size={16} color={colors.processingRing} />
            <Text style={[styles.rowValue, { color: colors.processingRing, flex: 1 }]}>
              {state.message}
            </Text>
          </View>
        } />
        {state.items && state.items.length > 0 && (
          <>
            <Divider />
            {state.items.map(item => <NotifItem key={item.id} item={item} />)}
          </>
        )}
      </>
    );
  }

  if (state.phase === 'items') {
    return (
      <>
        <Row icon="bell" label={`${state.items.length} NOTIFICATION${state.items.length !== 1 ? 'S' : ''}`}
          value={<View />} />
        {state.items.map(item => <NotifItem key={item.id} item={item} />)}
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

export default function NotificationFeedback({ state }: { state: NotificationFeedbackState }) {
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
  const transcript = (state as any).transcript ?? '';

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, animStyle]}>
      <Row icon="message-circle" label="YOU SAID" value={`"${transcript}"`} />
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
  notifItem: {
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 14, gap: 4,
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifApp:  { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  notifTime: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  notifTitle:{ fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  notifBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
