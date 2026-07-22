/**
 * privacyManager.ts — Vedra Privacy Manager (v0.9)
 *
 * Gives users full control over locally stored data.
 * Nothing is ever uploaded automatically.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearConversationHistory, getConversationHistory } from './conversationManager';
import { clearAllApiKeys } from './settingsStore';

// ─── Storage keys we own ───────────────────────────────────────────────────────
const ALL_KEYS = [
  '@vedra/user_profile',
  '@vedra/contacts',
  '@vedra/apps',
  '@vedra/recent_commands',
  '@vedra/settings_v9',
  '@vedra/api_keys_v9',
  '@vedra/conversation_v9',
  '@vedra/reminders',
];

// ─── Summary ─────────────────────────────────────────────────────────────────

export interface StorageSummary {
  conversationTurns: number;
  recentCommands: number;
  savedContacts: number;
  savedApps: number;
  hasUserProfile: boolean;
  hasApiKeys: boolean;
}

export async function getStorageSummary(): Promise<StorageSummary> {
  const [profile, contacts, apps, cmds, keys, conversation] = await Promise.all([
    AsyncStorage.getItem('@vedra/user_profile'),
    AsyncStorage.getItem('@vedra/contacts'),
    AsyncStorage.getItem('@vedra/apps'),
    AsyncStorage.getItem('@vedra/recent_commands'),
    AsyncStorage.getItem('@vedra/api_keys_v9'),
    getConversationHistory(),
  ]);

  const parse = (raw: string | null): any[] => {
    try { return raw ? JSON.parse(raw) : []; } catch { return []; }
  };

  const keyObj = keys ? (() => { try { return JSON.parse(keys); } catch { return {}; } })() : {};

  return {
    conversationTurns: conversation.length,
    recentCommands:    parse(cmds).length,
    savedContacts:     parse(contacts).length,
    savedApps:         parse(apps).length,
    hasUserProfile:    !!profile,
    hasApiKeys:        Object.keys(keyObj).some(k => !!keyObj[k]),
  };
}

// ─── Clear operations ─────────────────────────────────────────────────────────

export async function clearHistory(): Promise<void> {
  await clearConversationHistory();
}

export async function clearMemory(): Promise<void> {
  await AsyncStorage.multiRemove([
    '@vedra/user_profile',
    '@vedra/contacts',
    '@vedra/apps',
    '@vedra/recent_commands',
  ]);
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    clearHistory(),
    clearMemory(),
    clearAllApiKeys(),
    AsyncStorage.multiRemove(ALL_KEYS),
  ]);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportedData {
  exportedAt: string;
  version: '0.9';
  conversationHistory: Awaited<ReturnType<typeof getConversationHistory>>;
  userProfile: object | null;
  contacts: object[];
  apps: object[];
  recentCommands: object[];
  settings: object | null;
}

export async function exportData(): Promise<ExportedData> {
  const [profile, contacts, apps, cmds, settings] = await Promise.all([
    AsyncStorage.getItem('@vedra/user_profile'),
    AsyncStorage.getItem('@vedra/contacts'),
    AsyncStorage.getItem('@vedra/apps'),
    AsyncStorage.getItem('@vedra/recent_commands'),
    AsyncStorage.getItem('@vedra/settings_v9'),
  ]);

  const parse = (raw: string | null, fallback: any = null) => {
    try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  };

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    conversationHistory: await getConversationHistory(),
    userProfile:    parse(profile),
    contacts:       parse(contacts, []),
    apps:           parse(apps, []),
    recentCommands: parse(cmds, []),
    settings:       parse(settings),
  };
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importData(data: ExportedData): Promise<{ success: boolean; error?: string }> {
  try {
    const pairs: [string, string][] = [];

    if (data.userProfile)
      pairs.push(['@vedra/user_profile', JSON.stringify(data.userProfile)]);
    if (data.contacts?.length)
      pairs.push(['@vedra/contacts', JSON.stringify(data.contacts)]);
    if (data.apps?.length)
      pairs.push(['@vedra/apps', JSON.stringify(data.apps)]);
    if (data.recentCommands?.length)
      pairs.push(['@vedra/recent_commands', JSON.stringify(data.recentCommands)]);
    if (data.conversationHistory?.length)
      pairs.push(['@vedra/conversation_v9', JSON.stringify(data.conversationHistory)]);
    if (data.settings)
      pairs.push(['@vedra/settings_v9', JSON.stringify(data.settings)]);

    if (pairs.length) await AsyncStorage.multiSet(pairs);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Import failed' };
  }
}
