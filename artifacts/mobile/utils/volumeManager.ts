/**
 * volumeManager.ts — Vedra v0.6
 *
 * Controls media volume using react-native-volume-manager.
 * Uses Android's AudioManager under the hood. Works 100% offline.
 *
 * Volume is represented as 0–100 (percent) externally but as 0–1 internally.
 */

import { Platform } from 'react-native';

export type VolumeResult = {
  success: boolean;
  message: string;
  /** Current volume 0–100 after the action, if known */
  level?: number;
};

const STEP = 0.1; // 10% per up/down command

async function getManager() {
  const { VolumeManager } = await import('react-native-volume-manager');
  return VolumeManager;
}

/** Increase media volume by one step (~10%). */
export async function volumeUp(): Promise<VolumeResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const vm = await getManager();
    const { volume: current } = await vm.getVolume();
    const next = Math.min(1, (current ?? 0) + STEP);
    await vm.setVolume(next, { type: 'music', showUI: false });
    const pct = Math.round(next * 100);
    return { success: true, message: `Volume increased to ${pct}%.`, level: pct };
  } catch {
    return { success: false, message: 'Could not change volume.' };
  }
}

/** Decrease media volume by one step (~10%). */
export async function volumeDown(): Promise<VolumeResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const vm = await getManager();
    const { volume: current } = await vm.getVolume();
    const next = Math.max(0, (current ?? 1) - STEP);
    await vm.setVolume(next, { type: 'music', showUI: false });
    const pct = Math.round(next * 100);
    return { success: true, message: `Volume decreased to ${pct}%.`, level: pct };
  } catch {
    return { success: false, message: 'Could not change volume.' };
  }
}

/** Set media volume to a specific percentage (0–100). */
export async function setVolumeTo(percent: number): Promise<VolumeResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const vm = await getManager();
    const clamped = Math.max(0, Math.min(100, percent));
    await vm.setVolume(clamped / 100, { type: 'music', showUI: false });
    return { success: true, message: `Volume set to ${clamped}%.`, level: clamped };
  } catch {
    return { success: false, message: 'Could not set volume.' };
  }
}

/** Mute media volume (set to 0). */
export async function muteVolume(): Promise<VolumeResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const vm = await getManager();
    await vm.setVolume(0, { type: 'music', showUI: false });
    return { success: true, message: 'Phone muted.', level: 0 };
  } catch {
    return { success: false, message: 'Could not mute the phone.' };
  }
}

/** Set media volume to maximum (100%). */
export async function maxVolume(): Promise<VolumeResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const vm = await getManager();
    await vm.setVolume(1, { type: 'music', showUI: false });
    return { success: true, message: 'Volume set to maximum.', level: 100 };
  } catch {
    return { success: false, message: 'Could not set maximum volume.' };
  }
}

/** Get the current media volume (0–100). */
export async function getVolume(): Promise<VolumeResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const vm = await getManager();
    const { volume } = await vm.getVolume();
    const pct = Math.round((volume ?? 0) * 100);
    return { success: true, message: `Current volume is ${pct}%.`, level: pct };
  } catch {
    return { success: false, message: 'Could not read volume.' };
  }
}

function _notSupported(): VolumeResult {
  return { success: false, message: 'Volume control is only supported on Android devices.' };
}
