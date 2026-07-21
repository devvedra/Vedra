# Vedra v0.1 — Setup & Build Guide

## What is Vedra?

Vedra is an AI voice assistant mobile app built with React Native + Expo.
This first version focuses on the voice interface:

- **Speech-to-Text** via Android's SpeechRecognizer API (offline-first)
- **Text-to-Speech** via Android's TTS engine
- A clean, animated microphone button with visual feedback
- Proper microphone permission handling

---

## Project Structure

```
artifacts/mobile/
├── app/
│   ├── _layout.tsx              # Root layout with providers (fonts, safe area, query)
│   └── index.tsx                # Main voice screen (VoiceScreen)
├── components/
│   ├── MicButton.tsx            # Large animated circular microphone button
│   ├── ListeningWave.tsx        # Animated audio-waveform bars
│   ├── TranscriptCard.tsx       # Card that displays recognised text
│   └── StatusText.tsx           # One-line state description
├── hooks/
│   ├── useSpeechRecognition.ts  # Wraps @react-native-voice/voice
│   └── useTextToSpeech.ts       # Wraps expo-speech
├── constants/
│   └── colors.ts                # Design tokens (dark indigo theme)
└── app.json                     # Expo config with Android permissions
```

---

## Preview on Your Phone (Expo Go)

> **Note:** The web preview shows the UI but voice recognition is disabled
> because it requires native Android code. Use Expo Go on a real device to
> test the full experience.

1. Install **Expo Go** from the Google Play Store on your Android phone.
2. Open this project in Replit.
3. In the preview area, click the **QR code icon** in the URL bar.
4. Scan the QR code with the Expo Go app.
5. The app will load on your phone — tap the mic button to speak!

---

## Building an APK (Android)

### Option A — EAS Build (Recommended, free tier available)

EAS is Expo's hosted build service. No local Android SDK required.

```bash
# 1. Install EAS CLI globally (run once)
npm install -g eas-cli

# 2. Log in to your Expo account (create one free at expo.dev)
eas login

# 3. Initialise EAS in this project (run once)
cd artifacts/mobile
eas init

# 4. Build a development APK (installable on any Android device)
eas build --platform android --profile preview

# 5. When the build finishes, EAS prints a download URL.
#    Download the .apk file and install it on your Android device.
#    You may need to enable "Install unknown apps" in Android settings.
```

**EAS `eas.json` profile for a preview APK** — create this file in
`artifacts/mobile/eas.json`:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Option B — Local Android build (requires Android Studio)

```bash
# Pre-requisites: Android Studio, Java 17, Android SDK
cd artifacts/mobile

# Generate native Android project
npx expo prebuild --platform android

# Build debug APK
cd android && ./gradlew assembleRelease

# APK output: android/app/build/outputs/apk/release/app-release.apk
```

---

## Permissions Explained

| Permission | Why Vedra needs it |
|---|---|
| `RECORD_AUDIO` | To open the microphone and listen to your voice |
| `INTERNET` | For cloud-based speech recognition fallback |

The app asks for the microphone permission the first time you tap the mic
button. If you deny it, a clear message is shown. You can re-grant it from
Android Settings → Apps → Vedra → Permissions.

---

## How Voice Recognition Works

1. User taps the mic button → app requests `RECORD_AUDIO` permission.
2. `Voice.start('en-US', { EXTRA_PREFER_OFFLINE: true })` is called.
   - Android tries **on-device recognition first** (Google offline model).
   - Falls back to Google's cloud STT if offline isn't available.
3. Partial results appear on screen in real-time as you speak.
4. When you stop speaking, the final transcript is committed.
5. `expo-speech` reads back **"I heard: \<your words\>"** using Android TTS.

---

## Extending Vedra

The codebase is designed to be a foundation. Future additions can go into:

| What to add | Where |
|---|---|
| AI response (ChatGPT, Gemini…) | `hooks/useSpeechRecognition.ts` → call API on `result` |
| Conversation history | New `context/ConversationContext.tsx` |
| Wake word detection | New `hooks/useWakeWord.ts` |
| Settings screen | New `app/settings.tsx` |
| Custom TTS voice | `hooks/useTextToSpeech.ts` → add `voice` option |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Voice unavailable in preview" | This is expected in the web/Expo Go preview. Build the APK or scan the QR code with Expo Go on Android. |
| Mic button taps but nothing happens | Make sure you granted microphone permission |
| "No match" error | Speak more clearly or closer to the mic; try again |
| TTS not speaking | Check that your device isn't on silent/vibrate |
