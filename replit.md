# Vedra

Offline-first Android AI assistant built with Expo + React Native.

## Project Structure

```
artifacts/mobile/     — Expo mobile app (main product)
artifacts/api-server/ — Lightweight Express API server
```

This is a pnpm monorepo. Always use `pnpm` to install packages.

## Running the project

```bash
# Install all dependencies
pnpm install

# Start Expo dev server (web preview + QR code for Expo Go)
pnpm --filter @workspace/mobile run dev

# Start API server
pnpm --filter @workspace/api-server run dev
```

The Expo workflow starts automatically. Voice recognition only works in a native Android APK build — the web preview shows all UI panels with mock input.

## Building an Android APK

```bash
# Requires EAS CLI and an Expo account
eas build --platform android --profile preview
```

EAS project ID: `ac6482ca-4361-4255-99af-bd1146f1e27b`

## Architecture

See `artifacts/mobile/ARCHITECTURE.md` for the full intent routing pipeline, plugin system, theme system, and storage schema.

Key layers (in order):
1. **commandParser** — fast keyword matching
2. **intentEngine** — fuzzy NLU
3. **smallTalk** — rule-based conversational responses
4. **PluginManager** — plugin pipeline
5. **routeToAI** — cloud AI (OpenAI or Gemini, opt-in)

## Tone Strategy

Three AI personality modes selectable in Settings → Tone Strategy:

| Mode | Language | Speed | Best for |
|------|----------|-------|----------|
| Hinglish Mentor | 70% Hinglish / 30% English | 1.05× | Study & complex topics |
| Focused Academic | Indian English + Hindi grounding | 0.95× | Revision & formulas |
| Local Companion | Casual Hindi | 1.00× | Planning & casual chats |

Each tone drives both the AI system prompt (`utils/ai/aiRouter.ts`) and TTS rate/pitch (`hooks/useTextToSpeech.ts`).

## User Preferences

- Keep existing project structure and stack.
- Do not migrate to a different database or restructure the monorepo without explicit request.
