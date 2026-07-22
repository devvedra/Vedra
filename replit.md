# Vedra — Offline-First Android AI Assistant

## Overview

Vedra is an offline-first Android AI assistant built with Expo + React Native. All device commands execute locally — no internet required. Cloud AI (OpenAI/Gemini) is an optional fallback, never a requirement.

## Architecture

- **Stack**: Expo SDK 54 / React Native 0.81 / TypeScript / Expo Router / TanStack Query
- **Monorepo**: pnpm workspace with `artifacts/mobile` (Expo app), `artifacts/api-server` (Express), `artifacts/mockup-sandbox`
- **Routing**: Single voice screen at `/`, settings at `/settings`, diagnostics at `/diagnostics`

## Key Files

| Path | Purpose |
|------|---------|
| `artifacts/mobile/app/index.tsx` | Main voice screen — all panels, 4-layer intent pipeline |
| `artifacts/mobile/app/settings.tsx` | Full settings (theme, voice, AI, backup, privacy) |
| `artifacts/mobile/app/diagnostics.tsx` | System health check screen |
| `artifacts/mobile/utils/plugins/` | Plugin architecture (types, manager, built-in plugins) |
| `artifacts/mobile/utils/errorLogger.ts` | Local error log (never uploaded) |
| `artifacts/mobile/utils/backupManager.ts` | Local JSON backup/restore |
| `artifacts/mobile/utils/settingsStore.ts` | Settings persistence (theme, offlineFirst, voice, AI) |
| `artifacts/mobile/contexts/ThemeContext.tsx` | Dark/light/system theme provider |
| `artifacts/mobile/ARCHITECTURE.md` | Full architecture documentation |
| `artifacts/mobile/PLUGIN_GUIDE.md` | Plugin development guide |

## Intent Pipeline (4 layers)

1. `commandParser.ts` — fast keyword matching
2. `intentEngine.ts` — fuzzy NLU
3. `smallTalk.ts` — rule-based conversation
4. `PluginManager` — plugin pipeline (Calculator, Notes, Weather)
5. `routeToAI()` — cloud AI fallback (OpenAI / Gemini)

## Running the App

```bash
pnpm install
pnpm --filter @workspace/mobile run dev   # Expo dev server (web preview)
```

Full voice recognition requires a native Android APK build via EAS CLI.

## User Preferences

- Extend the existing codebase without breaking previous functionality
- Preserve all v0.1–v0.9 features
- Offline-first: cloud AI is optional, never required
- Plugin architecture: new features as plugins, not core changes
