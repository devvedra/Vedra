/**
 * batteryManager.ts — Vedra v0.6
 *
 * Reads battery level and charging status using expo-battery.
 * Fully offline — reads from the Android BatteryManager API.
 */

import * as Battery from 'expo-battery';

export type BatteryInfo = {
  success: boolean;
  message: string;
  /** Battery percentage 0–100, if available */
  percent?: number;
  /** Human-readable charging state */
  status?: string;
};

/** Read the current battery level and charging state. */
export async function getBatteryInfo(): Promise<BatteryInfo> {
  try {
    const [level, state] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
    ]);

    const percent = level === -1 ? null : Math.round(level * 100);
    const statusLabel = _stateLabel(state);

    if (percent === null) {
      return { success: false, message: 'Battery information is not available on this device.' };
    }

    const message = `Battery is at ${percent}%. ${statusLabel}.`;
    return { success: true, message, percent, status: statusLabel };
  } catch {
    return { success: false, message: 'Could not read battery information.' };
  }
}

function _stateLabel(state: Battery.BatteryState): string {
  switch (state) {
    case Battery.BatteryState.CHARGING:    return 'Charging';
    case Battery.BatteryState.FULL:        return 'Fully charged';
    case Battery.BatteryState.UNPLUGGED:   return 'Not charging';
    case Battery.BatteryState.UNKNOWN:
    default:                               return 'Status unknown';
  }
}
