---
name: Vedra v0.5 architecture
description: Module layout, command parser structure, and platform decisions for Vedra mobile app
---

## Key decisions

**Alarm implementation:** Uses Android `android.intent.action.SET_ALARM` intent via expo-intent-launcher (already installed). Stores metadata in AsyncStorage for listing. Cannot programmatically delete system alarms — opens clock app for user confirmation.

**Timer:** In-app countdown via `useTimerManager` hook polling timerManager every 500ms. Finish notification scheduled via expo-notifications. One active timer at a time (by design).

**Stopwatch:** Pure in-memory via stopwatchManager.ts; no persistence. Hook polls at 50ms for centisecond display.

**Reminders:** AsyncStorage + expo-notifications for scheduled local notifications. pruneOldReminders() called on app startup in _layout.tsx.

**Calendar:** expo-calendar (added in v0.5). Needs READ_CALENDAR + WRITE_CALENDAR permissions in app.json.

**Notifications:** expo-notifications (added in v0.5). initNotifications() called in _layout.tsx. Web preview shows deprecation warning — expected, not a bug.

**Command parser parsing order:** OPEN_APP → CALL_CONTACT → SEND_SMS → SET_ALARM → CANCEL_ALARM → LIST_ALARMS → START_TIMER → CANCEL_TIMER → QUERY_TIMER → STOPWATCH → SET_REMINDER → LIST_REMINDERS → DELETE_REMINDER → CREATE_EVENT → LIST_EVENTS → DELETE_EVENT.

**Why:** More specific commands (alarm, timer) come after existing ones (open/call/sms) to avoid false matches. Stopwatch reset/resume/pause parsed before start/stop to avoid partial keyword matches.

## Module locations
- `utils/timeParser.ts` — natural language time/duration parser (no deps)
- `utils/notificationManager.ts` — expo-notifications wrapper
- `utils/alarmManager.ts` — Android alarm intent + AsyncStorage
- `utils/timerManager.ts` — timer state + notifications
- `utils/stopwatchManager.ts` — in-memory stopwatch state machine
- `utils/reminderManager.ts` — reminder storage + notifications
- `utils/calendarManager.ts` — expo-calendar wrapper
- `hooks/useTimerManager.ts` — React hook driving timer UI
- `hooks/useStopwatch.ts` — React hook driving stopwatch UI (50ms tick)
