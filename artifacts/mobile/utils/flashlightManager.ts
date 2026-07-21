/**
 * flashlightManager.ts — Vedra v0.6
 *
 * Controls the device flashlight (torch) using react-native-torch.
 * Works offline. Requires CAMERA permission on Android.
 *
 * Supported on: Android 10+, physical devices only.
 * Web / iOS: returns graceful error.
 */

import { Platform } from 'react-native';

// Track current torch state in-memory (react-native-torch has no getter)
let _torchOn = false;

export type FlashlightResult = {
  success: boolean;
  message: string;
  isOn?: boolean;
};

/**
 * Turn the flashlight on or off.
 * @param on  true = torch on, false = torch off
 */
export async function setFlashlight(on: boolean): Promise<FlashlightResult> {
  if (Platform.OS !== 'android') {
    return { success: false, message: 'Flashlight is only supported on Android devices.' };
  }

  try {
    // react-native-torch — dynamic import so web/iOS doesn't crash at load time
    const Torch = (await import('react-native-torch')).default;
    await Torch.switchState(on);
    _torchOn = on;
    return {
      success: true,
      message: on ? 'Flashlight turned on.' : 'Flashlight turned off.',
      isOn: on,
    };
  } catch (err: any) {
    const msg = err?.message ?? 'Unknown error';
    // Handle "no camera" or permission errors gracefully
    const friendly =
      msg.toLowerCase().includes('permission')
        ? 'Camera permission is required to use the flashlight.'
        : msg.toLowerCase().includes('camera')
        ? 'No flashlight found on this device.'
        : 'Could not control the flashlight.';
    return { success: false, message: friendly, isOn: _torchOn };
  }
}

/** Returns the last known torch state (best-effort — no hardware query). */
export function getFlashlightState(): boolean {
  return _torchOn;
}
