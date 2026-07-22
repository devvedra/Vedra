/**
 * mediaController.ts — Vedra v0.7
 *
 * Controls media playback and media volume using available Android APIs.
 *
 * Playback (play/pause/next/prev/stop):
 *   Android restricts direct media key dispatch to apps with an active
 *   MediaSession. We use expo-intent-launcher to send the correct broadcast
 *   intent, which is picked up by the active media app (Spotify, YouTube, etc.)
 *   On Android 13+ this may silently no-op — we guide the user accordingly.
 *
 * Media Volume:
 *   Delegates to react-native-volume-manager (stream type MUSIC) — same as
 *   the existing volume manager but focused on media stream.
 */

import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export type MediaResult = {
  success: boolean;
  message: string;
  /** true if the result opened settings instead of acting directly */
  openedSettings?: boolean;
};

// Android KeyEvent key codes for media buttons
const KEYCODE_MEDIA_PLAY        = 126;
const KEYCODE_MEDIA_PAUSE       = 127;
const KEYCODE_MEDIA_PLAY_PAUSE  = 85;
const KEYCODE_MEDIA_NEXT        = 87;
const KEYCODE_MEDIA_PREVIOUS    = 88;
const KEYCODE_MEDIA_STOP        = 86;

// ── Playback control ──────────────────────────────────────────────────────────

/**
 * Dispatch a media button event to the active media app.
 * Uses ACTION_MEDIA_BUTTON broadcast (works on Android < 12 directly;
 * on 12+ relies on the system forwarding to the last active MediaSession).
 */
async function dispatchMediaKey(keyCode: number, label: string): Promise<MediaResult> {
  if (Platform.OS !== 'android') {
    return { success: false, message: 'Media control is only supported on Android.' };
  }

  try {
    // Attempt to send a media button broadcast via IntentLauncher
    // We use the MEDIA_BUTTON action with an extra key event code.
    // This works for apps that register a MediaButtonReceiver.
    await IntentLauncher.startActivityAsync('android.intent.action.MEDIA_BUTTON', {
      extra: {
        'android.intent.extra.KEY_EVENT': {
          action: 0,   // ACTION_DOWN
          keyCode,
        },
      },
    });
    return { success: true, message: `${label} sent to your media app.` };
  } catch {
    // Fallback: open volume/media settings so user can control from notification shade
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.SOUND_SETTINGS,
      );
      return {
        success: true,
        message: `Could not send ${label} directly. Opening sound settings — use your media notification to control playback.`,
        openedSettings: true,
      };
    } catch {
      return {
        success: false,
        message: `Could not control media playback. Use your media app or notification shade controls.`,
      };
    }
  }
}

export async function mediaPlay(): Promise<MediaResult> {
  return dispatchMediaKey(KEYCODE_MEDIA_PLAY, 'Play');
}

export async function mediaPause(): Promise<MediaResult> {
  return dispatchMediaKey(KEYCODE_MEDIA_PAUSE, 'Pause');
}

export async function mediaPlayPause(): Promise<MediaResult> {
  return dispatchMediaKey(KEYCODE_MEDIA_PLAY_PAUSE, 'Play/Pause');
}

export async function mediaNext(): Promise<MediaResult> {
  return dispatchMediaKey(KEYCODE_MEDIA_NEXT, 'Next track');
}

export async function mediaPrevious(): Promise<MediaResult> {
  return dispatchMediaKey(KEYCODE_MEDIA_PREVIOUS, 'Previous track');
}

export async function mediaStop(): Promise<MediaResult> {
  return dispatchMediaKey(KEYCODE_MEDIA_STOP, 'Stop');
}

// ── Media volume control ──────────────────────────────────────────────────────

const STEP = 0.1; // 10% per step

async function getVM() {
  const { VolumeManager } = await import('react-native-volume-manager');
  return VolumeManager;
}

export async function mediaVolumeUp(): Promise<MediaResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const vm = await getVM();
    const { volume: current } = await vm.getVolume();
    const next = Math.min(1, (current ?? 0) + STEP);
    await vm.setVolume(next, { type: 'music', showUI: false });
    const pct = Math.round(next * 100);
    return { success: true, message: `Media volume increased to ${pct}%.` };
  } catch {
    return { success: false, message: 'Could not adjust media volume.' };
  }
}

export async function mediaVolumeDown(): Promise<MediaResult> {
  if (Platform.OS !== 'android') return _notSupported();
  try {
    const vm = await getVM();
    const { volume: current } = await vm.getVolume();
    const next = Math.max(0, (current ?? 1) - STEP);
    await vm.setVolume(next, { type: 'music', showUI: false });
    const pct = Math.round(next * 100);
    return { success: true, message: `Media volume decreased to ${pct}%.` };
  } catch {
    return { success: false, message: 'Could not adjust media volume.' };
  }
}

function _notSupported(): MediaResult {
  return { success: false, message: 'Media control is only supported on Android devices.' };
}
