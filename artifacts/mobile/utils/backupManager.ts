/**
 * backupManager.ts — Vedra Backup & Restore (v1.0)
 *
 * Local-only backup and restore of all user data.
 * No cloud storage required. Uses expo-file-system to write/read JSON.
 * Works on Android device storage (/sdcard/Documents/Vedra/).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
// expo-file-system v19 re-exports all legacy helpers (getInfoAsync,
// makeDirectoryAsync, writeAsStringAsync, readAsStringAsync, deleteAsync,
// readDirectoryAsync, documentDirectory) from its main entry at runtime.
// TypeScript types for the new main entry are narrower, so we cast via `any`
// only where the type definitions don't expose the legacy surface.
import * as _FileSystem from 'expo-file-system';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FileSystem = _FileSystem as any;
import { getConversationHistory } from './conversationManager';

// ─── Types ────────────────────────────────────────────────────────────────────

export const BACKUP_VERSION = '1.0' as const;

export interface VedraBackup {
  version: typeof BACKUP_VERSION;
  createdAt: string;
  deviceLabel?: string;
  data: {
    settings?: object;
    conversationHistory?: object[];
    userProfile?: object;
    contacts?: object[];
    apps?: object[];
    recentCommands?: object[];
    reminders?: object[];
    notes?: object[];
  };
}

export interface BackupResult {
  success: boolean;
  message: string;
  filePath?: string;
  backup?: VedraBackup;
}

// ─── All storage keys to back up ─────────────────────────────────────────────

const BACKUP_KEYS = [
  '@vedra/settings_v9',
  '@vedra/user_profile',
  '@vedra/contacts',
  '@vedra/apps',
  '@vedra/recent_commands',
  '@vedra/reminders',
  '@vedra/notes_v1',
] as const;

// ─── File path ────────────────────────────────────────────────────────────────

function getBackupDir(): string {
  return (FileSystem.documentDirectory ?? '') + 'VedraBackups/';
}

function getBackupPath(label?: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = label ? `vedra-backup-${label}-${ts}.json` : `vedra-backup-${ts}.json`;
  return getBackupDir() + name;
}

// ─── Create backup ────────────────────────────────────────────────────────────

export async function createBackup(label?: string): Promise<BackupResult> {
  try {
    // Ensure backup directory exists
    const dir = getBackupDir();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    // Gather all data
    const raws = await AsyncStorage.multiGet([...BACKUP_KEYS]);
    const keyMap = Object.fromEntries(raws.map(([k, v]) => [k, v]));

    const parse = (key: string, fallback: any = null) => {
      try {
        const v = keyMap[key];
        return v ? JSON.parse(v) : fallback;
      } catch {
        return fallback;
      }
    };

    const conversationHistory = await getConversationHistory();

    const backup: VedraBackup = {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      deviceLabel: label,
      data: {
        settings:            parse('@vedra/settings_v9'),
        conversationHistory: conversationHistory,
        userProfile:         parse('@vedra/user_profile'),
        contacts:            parse('@vedra/contacts', []),
        apps:                parse('@vedra/apps', []),
        recentCommands:      parse('@vedra/recent_commands', []),
        reminders:           parse('@vedra/reminders', []),
        notes:               parse('@vedra/notes_v1', []),
      },
    };

    const filePath = getBackupPath(label);
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backup, null, 2));

    return {
      success: true,
      message: `Backup saved to ${filePath}`,
      filePath,
      backup,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Backup failed: ${err?.message ?? 'Unknown error'}`,
    };
  }
}

// ─── List backups ─────────────────────────────────────────────────────────────

export interface BackupFileInfo {
  name: string;
  path: string;
  modificationTime?: number;
  size?: number;
}

export async function listBackups(): Promise<BackupFileInfo[]> {
  try {
    const dir = getBackupDir();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) return [];

    const files = await FileSystem.readDirectoryAsync(dir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const infos: BackupFileInfo[] = await Promise.all(
      jsonFiles.map(async (name) => {
        const path = dir + name;
        const info = await FileSystem.getInfoAsync(path);
        return {
          name,
          path,
          modificationTime: info.exists ? info.modificationTime : undefined,
          size: info.exists ? (info as any).size : undefined,
        };
      }),
    );

    // Newest first
    return infos.sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0));
  } catch {
    return [];
  }
}

// ─── Restore backup ───────────────────────────────────────────────────────────

export async function restoreBackup(filePath: string): Promise<BackupResult> {
  try {
    const content = await FileSystem.readAsStringAsync(filePath);
    const backup: VedraBackup = JSON.parse(content);

    if (!backup.version || !backup.data) {
      return { success: false, message: 'Invalid backup file format.' };
    }

    const { data } = backup;
    const pairs: [string, string][] = [];

    if (data.settings)
      pairs.push(['@vedra/settings_v9', JSON.stringify(data.settings)]);
    if (data.userProfile)
      pairs.push(['@vedra/user_profile', JSON.stringify(data.userProfile)]);
    if (data.contacts?.length)
      pairs.push(['@vedra/contacts', JSON.stringify(data.contacts)]);
    if (data.apps?.length)
      pairs.push(['@vedra/apps', JSON.stringify(data.apps)]);
    if (data.recentCommands?.length)
      pairs.push(['@vedra/recent_commands', JSON.stringify(data.recentCommands)]);
    if (data.reminders?.length)
      pairs.push(['@vedra/reminders', JSON.stringify(data.reminders)]);
    if (data.notes?.length)
      pairs.push(['@vedra/notes_v1', JSON.stringify(data.notes)]);
    if (data.conversationHistory?.length)
      pairs.push(['@vedra/conversation_v9', JSON.stringify(data.conversationHistory)]);

    if (pairs.length) await AsyncStorage.multiSet(pairs);

    return {
      success: true,
      message: `Restored backup from ${new Date(backup.createdAt).toLocaleString()}`,
      backup,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Restore failed: ${err?.message ?? 'Unknown error'}`,
    };
  }
}

// ─── Delete backup ────────────────────────────────────────────────────────────

export async function deleteBackup(filePath: string): Promise<BackupResult> {
  try {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
    return { success: true, message: 'Backup deleted.' };
  } catch (err: any) {
    return { success: false, message: `Delete failed: ${err?.message ?? 'Unknown error'}` };
  }
}
