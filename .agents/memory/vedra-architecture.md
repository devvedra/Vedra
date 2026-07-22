---
name: Vedra v0.9 architecture
description: Feature modules, hybrid AI wiring, and key platform decisions for Vedra.
---

# Vedra v0.9 Architecture

## Stack
- Expo SDK 54 / React Native 0.81 / TypeScript / Expo Router / TanStack Query
- Entry: `artifacts/mobile/app/index.tsx` — single 1200-line screen, all panels in one ScrollView
- Navigation: `artifacts/mobile/app/settings.tsx` (push via `router.push('/settings')`)

## Key architectural decisions

**Offline-first pipeline (in order):**
1. `commandParser.ts` (regex keyword fast-path)
2. `intentEngine.ts` (fuzzy NLU + scoring)
3. `smallTalk.ts` (rule-based conversational)
4. `utils/ai/aiRouter.ts` → `routeToAI()` (cloud AI fallback)

**Why:** Each layer is tried only if the previous fails. Offline commands never touch the network.

## v0.9 Hybrid AI wiring (completed)
- `routeToAI()` is called as Fallback 4 in `index.tsx` via `handleAIQuery(transcript)`
- `AIFeedback` component renders when `activePanel === 'ai'`
- `ConversationHistory` component toggles via "Show History (N)" button
- Settings gear (⚙) in header navigates to settings screen
- Conversation turns persisted via `conversationManager.ts` → AsyncStorage key `@vedra/conversation_v9`
- `clearConversationHistory()` wired to Clear button in ConversationHistory component

## Provider system
- Interface: `utils/ai/aiProvider.ts` (AIProvider, AIMessage, AIResponse)
- Providers: `utils/ai/providers/openaiProvider.ts`, `geminiProvider.ts`
- Registry in `utils/ai/aiRouter.ts` → `PROVIDERS` object
- Add new provider: implement AIProvider, add to PROVIDERS dict — no other changes needed

## Settings storage
- `utils/settingsStore.ts` → AsyncStorage key `@vedra/settings_v9`
- API keys stored separately → `@vedra/api_keys_v9`
- `cloudAIEnabled: false` by default (offline-first)

## TypeScript fixes applied (v0.9)
- `commandParser.ts`: `packages` → `packageOptions` on Clock entry; `dur.ms` → `dur.totalMs`; `parsed.ms` → `parsed.date.getTime()`; removed `parsed.matchedText` (doesn't exist on ParsedAbsoluteTime)
- `settingsStore.ts`: null-safety fix on `getSettings()` return
- `utils/ai/aiRouter.ts`: smart-quotes inside double-quoted string → single quotes

## Known limitations
- Voice recognition requires native APK build (not available in web preview)
- Voice speed/pitch stored in settings but not yet applied to expo-speech (deferred)
- No AbortController on in-flight AI requests when user taps mic again (deferred)
