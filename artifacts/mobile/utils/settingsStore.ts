/**
 * settingsStore.ts — Vedra Settings (v0.9)
 *
 * Persists all user-configurable settings to AsyncStorage.
 * API keys are stored under a separate key with a clear warning
 * that users should treat them as sensitive credentials.
 *
 * Never transmit settings or keys to any server automatically.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIProviderID = 'openai' | 'gemini';

export interface VedraSettings {
  // Cloud AI
  cloudAIEnabled: boolean;
  selectedProvider: AIProviderID;
  // Voice
  language: string;
  voiceSpeed: number;   // 0.5–2.0
  voicePitch: number;   // 0.5–2.0
  // Wake phrase (future)
  wakePhraseEnabled: boolean;
  wakePhrase: string;
  // Privacy
  saveConversationHistory: boolean;
  // Meta
  updatedAt: number;
}

const DEFAULTS: VedraSettings = {
  cloudAIEnabled: false,
  selectedProvider: 'openai',
  language: 'en-US',
  voiceSpeed: 1.0,
  voicePitch: 1.0,
  wakePhraseEnabled: false,
  wakePhrase: 'Hey Vedra',
  saveConversationHistory: true,
  updatedAt: 0,
};

const K = {
  SETTINGS:  '@vedra/settings_v9',
  API_KEYS:  '@vedra/api_keys_v9',   // { openai?: string; gemini?: string }
};

// ─── Settings ─────────────────────────────────────────────────────────────────

let _cache: VedraSettings | null = null;

export async function getSettings(): Promise<VedraSettings> {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(K.SETTINGS);
    _cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    return _cache;
  } catch {
    return { ...DEFAULTS };
  }
}

export async function updateSettings(patch: Partial<VedraSettings>): Promise<void> {
  const current = await getSettings();
  _cache = { ...current, ...patch, updatedAt: Date.now() };
  await AsyncStorage.setItem(K.SETTINGS, JSON.stringify(_cache));
}

export function invalidateSettingsCache(): void {
  _cache = null;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

interface ApiKeys {
  openai?: string;
  gemini?: string;
}

let _keyCache: ApiKeys | null = null;

async function _loadKeys(): Promise<ApiKeys> {
  if (_keyCache) return _keyCache;
  try {
    const raw = await AsyncStorage.getItem(K.API_KEYS);
    _keyCache = raw ? JSON.parse(raw) : {};
    return _keyCache!;
  } catch {
    return {};
  }
}

export async function getApiKey(provider: AIProviderID): Promise<string | undefined> {
  const keys = await _loadKeys();
  return keys[provider];
}

export async function setApiKey(provider: AIProviderID, key: string): Promise<void> {
  const keys = await _loadKeys();
  keys[provider] = key.trim();
  _keyCache = keys;
  await AsyncStorage.setItem(K.API_KEYS, JSON.stringify(keys));
}

export async function clearApiKey(provider: AIProviderID): Promise<void> {
  const keys = await _loadKeys();
  delete keys[provider];
  _keyCache = keys;
  await AsyncStorage.setItem(K.API_KEYS, JSON.stringify(keys));
}

export async function clearAllApiKeys(): Promise<void> {
  _keyCache = {};
  await AsyncStorage.removeItem(K.API_KEYS);
}

export async function hasApiKey(provider: AIProviderID): Promise<boolean> {
  const key = await getApiKey(provider);
  return !!key && key.length > 10;
}
