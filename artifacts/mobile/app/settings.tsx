/**
 * settings.tsx — Vedra AI & Privacy Settings (v0.9)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Platform, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import {
  getSettings, updateSettings, getApiKey, setApiKey, clearApiKey,
  type AIProviderID, type VedraSettings,
} from '@/utils/settingsStore';
import {
  getStorageSummary, clearHistory, clearMemory, clearAllData, exportData,
  type StorageSummary,
} from '@/utils/privacyManager';
import { listProviders } from '@/utils/ai/aiRouter';

// ─── Row components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
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
  label, sublabel, value, onToggle,
}: { label: string; sublabel?: string; value: boolean; onToggle: (v: boolean) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {sublabel && <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sublabel}</Text>}
      </View>
      <Switch value={value} onValueChange={onToggle} />
    </View>
  );
}

function ButtonRow({
  label, sublabel, onPress, destructive,
}: { label: string; sublabel?: string; onPress: () => void; destructive?: boolean }) {
  const colors = useColors();
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
      <Text style={[styles.chevron, { color: colors.mutedForeground }]}>›</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [settings, setSettings]   = useState<VedraSettings | null>(null);
  const [summary,  setSummary]    = useState<StorageSummary | null>(null);
  const [apiKeys,  setApiKeys]    = useState<Partial<Record<AIProviderID, string>>>({});
  const [showKey,  setShowKey]    = useState<Partial<Record<AIProviderID, boolean>>>({});
  const [saving,   setSaving]     = useState(false);

  const providers = listProviders();

  // Load settings + summary
  useEffect(() => {
    (async () => {
      const [s, sum] = await Promise.all([getSettings(), getStorageSummary()]);
      setSettings(s);
      setSummary(sum);
      // Load existing key placeholders (masked)
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
    setSaving(false);
  }, [settings]);

  const saveApiKey = useCallback(async (provider: AIProviderID) => {
    const key = apiKeys[provider]?.trim();
    if (!key) return;
    await setApiKey(provider, key);
    Alert.alert('Saved', `${provider.toUpperCase()} API key saved.`);
  }, [apiKeys]);

  const removeApiKey = useCallback(async (provider: AIProviderID) => {
    await clearApiKey(provider);
    setApiKeys(prev => { const n = { ...prev }; delete n[provider]; return n; });
    Alert.alert('Removed', `${provider.toUpperCase()} API key removed.`);
  }, []);

  const doExport = useCallback(async () => {
    const data = await exportData();
    const json = JSON.stringify(data, null, 2);
    Alert.alert(
      'Export Ready',
      `Your data has been exported (${json.length} chars).\n\nIn a production build this would save to a file or share sheet.`,
      [{ text: 'OK' }],
    );
  }, []);

  if (!settings) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Text style={[styles.loading, { color: colors.mutedForeground }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.foreground }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Cloud AI ─────────────────────────────────────────────────────── */}
        <Section title="Cloud AI">
          <ToggleRow
            label="Enable Cloud AI"
            sublabel="Routes unknown requests to an online AI provider"
            value={settings.cloudAIEnabled}
            onToggle={v => patch({ cloudAIEnabled: v })}
          />
          <ToggleRow
            label="Save Conversation History"
            sublabel="Store exchanges locally for context-aware replies"
            value={settings.saveConversationHistory}
            onToggle={v => patch({ saveConversationHistory: v })}
          />

          {/* Provider picker */}
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>AI Provider</Text>
            <View style={styles.providerRow}>
              {providers.map(p => {
                const active = settings.selectedProvider === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => patch({ selectedProvider: p.id as AIProviderID })}
                    style={[
                      styles.providerChip,
                      {
                        backgroundColor: active ? '#6366f1' : colors.background,
                        borderColor:     active ? '#6366f1' : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.providerChipText, { color: active ? '#fff' : colors.foreground }]}>
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
            Keys are stored only on this device. Never shared with anyone.
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
                    style={[styles.keyInput, { color: colors.foreground, borderColor: colors.border }]}
                    placeholder={hasKey ? '••••••••••••••••' : 'sk-… or AIza…'}
                    placeholderTextColor={colors.mutedForeground}
                    value={showKey[pid] ? apiKeys[pid] ?? '' : ''}
                    onChangeText={v => setApiKeys(prev => ({ ...prev, [pid]: v }))}
                    secureTextEntry={!showKey[pid]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.keyBtn, { backgroundColor: '#6366f1' }]}
                    onPress={() => saveApiKey(pid)}
                  >
                    <Text style={styles.keyBtnText}>Save</Text>
                  </TouchableOpacity>
                  {hasKey && (
                    <TouchableOpacity
                      style={[styles.keyBtn, { backgroundColor: '#ef4444' }]}
                      onPress={() => removeApiKey(pid)}
                    >
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
          <InfoRow label="Language" value={settings.language} />
          <InfoRow label="Speech Speed" value={`${settings.voiceSpeed.toFixed(1)}×`} />
          <InfoRow label="Pitch" value={`${settings.voicePitch.toFixed(1)}×`} />
          <View style={[styles.row, { borderBottomColor: 'transparent' }]}>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              Voice speed and pitch controls coming in v1.0.
            </Text>
          </View>
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

        {/* ── Privacy ───────────────────────────────────────────────────────── */}
        <Section title="Privacy & Data">
          {summary && (
            <>
              <InfoRow label="Conversation turns" value={String(summary.conversationTurns)} />
              <InfoRow label="Saved contacts"     value={String(summary.savedContacts)} />
              <InfoRow label="Saved apps"         value={String(summary.savedApps)} />
              <InfoRow label="Recent commands"    value={String(summary.recentCommands)} />
              <InfoRow label="API keys stored"    value={summary.hasApiKeys ? 'Yes (device only)' : 'None'} />
            </>
          )}
          <ButtonRow
            label="Clear Conversation History"
            sublabel="Remove all stored exchanges"
            onPress={async () => {
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
            onPress={async () => {
              Alert.alert('Clear Memory?', 'This removes Vedra\'s learned preferences.', [
                { text: 'Cancel' },
                { text: 'Clear', style: 'destructive', onPress: async () => {
                  await clearMemory();
                  setSummary(await getStorageSummary());
                }},
              ]);
            }}
          />
          <ButtonRow
            label="Export My Data"
            sublabel="Save all local data as JSON"
            onPress={doExport}
          />
          <ButtonRow
            label="Clear All Data"
            sublabel="Wipes everything including API keys"
            destructive
            onPress={() => {
              Alert.alert(
                'Clear Everything?',
                'This will erase all Vedra data including API keys. This cannot be undone.',
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

        {/* Version */}
        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          Vedra v0.9 · Offline-first AI Assistant
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
  backBtn:  { width: 60 },
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

  providerRow: { flexDirection: 'row', gap: 8 },
  providerChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  providerChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

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
  keyBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
  },
  keyBtnText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  version: {
    textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular',
    marginTop: 8,
  },
});
