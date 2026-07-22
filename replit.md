# Vedra

An offline-first AI voice assistant for Android, built with React Native + Expo, paired with an Express API server.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo dev server (QR code → Expo Go on Android)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port from `$PORT`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env for API server: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: React Native + Expo (expo-router), Android-first
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mobile/` — Expo mobile app (Vedra)
  - `app/index.tsx` — main voice screen (all command handlers)
  - `utils/commandParser.ts` — offline command parser (v0.7)
  - `utils/` — feature utilities (media, notifications, device info, quick actions, small talk…)
  - `components/` — feedback UI cards per feature
- `artifacts/api-server/` — Express API server
- `lib/` — shared packages (db schema, api-spec, api-client-react, api-zod)

## Vedra Features (v0.7)

All features work **100% offline** on Android using official APIs:

| Feature | Commands |
|---|---|
| Voice Recognition | Tap mic, speak naturally |
| Text-to-Speech | Vedra reads responses aloud |
| Open Apps | "Open WhatsApp", "Launch Chrome" |
| Phone Calls | "Call Mom", "Dial Rahul" |
| SMS | "Text Sarah saying I'll be late" |
| Flashlight | "Turn on torch", "Flashlight off" |
| Volume | "Volume up", "Set volume to 50%" |
| Brightness | "Increase brightness", "Min brightness" |
| Battery | "Battery percentage", "Charging status" |
| Connectivity | "Turn on Wi-Fi", "Bluetooth off" |
| Alarms | "Set alarm for 6 AM", "Cancel alarm" |
| Timers | "Start 10 minute timer", "Cancel timer" |
| Stopwatch | "Start stopwatch", "Reset stopwatch" |
| Reminders | "Remind me to study at 7 PM" |
| Calendar | "Create meeting tomorrow at 10 AM" |
| **Media Controls** | "Play music", "Next song", "Pause", "Media volume up" |
| **Notifications** | "Read my notifications", "Read WhatsApp notifications" |
| **Device Info** | "Storage remaining", "Device model", "Android version" |
| **Quick Actions** | "Go home", "Open quick settings", "Open app info for WhatsApp" |
| **Small Talk** | "Hello", "Thank you", "Tell me a joke", "Who are you?" |

## Architecture decisions

- Entirely offline: no LLM calls, pure string matching in `commandParser.ts`
- Each feature is a self-contained utility module with a clear Result type
- UI feedback uses per-feature state machines (phase-based) to keep the main screen clean
- Notification reading and Recent Apps require special Android permissions; the app guides users gracefully
- Media playback dispatch uses `expo-intent-launcher`; volume uses `react-native-volume-manager`

## Gotchas

- Voice recognition requires a real Android device (shows "Preview mode" in web/Expo Go)
- Notification reading requires "Notification Access" granted manually in Android Settings
- Wi-Fi/Bluetooth toggle on Android 10+ opens Settings (OS restriction); direct toggle not permitted
- Media key dispatch may not work on all Android versions — falls back to opening sound settings
- Scan the QR code in the mobile preview with Expo Go to test on a real device

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `artifacts/mobile/SETUP.md` for APK build instructions (EAS + local build)
