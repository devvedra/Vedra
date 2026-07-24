---
name: Vedra v0.5 architecture
description: Feature modules, UI structure, command parser, and key platform decisions for the Vedra AI assistant app.
---

## UI Structure (as of Step 4 completion)

### Screen layout (index.tsx)
```
root (View, backgroundColor #090A0F)
  └── Sidebar (absolute, z=30) — collapsible, slides from left
  └── mainCanvas (flex:1, column)
        ├── header (70px) — ☰ toggle | VedOrb + status | ⚙ settings
        ├── contentFeed (flex:1)
        │     ├── waveHero — "• VEDRA" label + HeroWave animated visualiser
        │     └── panelsScroll (ScrollView)
        │           ├── TimerDisplay, StopwatchDisplay
        │           ├── TranscriptCard (live partial)
        │           ├── [active panel feedback components]
        │           ├── ConversationHistory (toggle)
        │           └── hint chips (when no active panel)
        └── dockOuter — glass command dock
              ├── + button (placeholder, coming soon)
              ├── TextInput ("Ask Ved anything…")
              ├── mic icon (Feather, toggles voice via handleMicPress)
              └── → send button (cyan bg, submits text to processTranscript)
```

### Key components
- `HeroWave.tsx` — 60-bar Reanimated waveform, UI-thread frame callback, purple→cyan gradient, bell-curve envelope, `isListening` prop boosts amplitude 3×
- `Sidebar.tsx` — Feather icons, WORKSPACE + SYSTEM nav items, real conversation history (last 5 turns from `conversationHistory` prop), Settings + Diagnostics routing via callbacks

### Command pipeline
`processTranscript(text: string)` is a `useCallback` shared by:
- Voice: `useEffect` on `voiceState === 'result'`
- Text input: dock send button + keyboard submit

Pipeline order: pendingSMS check → parseCommand → classifyIntent → trySmallTalk → PluginManager → handleAIQuery

### Sidebar nav wiring
- `ask` → main screen (default)
- `vault`, `kb` → speak "This feature is coming soon…"
- `settings` → `router.push('/settings')`
- `diagnostics` → `router.push('/diagnostics')`

## Key Platform Decisions

- **expo-speech-recognition** (jamsch) — chosen over @react-native-voice/voice; native Android/iOS/Web support
- Sidebar is absolute overlay (not side-by-side) — better mobile UX
- `useFrameCallback` drives HeroWave animation on UI thread — 60fps without JS bridge
- `SharedValue` must be imported directly from `react-native-reanimated` in Reanimated v4 (not `Animated.SharedValue`)
- `conversationManager.ConversationTurn` uses `userText`/`assistantText` fields; Sidebar prop typed as `{ userText: string }[]` to avoid type duplication

## Files of Interest
- `app/index.tsx` — main screen, all state, command handlers
- `components/HeroWave.tsx` — animated waveform visualiser
- `components/Sidebar.tsx` — nav sidebar with Feather icons
- `hooks/useSpeechRecognition.ts` — expo-speech-recognition wrapper
- `utils/conversationManager.ts` — conversation history storage
- `utils/commandParser.ts` — fast-path keyword command parser
- `utils/intentEngine.ts` — fuzzy NLU fallback
