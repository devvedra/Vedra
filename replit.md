# Vedra — Offline AI Voice Assistant

An offline-first Android voice assistant that understands natural language, remembers user preferences locally, and executes device actions — all without sending data to any server.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mobile/app/index.tsx` — Main voice screen (VoiceScreen), all command handlers
- `artifacts/mobile/utils/commandParser.ts` — Intent parsing engine (v0.8: 40+ command types)
- `artifacts/mobile/utils/memoryManager.ts` — Local AsyncStorage memory (name, contacts, apps, commands)
- `artifacts/mobile/utils/conversationContext.ts` — Short-term context for pronoun resolution
- `artifacts/mobile/utils/studyAssistant.ts` — Study timer, checklist, study reminders
- `artifacts/mobile/utils/smallTalkManager.ts` — Offline small-talk responses
- `artifacts/mobile/utils/intentEngine.ts` — NLP pattern-scoring for fuzzy intent classification
- `artifacts/mobile/components/` — All feedback UI panels

## Architecture decisions

- **Offline-first**: All processing is on-device — no API calls, no cloud services.
- **AsyncStorage for memory**: User name, favourite contacts/apps, and recent commands stored as JSON blobs. SQLite not needed at this scale.
- **Conversation context is in-memory only**: Context window expires after 5 minutes of inactivity. Pronoun resolution ("him" → last mentioned contact) happens before parsing.
- **commandParser is the source of truth**: intentEngine.ts provides fuzzy NLP scoring but commandParser is still the canonical parser called for every transcript. The two layers complement each other.
- **Study assistant is fully offline**: Builds checklist from existing reminders using keyword matching — no external AI required.

## Product (v0.8 features)

- Voice recognition (offline-first via Android SpeechRecognizer)
- Text-to-Speech response
- Open apps / make calls / send SMS
- Alarms, timers, stopwatch, reminders, calendar
- Device controls: flashlight, volume, brightness, Wi-Fi, Bluetooth, battery
- **v0.8 NEW** — Intent recognition: understands varied phrasings ("I want to use WhatsApp", "Can you launch Chrome?")
- **v0.8 NEW** — Local memory: remembers your name and usage patterns
- **v0.8 NEW** — Conversation context: pronoun resolution across turns ("send him a text")
- **v0.8 NEW** — Study assistant: Pomodoro timers, study reminders, auto-generated checklists
- **v0.8 NEW** — Small talk: greetings, capability questions, friendly fallbacks
- **v0.8 NEW** — Unknown command graceful fallback with suggestions

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Voice recognition requires a native APK build — the web/Expo Go preview shows "Preview mode" for the mic.
- Scan the QR code in the Expo workflow with **Expo Go** on Android to test on a real device.
- `expo-calendar`, `expo-notifications`, and `expo-sms` show version mismatch warnings — these are cosmetic and don't affect functionality.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
