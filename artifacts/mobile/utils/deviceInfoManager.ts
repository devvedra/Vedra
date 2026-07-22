/**
 * deviceInfoManager.ts — Vedra v0.7
 *
 * Reports device information entirely offline using React Native's built-in
 * Platform API, expo-battery, and expo-file-system (included in Expo SDK).
 *
 * Supported queries:
 *  • Storage remaining / available
 *  • RAM usage / available memory
 *  • Battery health & charging status
 *  • Device model
 *  • Android version
 *  • Current date and time
 */

import { Platform } from 'react-native';
import * as Battery from 'expo-battery';

export type DeviceInfoResult = {
  success: boolean;
  message: string;
  detail?: string;
  /** Structured info for display */
  info?: Record<string, string>;
};

// ── Storage ───────────────────────────────────────────────────────────────────

export async function getStorageInfo(): Promise<DeviceInfoResult> {
  if (Platform.OS === 'web') return _webUnsupported('Storage info');
  try {
    // expo-file-system ships as part of the Expo SDK bundle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FileSystem: any = await import('expo-file-system');
    const [free, total] = await Promise.all([
      FileSystem.getFreeDiskStorageAsync() as Promise<number>,
      FileSystem.getTotalDiskCapacityAsync() as Promise<number>,
    ]);

    const freeGB  = (free  / 1_073_741_824).toFixed(1);
    const totalGB = (total / 1_073_741_824).toFixed(1);
    const usedGB  = ((total - free) / 1_073_741_824).toFixed(1);
    const usedPct = Math.round(((total - free) / total) * 100);

    const message = `You have ${freeGB} GB of storage available out of ${totalGB} GB total. ${usedPct}% is used.`;
    return {
      success: true,
      message,
      info: {
        'Free':  `${freeGB} GB`,
        'Used':  `${usedGB} GB (${usedPct}%)`,
        'Total': `${totalGB} GB`,
      },
    };
  } catch {
    return { success: false, message: 'Could not read storage information.' };
  }
}

// ── RAM ───────────────────────────────────────────────────────────────────────

export async function getRamInfo(): Promise<DeviceInfoResult> {
  if (Platform.OS === 'web') return _webUnsupported('RAM info');
  try {
    // React Native exposes total memory via NativeModules on Android
    const { NativeModules } = await import('react-native');
    const constants = NativeModules?.PlatformConstants ?? (Platform as any).constants;
    const totalBytes: number | undefined = constants?.totalMemory;

    if (totalBytes && totalBytes > 0) {
      const totalGB = (totalBytes / 1_073_741_824).toFixed(1);
      const message = `Your device has ${totalGB} GB of RAM.`;
      return {
        success: true,
        message,
        info: { 'Total RAM': `${totalGB} GB` },
      };
    }

    return {
      success: false,
      message: 'RAM information is not available on this device.',
    };
  } catch {
    return { success: false, message: 'Could not read RAM information.' };
  }
}

// ── Battery health ────────────────────────────────────────────────────────────

export async function getBatteryHealth(): Promise<DeviceInfoResult> {
  if (Platform.OS === 'web') return _webUnsupported('Battery health');
  try {
    const [level, state, lowPower] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
      Battery.isLowPowerModeEnabledAsync(),
    ]);

    const percent = level === -1 ? null : Math.round(level * 100);
    const stateLabel = _batteryStateLabel(state);

    if (percent === null) {
      return { success: false, message: 'Battery information is unavailable on this device.' };
    }

    const lowPowerNote = lowPower ? ' Low Power Mode is ON.' : '';
    const message = `Battery is at ${percent}%. Status: ${stateLabel}.${lowPowerNote}`;

    return {
      success: true,
      message,
      info: {
        'Level':      `${percent}%`,
        'Status':     stateLabel,
        'Low Power':  lowPower ? 'On' : 'Off',
      },
    };
  } catch {
    return { success: false, message: 'Could not read battery health.' };
  }
}

// ── Device model ──────────────────────────────────────────────────────────────

export async function getDeviceModel(): Promise<DeviceInfoResult> {
  if (Platform.OS === 'web') return _webUnsupported('Device model info');
  try {
    const { NativeModules } = await import('react-native');
    const constants = NativeModules?.PlatformConstants ?? (Platform as any).constants;

    const model: string      = constants?.Model ?? constants?.model ?? 'Unknown';
    const brand: string      = constants?.Brand ?? constants?.brand ?? '';
    const manufacturer: string = constants?.Manufacturer ?? constants?.manufacturer ?? '';
    const androidVersion: string = String(Platform.Version ?? 'Unknown');

    const fullName = [brand, model].filter(Boolean).join(' ') || model;
    const message  = `Your device is a ${fullName} running Android ${androidVersion}.`;

    return {
      success: true,
      message,
      info: {
        'Model':        model,
        'Brand':        brand || '—',
        'Manufacturer': manufacturer || '—',
        'Android':      androidVersion,
      },
    };
  } catch {
    return { success: false, message: 'Could not read device model.' };
  }
}

// ── Android version ───────────────────────────────────────────────────────────

export async function getAndroidVersion(): Promise<DeviceInfoResult> {
  if (Platform.OS === 'web') return _webUnsupported('Android version info');
  const version = String(Platform.Version ?? 'Unknown');
  const codename = _androidCodename(Number(Platform.Version));
  const message  = `You are running Android ${version}${codename ? ` (${codename})` : ''}.`;
  return {
    success: true,
    message,
    info: {
      'Android Version': version,
      ...(codename ? { 'Codename': codename } : {}),
    },
  };
}

// ── Date & Time ───────────────────────────────────────────────────────────────

export function getDateTime(): DeviceInfoResult {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
  const message = `It is ${timeStr} on ${dateStr}.`;
  return {
    success: true,
    message,
    info: {
      'Date': dateStr,
      'Time': timeStr,
    },
  };
}

// ── All device info ───────────────────────────────────────────────────────────

export async function getAllDeviceInfo(): Promise<DeviceInfoResult> {
  const [storage, ram, battery, model] = await Promise.allSettled([
    getStorageInfo(),
    getRamInfo(),
    getBatteryHealth(),
    getDeviceModel(),
  ]);
  const dt = getDateTime();

  const info: Record<string, string> = {};
  const messages: string[] = [];

  for (const r of [storage, ram, battery, model]) {
    if (r.status === 'fulfilled' && r.value.success && r.value.info) {
      Object.assign(info, r.value.info);
      messages.push(r.value.message);
    }
  }

  if (dt.info) Object.assign(info, dt.info);
  messages.push(dt.message);

  return {
    success: true,
    message: messages.join(' '),
    info,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _batteryStateLabel(state: Battery.BatteryState): string {
  switch (state) {
    case Battery.BatteryState.CHARGING:   return 'Charging';
    case Battery.BatteryState.FULL:       return 'Fully charged';
    case Battery.BatteryState.UNPLUGGED:  return 'Not charging';
    default:                              return 'Unknown';
  }
}

function _androidCodename(api: number): string {
  const map: Record<number, string> = {
    21: 'Lollipop', 22: 'Lollipop', 23: 'Marshmallow', 24: 'Nougat',
    25: 'Nougat', 26: 'Oreo', 27: 'Oreo', 28: 'Pie', 29: 'Android 10',
    30: 'Android 11', 31: 'Android 12', 32: 'Android 12L',
    33: 'Android 13', 34: 'Android 14', 35: 'Android 15',
  };
  return map[api] ?? '';
}

function _webUnsupported(label: string): DeviceInfoResult {
  return { success: false, message: `${label} is only available on Android devices.` };
}
