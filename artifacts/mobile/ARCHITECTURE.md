# Vedra v1.0 Architecture

## Overview

Vedra is an offline-first Android AI assistant built with Expo + React Native. The core principle is that all device commands execute locally — no internet required. Cloud AI is an optional fallback, never a requirement.

---

## Module Map

```
artifacts/mobile/
├── app/
│   ├── index.tsx         Main voice screen (all panels)
│   ├── settings.tsx      Full settings (theme, voice, AI, backup)
│   ├── diagnostics.tsx   System health check screen
│   └── _layout.tsx       Root layout (ThemeProvider, navigation)
│
├── components/           UI feedback panels (one per feature)
├── contexts/
│   └── ThemeContext.tsx  Theme provider (dark/light/system)
├── hooks/
│   ├── useColors.ts      Active color tokens (via ThemeContext)
│   ├── useSpeechRecognition.ts
│   ├── useTextToSpeech.ts
│   ├── useTimerManager.ts
│   └── useStopwatch.ts
├── utils/
│   ├── commandParser.ts  Fast-path keyword parser (O(keywords))
│   ├── intentEngine.ts   Fuzzy NLU intent classification
│   ├── smallTalk.ts      Rule-based conversational responses
│   ├── errorLogger.ts    Local error log (AsyncStorage, never uploaded)
│   ├── backupManager.ts  Local JSON backup / restore
│   ├── settingsStore.ts  Settings persistence (AsyncStorage)
│   ├── privacyManager.ts Data export / clear / import
│   ├── ai/
│   │   ├── aiProvider.ts   Provider interface
│   │   ├── aiRouter.ts     Cloud AI routing + fallback
│   │   └── providers/      OpenAI, Gemini implementations
│   └── plugins/
│       ├── types.ts        VedraPlugin interface + result types
│       ├── pluginManager.ts Registry, canHandle, execute, error isolation
│       ├── initPlugins.ts  Startup registration of built-in plugins
│       ├── calculatorPlugin.ts  Offline arithmetic
│       ├── notesPlugin.ts       Voice note taking (AsyncStorage)
│       └── weatherPlugin.ts     Weather (defers to AI when enabled)
└── constants/
    └── colors.ts         Design tokens (dark / light / lightMode)
```

---

## Intent Routing Pipeline

Every voice transcript flows through four layers in order:

```
Transcript
    │
    ▼
[1] commandParser.ts          Fast keyword matching — O(keywords)
    │  matches known command?
    ├─YES──► handler in index.tsx
    │
    ▼
[2] intentEngine.ts           Fuzzy NLU — regex + scoring
    │  recognisable intent?
    ├─YES──► handler in index.tsx
    │
    ▼
[3] smallTalk.ts              Rule-based conversational
    │  matched a phrase?
    ├─YES──► speak response
    │
    ▼
[4] PluginManager             Plugin pipeline
    │  any plugin.canHandle()?
    ├─YES──► plugin.execute() → PluginFeedback panel
    │
    ▼
[5] routeToAI()               Cloud AI (if enabled + key configured)
    │
    └──► AIFeedback panel
```

Offline commands **never** reach layer 5.

---

## Plugin System

### Adding a plugin

1. Create `utils/plugins/myPlugin.ts` implementing `VedraPlugin`
2. Register it in `utils/plugins/initPlugins.ts`
3. Done — no changes to core engine needed

### VedraPlugin interface

```typescript
interface VedraPlugin {
  id:                   string;        // unique stable id
  name:                 string;        // display name
  description:          string;
  version:              string;        // semver
  requiredPermissions:  string[];      // Android permission strings
  triggerKeywords:      string[];      // hint words for routing

  canHandle(transcript: string): boolean;  // O(1), no async
  execute(transcript: string, context: PluginContext): Promise<PluginResult>;

  onLoad?():   Promise<void>;  // called once at startup
  onUnload?(): Promise<void>;  // called on unregister
}
```

### Error isolation

Plugin failures are caught by `PluginManager.execute()` and converted to a user-friendly message. A plugin crash **never** crashes the app. Errors are logged to `errorLogger.ts` and visible in the Diagnostics screen.

---

## Theme System

`ThemeContext.tsx` provides the active colour palette to the entire app.

- `'dark'`   → `colors.dark` (Vedra's signature space theme)
- `'light'`  → `colors.lightMode` (clean white palette)
- `'system'` → follows device appearance setting

`useThemeColors()` returns the active palette. The old `useColors()` hook is now an alias for `useThemeColors()`.

---

## Settings Storage

| Key | Content |
|-----|---------|
| `@vedra/settings_v9` | `VedraSettings` JSON |
| `@vedra/api_keys_v9` | `{ openai?, gemini? }` — device only |
| `@vedra/conversation_v9` | Conversation history (max 50 turns) |
| `@vedra/notes_v1` | Notes array (max 100) |
| `@vedra/error_log_v1` | Error log (max 100 entries) |

API keys are never uploaded. The server (`artifacts/api-server`) does not receive them.

---

## Security & Privacy

- All processing is local by default (`offlineFirst: true`)
- API keys stored in AsyncStorage under a separate key, masked in UI
- `privacyManager.ts` provides one-call clear/export/import
- `backupManager.ts` writes JSON to `documentDirectory/VedraBackups/`
- `errorLogger.ts` logs errors locally; Diagnostics screen shows them
- User data is never sent to any server without explicit opt-in

---

## Build & Run

```bash
# Install dependencies
pnpm install

# Start Expo dev server (web preview)
pnpm --filter @workspace/mobile run dev

# Build Android APK (requires EAS CLI)
eas build --platform android --profile preview
```

Voice recognition requires a native APK build. Web preview shows all UI panels but uses mock voice input.
