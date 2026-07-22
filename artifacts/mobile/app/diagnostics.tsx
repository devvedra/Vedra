/**
 * diagnostics.tsx — Vedra Diagnostics Screen (v1.0)
 *
 * Shows system health: microphone, permissions, AI providers, battery
 * optimisation, error log. Users can run a self-check at any time.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';
import { useThemeColors } from '@/contexts/ThemeContext';
import { getSettings, hasApiKey, type VedraSettings } from '@/utils/settingsStore';
import { getRecentErrors, clearErrorLog, type VedraError } from '@/utils/errorLogger';
import { PluginManager } from '@/utils/plugins/pluginManager';
import { listProviders } from '@/utils/ai/aiRouter';

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStatus = 'ok' | 'warning' | 'error' | 'unknown' | 'checking';

interface DiagItem {
  id: string;
  label: string;
  value: string;
  status: CheckStatus;
  detail?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: CheckStatus, colors: ReturnType<typeof useThemeColors>): string {
  switch (status) {
    case 'ok':       return colors.success;
    case 'warning':  return colors.warning;
    case 'error':    return colors.destructive;
    case 'checking': return colors.accent;
    default:         return colors.mutedForeground;
  }
}

function statusIcon(status: CheckStatus): string {
  switch (status) {
    case 'ok':       return '✓';
    case 'warning':  return '⚠';
    case 'error':    return '✗';
    case 'checking': return '…';
    default:         return '?';
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function DiagRow({ item, isLast }: { item: DiagItem; isLast: boolean }) {
  const colors = useThemeColors();
  const color  = statusColor(item.status, colors);
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }, isLast && styles.rowLast]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{item.label}</Text>
        {item.detail && (
          <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>{item.detail}</Text>
        )}
      </View>
      <View style={[styles.statusBadge, { borderColor: color }]}>
        <Text style={[styles.statusIcon, { color }]}>{statusIcon(item.status)}</Text>
        <Text style={[styles.statusText, { color }]}>{item.value}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const [items,      setItems]      = useState<DiagItem[]>([]);
  const [errors,     setErrors]     = useState<VedraError[]>([]);
  const [checking,   setChecking]   = useState(false);
  const [lastRun,    setLastRun]    = useState<string>('Never');

  const runChecks = useCallback(async () => {
    setChecking(true);
    const results: DiagItem[] = [];

    // ── Microphone ──────────────────────────────────────────────────────────
    let micStatus: CheckStatus = 'unknown';
    let micValue  = 'Unknown';
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        micStatus = granted ? 'ok' : 'warning';
        micValue  = granted ? 'Granted' : 'Not granted';
      } catch {
        micStatus = 'unknown';
        micValue  = 'Check failed';
      }
    } else if (Platform.OS === 'web') {
      micStatus = 'warning';
      micValue  = 'Web (limited)';
    }
    results.push({
      id: 'mic',
      label: 'Microphone',
      value: micValue,
      status: micStatus,
      detail: 'Required for voice recognition',
    });

    // ── Notifications ──────────────────────────────────────────────────────
    let notifStatus: CheckStatus = 'unknown';
    let notifValue  = 'Unknown';
    try {
      const { status } = await Notifications.getPermissionsAsync();
      notifStatus = status === 'granted' ? 'ok' : status === 'undetermined' ? 'warning' : 'error';
      notifValue  = status === 'granted' ? 'Granted' : status === 'undetermined' ? 'Not asked' : 'Denied';
    } catch {
      notifStatus = 'unknown';
      notifValue  = 'Check failed';
    }
    results.push({
      id: 'notifications',
      label: 'Notifications',
      value: notifValue,
      status: notifStatus,
      detail: 'Required for reminders',
    });

    // ── Battery optimisation ────────────────────────────────────────────────
    let battStatus: CheckStatus = 'unknown';
    let battValue  = 'Unknown';
    try {
      const level = await Battery.getBatteryLevelAsync();
      const charging = await Battery.getBatteryStateAsync();
      const pct = Math.round(level * 100);
      battValue  = `${pct}%${charging === Battery.BatteryState.CHARGING ? ' · Charging' : ''}`;
      battStatus = pct > 20 ? 'ok' : pct > 10 ? 'warning' : 'error';
    } catch {
      battStatus = 'unknown';
      battValue  = 'Check failed';
    }
    results.push({
      id: 'battery',
      label: 'Battery',
      value: battValue,
      status: battStatus,
    });

    // ── Settings ────────────────────────────────────────────────────────────
    let settings: VedraSettings | null = null;
    try {
      settings = await getSettings();
    } catch {}

    results.push({
      id: 'offline_mode',
      label: 'Offline-First Mode',
      value: settings?.offlineFirst !== false ? 'Enabled' : 'Disabled',
      status: 'ok',
      detail: 'Commands work without internet',
    });

    // ── AI Providers ────────────────────────────────────────────────────────
    const providers = listProviders();
    for (const p of providers) {
      const configured = await hasApiKey(p.id as any);
      const isSelected = settings?.selectedProvider === p.id;
      const active = settings?.cloudAIEnabled && isSelected;

      results.push({
        id: `ai_${p.id}`,
        label: `AI: ${p.displayName}`,
        value: !configured ? 'No API key' : active ? 'Active' : 'Configured',
        status: !configured ? 'warning' : active ? 'ok' : 'ok',
        detail: isSelected ? 'Selected provider' : undefined,
      });
    }

    // ── Plugin system ───────────────────────────────────────────────────────
    const plugins = PluginManager.listPlugins();
    results.push({
      id: 'plugins',
      label: 'Plugin System',
      value: `${plugins.length} plugin${plugins.length === 1 ? '' : 's'} loaded`,
      status: plugins.length > 0 ? 'ok' : 'warning',
      detail: plugins.map(p => p.name).join(', ') || 'None',
    });

    // ── Platform ────────────────────────────────────────────────────────────
    results.push({
      id: 'platform',
      label: 'Platform',
      value: Platform.OS === 'android'
        ? `Android ${Platform.Version}`
        : Platform.OS === 'ios'
          ? `iOS ${Platform.Version}`
          : 'Web (limited features)',
      status: Platform.OS === 'android' ? 'ok' : 'warning',
      detail: Platform.OS !== 'android'
        ? 'Full features require Android APK build'
        : undefined,
    });

    // Load recent errors
    const recentErrs = await getRecentErrors(10);

    setItems(results);
    setErrors(recentErrs);
    setLastRun(new Date().toLocaleTimeString());
    setChecking(false);
  }, []);

  useEffect(() => {
    runChecks();
  }, []);

  const handleClearErrors = useCallback(() => {
    Alert.alert('Clear Error Log?', 'This will delete all logged errors.', [
      { text: 'Cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await clearErrorLog();
        setErrors([]);
      }},
    ]);
  }, []);

  // Group items
  const systemItems = items.filter(i => ['mic', 'notifications', 'battery', 'platform'].includes(i.id));
  const aiItems     = items.filter(i => i.id.startsWith('ai_') || i.id === 'offline_mode');
  const pluginItems = items.filter(i => i.id === 'plugins');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + 16,
        borderBottomColor: colors.border,
      }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.foreground }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Diagnostics</Text>
        <TouchableOpacity
          onPress={runChecks}
          disabled={checking}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Text style={[styles.runBtn, { color: checking ? colors.mutedForeground : colors.accent }]}>
            {checking ? '…' : 'Run'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Last run */}
        <Text style={[styles.lastRun, { color: colors.mutedForeground }]}>
          Last check: {lastRun}
        </Text>

        {/* System checks */}
        {systemItems.length > 0 && (
          <Section title="System">
            {systemItems.map((item, i) => (
              <DiagRow key={item.id} item={item} isLast={i === systemItems.length - 1} />
            ))}
          </Section>
        )}

        {/* AI & settings */}
        {aiItems.length > 0 && (
          <Section title="AI & Connectivity">
            {aiItems.map((item, i) => (
              <DiagRow key={item.id} item={item} isLast={i === aiItems.length - 1} />
            ))}
          </Section>
        )}

        {/* Plugins */}
        {pluginItems.length > 0 && (
          <Section title="Plugin System">
            {pluginItems.map((item, i) => (
              <DiagRow key={item.id} item={item} isLast={i === pluginItems.length - 1} />
            ))}
          </Section>
        )}

        {/* Error log */}
        <Section title={`Error Log (${errors.length})`}>
          {errors.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: colors.success }]}>
                ✓ No errors logged
              </Text>
            </View>
          ) : (
            <>
              {errors.slice(0, 5).map((err, i) => (
                <View
                  key={err.id}
                  style={[
                    styles.errorRow,
                    { borderBottomColor: colors.border },
                    i === Math.min(errors.length, 5) - 1 && styles.rowLast,
                  ]}
                >
                  <View style={styles.errorHeader}>
                    <Text style={[styles.errorModule, {
                      color: err.severity === 'error' || err.severity === 'critical'
                        ? colors.destructive
                        : colors.warning,
                    }]}>
                      [{err.severity.toUpperCase()}] {err.module}
                    </Text>
                    <Text style={[styles.errorTime, { color: colors.mutedForeground }]}>
                      {new Date(err.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={[styles.errorMsg, { color: colors.foreground }]} numberOfLines={2}>
                    {err.message}
                  </Text>
                </View>
              ))}
              {errors.length > 5 && (
                <View style={styles.emptyRow}>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    +{errors.length - 5} more errors
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.clearBtn, { borderTopColor: colors.border }]}
                onPress={handleClearErrors}
              >
                <Text style={[styles.clearBtnText, { color: colors.destructive }]}>
                  Clear Error Log
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Section>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          Vedra v1.0 · Diagnostics
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:  { width: 60 },
  backText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  title:    { fontSize: 17, fontFamily: 'Inter_700Bold' },
  runBtn:   { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },

  scroll:   {},
  content:  { paddingTop: 12, paddingHorizontal: 16, gap: 4 },

  lastRun: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },

  section:      { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 8, marginLeft: 4,
  },
  card: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft:  { flex: 1 },
  rowLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  rowDetail:{ fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12, borderWidth: 1,
  },
  statusIcon: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  statusText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  emptyRow: {
    paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center',
  },
  emptyText: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  errorRow: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  errorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  errorModule: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  errorTime:   { fontSize: 11, fontFamily: 'Inter_400Regular' },
  errorMsg:    { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  clearBtn: {
    paddingVertical: 12, alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  clearBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  version: {
    textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8,
  },
});
