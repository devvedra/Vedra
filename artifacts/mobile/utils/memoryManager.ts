/**
 * memoryManager.ts — Vedra Local Memory (v0.8)
 *
 * Stores all user data locally on device using AsyncStorage.
 * No data ever leaves the device.
 *
 * Stores:
 *  - User profile (preferred name, settings)
 *  - Favourite contacts (with usage frequency)
 *  - Frequent apps (with usage frequency)
 *  - Recent commands (last 50)
 *  - Reminder history
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  preferredName?: string;
  updatedAt: number;
}

export interface ContactMemory {
  displayName: string;        // e.g. "Rahul"
  phoneNumber: string;
  callCount: number;
  smsCount: number;
  lastUsed: number;           // epoch ms
}

export interface AppMemory {
  displayName: string;        // e.g. "WhatsApp"
  packageName?: string;
  openCount: number;
  lastUsed: number;
}

export interface CommandMemory {
  transcript: string;
  commandType: string;
  timestamp: number;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const K = {
  USER_PROFILE:    '@vedra/user_profile',
  CONTACTS:        '@vedra/contacts',
  APPS:            '@vedra/apps',
  RECENT_COMMANDS: '@vedra/recent_commands',
};

const MAX_COMMANDS = 50;

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(K.USER_PROFILE);
    return raw ? JSON.parse(raw) : { updatedAt: 0 };
  } catch {
    return { updatedAt: 0 };
  }
}

export async function setUserName(name: string): Promise<void> {
  const profile = await getUserProfile();
  await AsyncStorage.setItem(K.USER_PROFILE, JSON.stringify({
    ...profile,
    preferredName: name,
    updatedAt: Date.now(),
  }));
}

export async function getUserName(): Promise<string | undefined> {
  const profile = await getUserProfile();
  return profile.preferredName;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContactMemories(): Promise<ContactMemory[]> {
  try {
    const raw = await AsyncStorage.getItem(K.CONTACTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function recordContactUsage(
  displayName: string,
  phoneNumber: string,
  mode: 'call' | 'sms',
): Promise<void> {
  const contacts = await getContactMemories();
  const idx = contacts.findIndex(
    c => c.phoneNumber === phoneNumber || c.displayName.toLowerCase() === displayName.toLowerCase(),
  );
  if (idx >= 0) {
    if (mode === 'call') contacts[idx].callCount += 1;
    else contacts[idx].smsCount += 1;
    contacts[idx].lastUsed = Date.now();
  } else {
    contacts.push({
      displayName,
      phoneNumber,
      callCount: mode === 'call' ? 1 : 0,
      smsCount: mode === 'sms' ? 1 : 0,
      lastUsed: Date.now(),
    });
  }
  await AsyncStorage.setItem(K.CONTACTS, JSON.stringify(contacts));
}

export async function getFavouriteContacts(limit = 5): Promise<ContactMemory[]> {
  const contacts = await getContactMemories();
  return contacts
    .sort((a, b) => (b.callCount + b.smsCount) - (a.callCount + a.smsCount))
    .slice(0, limit);
}

// ─── Apps ─────────────────────────────────────────────────────────────────────

export async function getAppMemories(): Promise<AppMemory[]> {
  try {
    const raw = await AsyncStorage.getItem(K.APPS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function recordAppUsage(displayName: string, packageName?: string): Promise<void> {
  const apps = await getAppMemories();
  const idx = apps.findIndex(a => a.displayName.toLowerCase() === displayName.toLowerCase());
  if (idx >= 0) {
    apps[idx].openCount += 1;
    apps[idx].lastUsed = Date.now();
  } else {
    apps.push({ displayName, packageName, openCount: 1, lastUsed: Date.now() });
  }
  await AsyncStorage.setItem(K.APPS, JSON.stringify(apps));
}

export async function getFrequentApps(limit = 5): Promise<AppMemory[]> {
  const apps = await getAppMemories();
  return apps.sort((a, b) => b.openCount - a.openCount).slice(0, limit);
}

// ─── Recent Commands ──────────────────────────────────────────────────────────

export async function recordCommand(transcript: string, commandType: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(K.RECENT_COMMANDS);
    const cmds: CommandMemory[] = raw ? JSON.parse(raw) : [];
    cmds.unshift({ transcript, commandType, timestamp: Date.now() });
    if (cmds.length > MAX_COMMANDS) cmds.length = MAX_COMMANDS;
    await AsyncStorage.setItem(K.RECENT_COMMANDS, JSON.stringify(cmds));
  } catch {}
}

export async function getRecentCommands(limit = 10): Promise<CommandMemory[]> {
  try {
    const raw = await AsyncStorage.getItem(K.RECENT_COMMANDS);
    const cmds: CommandMemory[] = raw ? JSON.parse(raw) : [];
    return cmds.slice(0, limit);
  } catch {
    return [];
  }
}
