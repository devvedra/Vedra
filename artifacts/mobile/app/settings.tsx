/**
 * settings.tsx — Vedra Settings (v1.0)
 *
 * Complete settings: appearance, cloud AI, voice controls,
 * privacy, backup/restore, and diagnostics navigation.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Platform, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';

import { useThemeColors } from '@/contexts/ThemeContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getSettings, updateSettings, getApiKey, setApiKey, clearApiKey,
  invalidateSettingsCache,
  type AIProviderID, type VedraSettings, type ThemeMode,
} from '@/utils/settingsStore';
import {
  getStorageSummary, clearHistory, clearMemory, clearAllData, exportData,
  importData,
  type StorageSummary,
} from '@/utils/privacyManager';
import { listProviders } from '@/utils/ai/aiRouter';
import {
  createBackup, listBackups, restoreBackup, deleteBackup,
  type BackupFileInfo,
} from '@/utils/backupManager';

// ─── Row components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function ToggleRow({
  label, sublabel, value, onToggle, disabled,
}: { label: string; sublabel?: string; value: boolean; onToggle: (v: boolean) => void; disabled?: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: disabled ? colors.mutedForeground : colors.foreground }]}>{label}</Text>
        {sublabel && <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sublabel}</Text>}
      </View>
      <Switch value={value} onValueChange={onToggle} disabled={disabled} />
    </View>
  );
}

function ButtonRow({
  label, sublabel, onPress, destructive, rightLabel,
}: { label: string; sublabel?: string; onPress: () => void; destructive?: boolean; rightLabel?: string }) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: destructive ? '#ef4444' : colors.foreground }]}>
          {label}
        </Text>
        {sublabel && <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sublabel}</Text>}
      </View>
      {rightLabel
        ? <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{rightLabel}</Text>
        : <Text style={[styles.chevron, { color: colors.mutedForeground }]}>›</Text>}
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
    </View>
  );
}

function SliderRow({
  label, sublabel, value, min, max, step, onValue, formatValue,
}: {
  label: string; sublabel?: string;
  value: number; min: number; max: number; step: number;
  onValue: (v: number) => void; formatValue: (v: number) => string;
}) {
  const colors = useThemeColors();
  const decrement = () => { const next = Math.max(min, Math.round((value - step) * 10) / 10); onValue(next); };
  const increment = () => { const next = Math.min(max, Math.round((value + step) * 10) / 10); onValue(next); };
  return (
    <View style={[styles.sliderRow, { borderBottomColor: colors.border }]}>
      <View style={styles.sliderHeader}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
          {sublabel && <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sublabel}</Text>}
        </View>
        <View style={styles.stepperRow}>
          <TouchableOpacity onPress={decrement} style={[styles.stepBtn, { borderColor: colors.border }]}>
            <Text style={[styles.stepBtnText, { color: colors.foreground }]}>−</Text>
          </TouchableOpacity>
          <Text style={[styles.sliderValue, { color: colors.accent }]}>{formatValue(value)}</Text>
          <TouchableOpacity onPress={increment} style={[styles.stepBtn, { borderColor: colors.border }]}>
            <Text style={[styles.stepBtnText, { color: colors.foreground }]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets  = useSafeAreaInsets();
  const colors  = useThemeColors();
  const { theme: activeTheme, setTheme } = useTheme();

  const [settings, setSettings]   = useState<VedraSettings | null>(null);
  const [summary,  setSummary]    = useState<StorageSummary | null>(null);
  const [apiKeys,  setApiKeys]    = useState<Partial<Record<AIProviderID, string>>>({});
  const [saving,   setSaving]     = useState(false);
  const [backups,  setBackups]    = useState<BackupFileInfo[]>([]);
  const [backingUp,setBackingUp]  = useState(false);

  const voicePreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const providers = listProviders();

  // Load settings + summary
  useEffect(() => {
    (async () => {
      const [s, sum, bups] = await Promise.all([
        getSettings(),
        getStorageSummary(),
        listBackups(),
      ]);
      setSettings(s);
      setSummary(sum);
      setBackups(bups);
      const keys: Partial<Record<AIProviderID, string>> = {};
      for (const p of providers) {
        const k = await getApiKey(p.id as AIProviderID);
        if (k) keys[p.id as AIProviderID] = k;
      }
      setApiKeys(keys);
    })();
  }, []);

  const patch = useCallback(async (changes: Partial<VedraSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...changes };
    setSettings(next);
    setSaving(true);
    await updateSettings(changes);
    invalidateSettingsCache();
    setSaving(false);
  }, [settings]);

  const saveApiKey = useCallback(async (provider: AIProviderID) => {
    const key = apiKeys[provider]?.trim();
    if (!key) return;
    await setApiKey(provider, key);
    Alert.alert('Saved', `${provider === 'openai' ? 'OpenAI' : 'Gemini'} API key saved.`);
  }, [apiKeys]);

  const removeApiKey = useCallback(async (provider: AIProviderID) => {
    await clearApiKey(provider);
    setApiKeys(prev => { const n = { ...prev }; delete n[provider]; return n; });
    Alert.alert('Removed', `${provider === 'openai' ? 'OpenAI' : 'Gemini'} API key removed.`);
  }, []);

  // Preview voice settings (debounced)
  const previewVoice = useCallback((speed: number, pitch: number) => {
    if (voicePreviewTimer.current) clearTimeout(voicePreviewTimer.current);
    voicePreviewTimer.current = setTimeout(() => {
      Speech.speak('Hello! This is how I sound.', {
        rate: speed,
        pitch,
        language: settings?.language ?? 'en-US',
      });
    }, 400);
  }, [settings?.language]);

  const handleSpeedChange = useCallback((v: number) => {
    const rounded = Math.round(v * 10) / 10;
    patch({ voiceSpeed: rounded });
    previewVoice(rounded, settings?.voicePitch ?? 1.0);
  }, [patch, previewVoice, settings?.voicePitch]);

  const handlePitchChange = useCallback((v: number) => {
    const rounded = Math.round(v * 10) / 10;
    patch({ voicePitch: rounded });
    previewVoice(settings?.voiceSpeed ?? 1.0, rounded);
  }, [patch, previewVoice, settings?.voiceSpeed]);

  const doExport = useCallback(async () => {
    const data = await exportData();
    const json = JSON.stringify(data, null, 2);
    Alert.alert(
      'Export Ready',
      `Data exported (${json.length.toLocaleString()} chars).\nIn a production build this saves to a file or share sheet.`,
      [{ text: 'OK' }],
    );
  }, []);

  const doBackup = useCallback(async () => {
    setBackingUp(true);
    const result = await createBackup();
    setBackingUp(false);
    if (result.success) {
      const updated = await listBackups();
      setBackups(updated);
      Alert.alert('Backup Created', `Saved to:\n${result.filePath ?? 'device storage'}`);
    } else {
      Alert.alert('Backup Failed', result.message);
    }
  }, []);

  const doRestore = useCallback(async (backup: BackupFileInfo) => {
    Alert.alert(
      'Restore Backup?',
      `This will replace current data with the backup from ${backup.name}.\n\nThis cannot be undone.`,
      [
        { text: 'Cancel' },
        { text: 'Restore', style: 'destructive', onPress: async () => {
          const result = await restoreBackup(backup.path);
          if (result.success) {
            invalidateSettingsCache();
            const [s, sum] = await Promise.all([getSettings(), getStorageSummary()]);
            setSettings(s);
            setSummary(sum);
            Alert.alert('Restored', result.message);
          } else {
            Alert.alert('Restore Failed', result.message);
          }
        }},
      ],
    );
  }, []);

  const doDeleteBackup = useCallback(async (backup: BackupFileInfo) => {
    Alert.alert('Delete Backup?', `Delete "${backup.name}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteBackup(backup.path);
        setBackups(await listBackups());
      }},
    ]);
  }, []);

  if (!settings) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Text style={[styles.loading, { color: colors.mutedForeground }]}>Loading…</Text>
      </View>
    );
  }

  const THEME_OPTIONS: Array<{ id: ThemeMode; label: string }> = [
    { id: 'dark',   label: 'Dark'   },
    { id: 'light',  label: 'Light'  },
    { id: 'system', label: 'System' },
  ];

  const LANGUAGE_OPTIONS = [
    { id: 'en-US', label: 'English (US)' },
    { id: 'en-GB', label: 'English (UK)' },
    { id: 'hi-IN', label: 'Hindi'        },
    { id: 'es-ES', label: 'Spanish'      },
    { id: 'fr-FR', label: 'French'       },
    { id: 'de-DE', label: 'German'       },
    { id: 'ja-JP', label: 'Japanese'     },
    { id: 'zh-CN', label: 'Chinese'      },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.navBtn}>
          <Text style={[styles.backText, { color: colors.foreground }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        <Section title="Appearance">
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Theme</Text>
            <View style={styles.chipRow}>
              {THEME_OPTIONS.map(opt => {
                const active = activeTheme === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setTheme(opt.id)}
                    style={[styles.chip, {
                      backgroundColor: active ? colors.primary : 'transparent',
                      borderColor:     active ? colors.primary : colors.border,
                    }]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#fff' : colors.foreground }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Section>

        {/* ── Core Behaviour ───────────────────────────────────────────────── */}
        <Section title="Behaviour">
          <ToggleRow
            label="Offline-First"
            sublabel="Prefer local commands over cloud AI"
            value={settings.offlineFirst ?? true}
            onToggle={v => patch({ offlineFirst: v })}
          />
          <ToggleRow
            label="Save Conversation History"
            sublabel="Store exchanges locally for context-aware replies"
            value={settings.saveConversationHistory}
            onToggle={v => patch({ saveConversationHistory: v })}
          />
        </Section>

        {/* ── Cloud AI ─────────────────────────────────────────────────────── */}
        <Section title="Cloud AI">
          <ToggleRow
            label="Enable Cloud AI"
            sublabel="Routes unknown requests to an online AI provider"
            value={settings.cloudAIEnabled}
            onToggle={v => patch({ cloudAIEnabled: v })}
          />

          {/* Provider picker */}
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Provider</Text>
            <View style={styles.chipRow}>
              {providers.map(p => {
                const active = settings.selectedProvider === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => patch({ selectedProvider: p.id as AIProviderID })}
                    style={[styles.chip, {
                      backgroundColor: active ? '#6366f1' : 'transparent',
                      borderColor:     active ? '#6366f1' : colors.border,
                    }]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#fff' : colors.foreground }]}>
                      {p.id === 'openai' ? 'OpenAI' : 'Gemini'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Section>

        {/* ── API Keys ─────────────────────────────────────────────────────── */}
        <Section title="API Keys">
          <Text style={[styles.keyNote, { color: colors.mutedForeground }]}>
            Keys are stored only on this device and never shared.
          </Text>
          {providers.map(p => {
            const pid = p.id as AIProviderID;
            const hasKey = !!apiKeys[pid] && apiKeys[pid]!.length > 10;
            return (
              <View key={pid} style={[styles.keyRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                  {pid === 'openai' ? 'OpenAI API Key' : 'Gemini API Key'}
                </Text>
                <View style={styles.keyInputRow}>
                  <TextInput
                    style={[styles.keyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                    placeholder={hasKey ? '••••••••••••••' : pid === 'openai' ? 'sk-…' : 'AIza…'}
                    placeholderTextColor={colors.mutedForeground}
                    value={apiKeys[pid] ?? ''}
                    onChangeText={v => setApiKeys(prev => ({ ...prev, [pid]: v }))}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity style={[styles.keyBtn, { backgroundColor: '#6366f1' }]} onPress={() => saveApiKey(pid)}>
                    <Text style={styles.keyBtnText}>Save</Text>
                  </TouchableOpacity>
                  {hasKey && (
                    <TouchableOpacity style={[styles.keyBtn, { backgroundColor: '#ef4444' }]} onPress={() => removeApiKey(pid)}>
                      <Text style={styles.keyBtnText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </Section>

        {/* ── Voice ────────────────────────────────────────────────────────── */}
        <Section title="Voice">
          {/* Language */}
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll}>
              <View style={styles.chipRow}>
                {LANGUAGE_OPTIONS.map(lang => {
                  const active = settings.language === lang.id;
                  return (
                    <TouchableOpacity
                      key={lang.id}
                      onPress={() => patch({ language: lang.id })}
                      style={[styles.chip, styles.chipSm, {
                        backgroundColor: active ? colors.primary : 'transparent',
                        borderColor:     active ? colors.primary : colors.border,
                      }]}
                    >
                      <Text style={[styles.chipText, styles.chipTextSm, { color: active ? '#fff' : colors.foreground }]}>
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Speed slider */}
          <SliderRow
            label="Speech Speed"
            sublabel="How fast Vedra speaks"
            value={settings.voiceSpeed}
            min={0.5} max={2.0} step={0.1}
            onValue={handleSpeedChange}
            formatValue={v => `${v.toFixed(1)}×`}
          />

          {/* Pitch slider */}
          <SliderRow
            label="Speech Pitch"
            sublabel="Tone of Vedra's voice"
            value={settings.voicePitch}
            min={0.5} max={2.0} step={0.1}
            onValue={handlePitchChange}
            formatValue={v => `${v.toFixed(1)}×`}
          />
        </Section>

        {/* ── Wake Phrase ───────────────────────────────────────────────────── */}
        <Section title="Wake Phrase (Future)">
          <ToggleRow
            label="Wake Phrase"
            sublabel='Trigger Vedra hands-free with a custom phrase'
            value={settings.wakePhraseEnabled}
            onToggle={v => patch({ wakePhraseEnabled: v })}
          />
          <InfoRow label="Phrase" value={settings.wakePhrase} />
        </Section>

        {/* ── Backup & Restore ─────────────────────────────────────────────── */}
        <Section title="Backup & Restore">
          <ButtonRow
            label={backingUp ? 'Creating Backup…' : 'Create Backup'}
            sublabel="Save all data locally as JSON"
            onPress={doBackup}
          />
          {backups.length === 0 ? (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>No backups yet</Text>
            </View>
          ) : (
            backups.slice(0, 3).map(b => (
              <View key={b.path} style={[styles.backupRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.backupName, { color: colors.foreground }]} numberOfLines={1}>
                  {b.name}
                </Text>
                {b.modificationTime && (
                  <Text style={[styles.backupDate, { color: colors.mutedForeground }]}>
                    {new Date(b.modificationTime * 1000).toLocaleDateString()}
                  </Text>
                )}
                <View style={styles.backupActions}>
                  <TouchableOpacity onPress={() => doRestore(b)} style={[styles.microBtn, { borderColor: colors.accent }]}>
                    <Text style={[styles.microBtnText, { color: colors.accent }]}>Restore</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => doDeleteBackup(b)} style={[styles.microBtn, { borderColor: colors.destructive }]}>
                    <Text style={[styles.microBtnText, { color: colors.destructive }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </Section>

        {/* ── Privacy & Data ────────────────────────────────────────────────── */}
        <Section title="Privacy & Data">
          {summary && (
            <>
              <InfoRow label="Conversation turns" value={String(summary.conversationTurns)} />
              <InfoRow label="Saved contacts"     value={String(summary.savedContacts)} />
              <InfoRow label="Recent commands"    value={String(summary.recentCommands)} />
              <InfoRow label="API keys stored"    value={summary.hasApiKeys ? 'Yes (device only)' : 'None'} />
            </>
          )}
          <ButtonRow
            label="Export My Data"
            sublabel="Save all local data as JSON"
            onPress={doExport}
          />
          <ButtonRow
            label="Clear Conversation History"
            sublabel="Remove all stored exchanges"
            onPress={() => {
              Alert.alert('Clear History?', 'This will remove all conversation history.', [
                { text: 'Cancel' },
                { text: 'Clear', style: 'destructive', onPress: async () => {
                  await clearHistory();
                  setSummary(await getStorageSummary());
                }},
              ]);
            }}
          />
          <ButtonRow
            label="Clear Memory"
            sublabel="Remove saved contacts, apps, and command history"
            onPress={() => {
              Alert.alert('Clear Memory?', 'This removes learned preferences.', [
                { text: 'Cancel' },
                { text: 'Clear', style: 'destructive', onPress: async () => {
                  await clearMemory();
                  setSummary(await getStorageSummary());
                }},
              ]);
            }}
          />
          <ButtonRow
            label="Clear All Data"
            sublabel="Wipes everything including API keys"
            destructive
            onPress={() => {
              Alert.alert(
                'Clear Everything?',
                'This will erase all Vedra data including API keys. Cannot be undone.',
                [
                  { text: 'Cancel' },
                  { text: 'Clear All', style: 'destructive', onPress: async () => {
                    await clearAllData();
                    setSummary(await getStorageSummary());
                    setApiKeys({});
                  }},
                ],
              );
            }}
          />
        </Section>

        {/* ── Diagnostics ───────────────────────────────────────────────────── */}
        <Section title="System">
          <ButtonRow
            label="Diagnostics"
            sublabel="Check microphone, permissions, AI status, and error log"
            onPress={() => router.push('/diagnostics')}
          />
          <ButtonRow
            label="About Vedra"
            sublabel="v1.0 · Offline-first AI Assistant"
            onPress={() => Alert.alert(
              'Vedra v1.0',
              'Offline-first Android AI assistant.\n\nBuilt with Expo + React Native.\n\nAll data stays on your device.',
              [{ text: 'OK' }],
            )}
          />
        </Section>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          Vedra v1.0 · Offline-first AI Assistant{saving ? ' · Saving…' : ''}
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading:   { textAlign: 'center', marginTop: 40, fontSize: 15 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn:   { width: 60 },
  backText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  title:    { fontSize: 17, fontFamily: 'Inter_700Bold' },

  scroll:   {},
  content:  { paddingTop: 16, paddingHorizontal: 16, gap: 4 },

  section:     { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText:  { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  rowSub:   { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  rowValue: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  chevron:  { fontSize: 20 },

  chipRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chipTextSm: { fontSize: 11 },

  langScroll: { flex: 1 },

  sliderRow: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sliderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderValue:  { fontSize: 15, fontFamily: 'Inter_700Bold', minWidth: 46, textAlign: 'center' },
  stepperRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, fontFamily: 'Inter_400Regular', lineHeight: 22 },

  keyNote: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  keyRow: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  keyInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  keyInput: {
    flex: 1, height: 38, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 10, fontSize: 13, fontFamily: 'Inter_400Regular',
  },
  keyBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  keyBtnText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  backupRow: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 4,
  },
  backupName:    { fontSize: 13, fontFamily: 'Inter_500Medium' },
  backupDate:    { fontSize: 11, fontFamily: 'Inter_400Regular' },
  backupActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  microBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1,
  },
  microBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  version: {
    textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8,
  },
});
