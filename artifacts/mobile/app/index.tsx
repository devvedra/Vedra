/**
 * Vedra — Voice Screen (v0.8)
 *
 * New in v0.8:
 *  - Intent recognition: NLP engine handles varied phrasings
 *  - Local memory: remembers user name, frequent contacts/apps
 *  - Conversation context: pronoun resolution ("him" → Rahul)
 *  - Study assistant: study timers, reminders, checklist
 *  - Small talk: friendly responses to greetings/questions
 *  - Unknown command: graceful fallback with suggestions
 *  - Intent/memory/study UI panels
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// ── Hooks ─────────────────────────────────────────────────────────────────────
import { useColors } from '@/hooks/useColors';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useTimerManager } from '@/hooks/useTimerManager';
import { useStopwatch } from '@/hooks/useStopwatch';

// ── Utilities ─────────────────────────────────────────────────────────────────
import { parseCommand } from '@/utils/commandParser';
import { launchApp } from '@/utils/appLauncher';
import {
  findContactsByName,
  requestContactsPermission,
  type ContactMatch,
} from '@/utils/contactsManager';
import { initiateCall } from '@/utils/phoneCall';
import { sendSms, requestSmsPermission } from '@/utils/smsManager';
import { setAlarm, cancelAlarm, listAlarms } from '@/utils/alarmManager';
import { cancelTimer, queryTimer } from '@/utils/timerManager';
import { createReminder, listReminders, deleteReminder } from '@/utils/reminderManager';
import { createCalendarEvent, listTodayEvents, deleteCalendarEvent } from '@/utils/calendarManager';
import { formatElapsed } from '@/utils/timeParser';
// ── v0.6 Device Controls ──────────────────────────────────────────────────────
import { setFlashlight } from '@/utils/flashlightManager';
import { volumeUp, volumeDown, setVolumeTo, muteVolume, maxVolume } from '@/utils/volumeManager';
import { brightnessUp, brightnessDown, setBrightnessTo, setBrightnessMin, setBrightnessMax } from '@/utils/brightnessManager';
import { getBatteryInfo } from '@/utils/batteryManager';
import { wifiOn, wifiOff, bluetoothOn, bluetoothOff } from '@/utils/connectivityManager';
// ── v0.8 New modules ──────────────────────────────────────────────────────────
import {
  setUserName, getUserName,
  recordContactUsage, recordAppUsage, recordCommand,
} from '@/utils/memoryManager';
import {
  updateContact, updateApp, addTurn, resolvePronouns,
} from '@/utils/conversationContext';
import { getSmallTalkResponse, getUnknownResponse } from '@/utils/smallTalkManager';
import {
  getTodayStudyReminders, buildStudyChecklist, toggleChecklistItem,
} from '@/utils/studyAssistant';

// ── Components ────────────────────────────────────────────────────────────────
import MicButton from '@/components/MicButton';
import ListeningWave from '@/components/ListeningWave';
import StatusText from '@/components/StatusText';
import TranscriptCard from '@/components/TranscriptCard';
import CommandFeedback, { type FeedbackState } from '@/components/CommandFeedback';
import CallFeedback, { type CallFeedbackState } from '@/components/CallFeedback';
import SmsFeedback, { type SmsFeedbackState } from '@/components/SmsFeedback';
import AlarmFeedback, { type AlarmFeedbackState } from '@/components/AlarmFeedback';
import TimerDisplay from '@/components/TimerDisplay';
import StopwatchDisplay from '@/components/StopwatchDisplay';
import ReminderFeedback, { type ReminderFeedbackState } from '@/components/ReminderFeedback';
import CalendarFeedback, { type CalendarFeedbackState } from '@/components/CalendarFeedback';
import DeviceControlFeedback, { type DeviceControlState } from '@/components/DeviceControlFeedback';
// ── v0.8 New components ───────────────────────────────────────────────────────
import MemoryFeedback, { type MemoryFeedbackState } from '@/components/MemoryFeedback';
import SmallTalkFeedback, { type SmallTalkState } from '@/components/SmallTalkFeedback';
import StudyFeedback, { type StudyFeedbackState } from '@/components/StudyFeedback';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

type ActivePanel =
  | 'none'
  | 'open_app'
  | 'call'
  | 'sms'
  | 'alarm'
  | 'timer_result'
  | 'reminder'
  | 'calendar'
  | 'device'
  | 'memory'
  | 'small_talk'
  | 'study';

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function VoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // ── Voice ──────────────────────────────────────────────────────────────────
  const {
    state: voiceState,
    transcript,
    partialTranscript,
    startListening,
    stopListening,
    reset: resetVoice,
  } = useSpeechRecognition();

  const { speak, stop: stopSpeaking } = useTextToSpeech();

  // ── Timer + Stopwatch hooks ────────────────────────────────────────────────
  const timerManager = useTimerManager(
    useCallback((display: string) => {
      speak(`Your ${display} timer is done!`);
    }, [speak]),
  );

  const stopwatch = useStopwatch();

  // ── v0.8: User's preferred name (loaded once) ──────────────────────────────
  const [preferredName, setPreferredName] = useState<string | undefined>(undefined);
  useEffect(() => {
    getUserName().then(n => setPreferredName(n)).catch(() => {});
  }, []);

  // ── Feedback panels ────────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [appFeedback,     setAppFeedback]     = useState<FeedbackState>({ phase: 'none' });
  const [callFeedback,    setCallFeedback]    = useState<CallFeedbackState>({ phase: 'none' });
  const [smsFeedback,     setSmsFeedback]     = useState<SmsFeedbackState>({ phase: 'none' });
  const [alarmFeedback,   setAlarmFeedback]   = useState<AlarmFeedbackState>({ phase: 'none' });
  const [reminderFeedback,setReminderFeedback]= useState<ReminderFeedbackState>({ phase: 'none' });
  const [calendarFeedback,setCalendarFeedback]= useState<CalendarFeedbackState>({ phase: 'none' });
  const [deviceFeedback,  setDeviceFeedback]  = useState<DeviceControlState>({ phase: 'none' });
  // ── v0.8 panels ────────────────────────────────────────────────────────────
  const [memoryFeedback,    setMemoryFeedback]   = useState<MemoryFeedbackState>({ phase: 'none' });
  const [smallTalkFeedback, setSmallTalkFeedback]= useState<SmallTalkState>({ phase: 'none' });
  const [studyFeedback,     setStudyFeedback]    = useState<StudyFeedbackState>({ phase: 'none' });

  // Prevent double-processing in React strict-mode
  const lastProcessed = useRef<string>('');

  // ── "Awaiting SMS message" state ───────────────────────────────────────────
  const pendingSmsRef = useRef<{
    contactName: string;
    contact: ContactMatch;
    transcript: string;
  } | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: clear all panels (called on mic reset)
  // ─────────────────────────────────────────────────────────────────────────────

  function clearAllPanels() {
    setActivePanel('none');
    setAppFeedback({ phase: 'none' });
    setCallFeedback({ phase: 'none' });
    setSmsFeedback({ phase: 'none' });
    setAlarmFeedback({ phase: 'none' });
    setReminderFeedback({ phase: 'none' });
    setCalendarFeedback({ phase: 'none' });
    setDeviceFeedback({ phase: 'none' });
    setMemoryFeedback({ phase: 'none' });
    setSmallTalkFeedback({ phase: 'none' });
    setStudyFeedback({ phase: 'none' });
    pendingSmsRef.current = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Core: process voice result
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (voiceState !== 'result' || !transcript) return;
    if (transcript === lastProcessed.current) return;
    lastProcessed.current = transcript;

    // ── SMS message body mode ──────────────────────────────────────────────
    if (pendingSmsRef.current) {
      const { contactName, contact, transcript: raw } = pendingSmsRef.current;
      pendingSmsRef.current = null;
      handleSmsMessage(raw, contactName, contact, transcript);
      return;
    }

    // ── v0.8: Pronoun resolution via conversation context ──────────────────
    const { resolved, didResolve } = resolvePronouns(transcript);
    const resolvedTranscript = resolved;

    const command = parseCommand(resolvedTranscript);

    // Record command for memory
    if (command) {
      recordCommand(resolvedTranscript, command.type).catch(() => {});
    }

    if (!command) {
      // Genuine unknown — give a helpful response
      const suggestion = getUnknownResponse(resolvedTranscript);
      setActivePanel('small_talk');
      setSmallTalkFeedback({ phase: 'unknown', transcript: resolvedTranscript, suggestion });
      speak(suggestion);
      addTurn(resolvedTranscript, 'UNKNOWN', suggestion);
      return;
    }

    switch (command.type) {
      case 'OPEN_APP':     handleOpenApp(resolvedTranscript, command.app);                         break;
      case 'CALL_CONTACT': handleCallContact(resolvedTranscript, command.contactName);             break;
      case 'SEND_SMS':     handleSendSms(resolvedTranscript, command.contactName, command.message);break;
      case 'SET_ALARM':    handleSetAlarm(command.hour, command.minute, command.timeDisplay);       break;
      case 'CANCEL_ALARM': handleCancelAlarm(command.timeDisplay);                                  break;
      case 'LIST_ALARMS':  handleListAlarms();                                                      break;
      case 'START_TIMER':  handleStartTimer(command.totalMs, command.durationDisplay);              break;
      case 'CANCEL_TIMER': handleCancelTimerCmd();                                                  break;
      case 'QUERY_TIMER':  handleQueryTimer();                                                      break;
      case 'STOPWATCH':    handleStopwatch(command.action);                                         break;
      case 'SET_REMINDER': handleSetReminder(command.message, command.timeDisplay, command.triggerMs); break;
      case 'LIST_REMINDERS': handleListReminders();                                                 break;
      case 'DELETE_REMINDER': handleDeleteReminder();                                               break;
      case 'CREATE_EVENT':    handleCreateEvent(command.title, command.timeDisplay, command.startMs, command.endMs); break;
      case 'LIST_EVENTS':     handleListEvents();                                                   break;
      case 'DELETE_EVENT':    handleDeleteEvent();                                                  break;
      // ── v0.6 Device Controls ──────────────────────────────────────────────
      case 'FLASHLIGHT_ON':   handleFlashlight(resolvedTranscript, true);                          break;
      case 'FLASHLIGHT_OFF':  handleFlashlight(resolvedTranscript, false);                         break;
      case 'VOLUME_UP':       handleVolumeChange(resolvedTranscript, 'up');                        break;
      case 'VOLUME_DOWN':     handleVolumeChange(resolvedTranscript, 'down');                      break;
      case 'VOLUME_SET':      handleVolumeChange(resolvedTranscript, 'set', command.percent);      break;
      case 'VOLUME_MUTE':     handleVolumeChange(resolvedTranscript, 'mute');                      break;
      case 'VOLUME_MAX':      handleVolumeChange(resolvedTranscript, 'max');                       break;
      case 'BRIGHTNESS_UP':   handleBrightnessChange(resolvedTranscript, 'up');                    break;
      case 'BRIGHTNESS_DOWN': handleBrightnessChange(resolvedTranscript, 'down');                  break;
      case 'BRIGHTNESS_SET':  handleBrightnessChange(resolvedTranscript, 'set', command.percent);  break;
      case 'BRIGHTNESS_MIN':  handleBrightnessChange(resolvedTranscript, 'min');                   break;
      case 'BRIGHTNESS_MAX':  handleBrightnessChange(resolvedTranscript, 'max');                   break;
      case 'BATTERY_STATUS':  handleBattery(resolvedTranscript);                                   break;
      case 'WIFI_ON':         handleConnectivity(resolvedTranscript, 'wifi_on');                   break;
      case 'WIFI_OFF':        handleConnectivity(resolvedTranscript, 'wifi_off');                  break;
      case 'BLUETOOTH_ON':    handleConnectivity(resolvedTranscript, 'bt_on');                     break;
      case 'BLUETOOTH_OFF':   handleConnectivity(resolvedTranscript, 'bt_off');                    break;
      // ── v0.8 Memory ───────────────────────────────────────────────────────
      case 'MEMORY_STORE_NAME': handleMemoryStoreName(command.name);                               break;
      case 'MEMORY_QUERY_NAME': handleMemoryQueryName();                                            break;
      // ── v0.8 Small Talk ───────────────────────────────────────────────────
      case 'SMALL_TALK': handleSmallTalk(command.input);                                           break;
      // ── v0.8 Study ────────────────────────────────────────────────────────
      case 'STUDY_TIMER':     handleStudyTimer(command.minutes, command.durationDisplay);          break;
      case 'STUDY_REMINDERS': handleStudyReminders();                                              break;
      case 'STUDY_CHECKLIST': handleStudyChecklist();                                              break;
      // ── v0.8 UNKNOWN fallback ─────────────────────────────────────────────
      case 'UNKNOWN': {
        const suggestion = getUnknownResponse(resolvedTranscript);
        setActivePanel('small_talk');
        setSmallTalkFeedback({ phase: 'unknown', transcript: resolvedTranscript, suggestion });
        speak(suggestion);
        addTurn(resolvedTranscript, 'UNKNOWN', suggestion);
        break;
      }
    }
  }, [voiceState, transcript]);

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN_APP handler
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleOpenApp(raw: string, app: Parameters<typeof launchApp>[0]) {
    setActivePanel('open_app');
    setAppFeedback({ phase: 'launching', transcript: raw, appName: app.displayName });
    speak(`Opening ${app.displayName}`);
    // v0.8: update context + memory
    updateApp(app.displayName);
    recordAppUsage(app.displayName, app.packageName).catch(() => {});
    const result = await launchApp(app);
    if (result.success) {
      setAppFeedback({ phase: 'success', transcript: raw, appName: app.displayName });
      addTurn(raw, 'OPEN_APP', `Opening ${app.displayName}`);
    } else {
      speak("I couldn't find that app.");
      setAppFeedback({ phase: 'failed', transcript: raw, appName: app.displayName });
      addTurn(raw, 'OPEN_APP', `Failed to open ${app.displayName}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL_CONTACT handler
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleCallContact(raw: string, contactName: string) {
    setActivePanel('call');
    setCallFeedback({ phase: 'searching', transcript: raw, contactName });

    const hasContacts = await requestContactsPermission();
    if (!hasContacts) {
      speak("I need access to your contacts to make calls.");
      setCallFeedback({ phase: 'contacts_error', transcript: raw, contactName, reason: 'Permission denied.' });
      return;
    }

    let matches: ContactMatch[];
    try { matches = await findContactsByName(contactName); }
    catch {
      speak("I couldn't access your contacts.");
      setCallFeedback({ phase: 'contacts_error', transcript: raw, contactName, reason: 'Failed to read contacts.' });
      return;
    }

    if (matches.length === 0) {
      speak(`I couldn't find ${contactName} in your contacts.`);
      setCallFeedback({ phase: 'not_found', transcript: raw, contactName });
    } else if (matches.length === 1) {
      await placeCall(raw, contactName, matches[0]);
    } else {
      speak(`I found ${matches.length} contacts. Please tap the one you want to call.`);
      setCallFeedback({ phase: 'multiple_found', transcript: raw, contactName, contacts: matches });
    }
  }

  const placeCall = useCallback(
    async (raw: string, contactName: string, contact: ContactMatch) => {
      setCallFeedback({ phase: 'calling', transcript: raw, contactName, contact });
      speak(`Calling ${contact.displayName}.`);
      // v0.8: update context + memory
      updateContact(contact.displayName, contact.phoneNumber);
      recordContactUsage(contact.displayName, contact.phoneNumber, 'call').catch(() => {});
      addTurn(raw, 'CALL_CONTACT', `Calling ${contact.displayName}`);
      const result = await initiateCall(contact.phoneNumber);
      if (result.success) {
        setCallFeedback({ phase: 'call_started', transcript: raw, contactName, contact, method: result.method });
      } else {
        speak("I couldn't place the call.");
        setCallFeedback({ phase: 'call_failed', transcript: raw, contactName, contact });
      }
    },
    [speak],
  );

  const handleContactSelected = useCallback(
    (contact: ContactMatch) => {
      if (callFeedback.phase !== 'multiple_found') return;
      const { transcript: raw, contactName } = callFeedback;
      placeCall(raw, contactName, contact);
    },
    [callFeedback, placeCall],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND_SMS handler
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleSendSms(raw: string, contactName: string, message?: string) {
    setActivePanel('sms');
    setSmsFeedback({ phase: 'searching', transcript: raw, contactName });

    const hasContacts = await requestContactsPermission();
    if (!hasContacts) {
      speak("I need access to your contacts to send messages.");
      setSmsFeedback({ phase: 'contacts_error', transcript: raw, contactName, reason: 'Permission denied.' });
      return;
    }

    let matches: ContactMatch[];
    try { matches = await findContactsByName(contactName); }
    catch {
      setSmsFeedback({ phase: 'contacts_error', transcript: raw, contactName, reason: 'Failed to read contacts.' });
      return;
    }

    if (matches.length === 0) {
      speak(`I couldn't find ${contactName} in your contacts.`);
      setSmsFeedback({ phase: 'not_found', transcript: raw, contactName });
      return;
    }

    const contact = matches[0];

    if (matches.length > 1) {
      setSmsFeedback({ phase: 'multiple_found', transcript: raw, contactName, contacts: matches });
      speak(`I found multiple contacts. Sending to ${matches[0].displayName}.`);
    }

    if (!message) {
      pendingSmsRef.current = { contactName, contact, transcript: raw };
      speak(`What would you like to say to ${contact.displayName}?`);
      setSmsFeedback({ phase: 'awaiting_message', transcript: raw, contactName, contact });
      setTimeout(() => startListening(), 2000);
      return;
    }

    await sendSmsToContact(raw, contactName, contact, message);
  }

  async function handleSmsMessage(raw: string, contactName: string, contact: ContactMatch, message: string) {
    setSmsFeedback({ phase: 'confirming', transcript: raw, contactName, contact, message });
    speak(`You said: ${message}. Sending now.`);
    await sendSmsToContact(raw, contactName, contact, message);
  }

  async function sendSmsToContact(raw: string, contactName: string, contact: ContactMatch, message: string) {
    setSmsFeedback({ phase: 'sending', transcript: raw, contactName, contact, message });

    await requestSmsPermission();
    const result = await sendSms(contact.phoneNumber, message);

    if (result.success) {
      speak(`Message sent to ${contact.displayName}.`);
      // v0.8: update context + memory
      updateContact(contact.displayName, contact.phoneNumber);
      recordContactUsage(contact.displayName, contact.phoneNumber, 'sms').catch(() => {});
      addTurn(raw, 'SEND_SMS', `Sent message to ${contact.displayName}`);
      setSmsFeedback({ phase: 'sent', transcript: raw, contactName, contact, message });
    } else {
      speak("I couldn't send the message.");
      setSmsFeedback({ phase: 'failed', transcript: raw, contactName, contact, message, reason: result.message });
    }
  }

  const handleSmsContactSelected = useCallback(
    (contact: ContactMatch) => {
      if (smsFeedback.phase !== 'multiple_found') return;
      const { transcript: raw, contactName } = smsFeedback;
      pendingSmsRef.current = { contactName, contact, transcript: raw };
      speak(`What would you like to say to ${contact.displayName}?`);
      setSmsFeedback({ phase: 'awaiting_message', transcript: raw, contactName, contact });
      setTimeout(() => startListening(), 2000);
    },
    [smsFeedback, speak, startListening],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ALARM handlers
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleSetAlarm(hour: number, minute: number, timeDisplay: string) {
    setActivePanel('alarm');
    setAlarmFeedback({ phase: 'setting' });
    speak(`Setting alarm for ${timeDisplay}.`);
    const result = await setAlarm(hour, minute);
    if (result.success && result.alarm) {
      setAlarmFeedback({ phase: 'set', alarm: result.alarm });
    } else {
      speak("I couldn't set the alarm.");
      setAlarmFeedback({ phase: 'failed', message: result.message });
    }
  }

  async function handleCancelAlarm(timeDisplay?: string) {
    setActivePanel('alarm');
    const result = await cancelAlarm();
    if (result.success && result.alarm) {
      speak(result.message);
      setAlarmFeedback({ phase: 'cancelled', alarm: result.alarm });
    } else {
      speak(result.message);
      setAlarmFeedback({ phase: 'cancel_failed', message: result.message });
    }
  }

  async function handleListAlarms() {
    setActivePanel('alarm');
    const alarms = await listAlarms();
    if (alarms.length === 0) {
      speak("You have no alarms set.");
    } else {
      speak(`You have ${alarms.length} alarm${alarms.length !== 1 ? 's' : ''}: ${alarms.map(a => a.display).join(', ')}.`);
    }
    setAlarmFeedback({ phase: 'list', alarms });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMER handlers
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleStartTimer(totalMs: number, durationDisplay: string) {
    await timerManager.startNewTimer(totalMs, durationDisplay);
    speak(`${durationDisplay} timer started.`);
    setActivePanel('none');
  }

  async function handleCancelTimerCmd() {
    const result = await timerManager.cancelActiveTimer();
    speak(result.message);
    setActivePanel('timer_result');
    setAlarmFeedback({ phase: 'none' });
  }

  async function handleQueryTimer() {
    const { message } = await queryTimer();
    speak(message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOPWATCH handler
  // ═══════════════════════════════════════════════════════════════════════════

  function handleStopwatch(action: 'start' | 'pause' | 'resume' | 'stop' | 'reset' | 'query') {
    if (action === 'query') {
      const ms = stopwatch.state.elapsedMs;
      const display = formatElapsed(ms);
      if (stopwatch.state.status === 'idle' && ms === 0) {
        speak("The stopwatch is not running.");
      } else {
        speak(`Elapsed time: ${display}.`);
      }
      return;
    }
    const result = stopwatch.dispatch(action);
    speak(result.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REMINDER handlers
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleSetReminder(message: string, timeDisplay: string, triggerMs: number) {
    setActivePanel('reminder');
    setReminderFeedback({ phase: 'setting' });
    const result = await createReminder(message, triggerMs, timeDisplay);
    if (result.success && result.reminder) {
      speak(`Reminder set for ${timeDisplay}: ${message}.`);
      setReminderFeedback({ phase: 'set', reminder: result.reminder });
    } else {
      speak(result.message);
      setReminderFeedback({ phase: 'failed', message: result.message });
    }
  }

  async function handleListReminders() {
    setActivePanel('reminder');
    const result = await listReminders();
    speak(result.message);
    setReminderFeedback({ phase: 'list', reminders: result.reminders ?? [] });
  }

  async function handleDeleteReminder() {
    setActivePanel('reminder');
    const result = await deleteReminder();
    speak(result.message);
    if (result.success && result.reminder) {
      setReminderFeedback({ phase: 'deleted', reminder: result.reminder });
    } else {
      setReminderFeedback({ phase: 'delete_failed', message: result.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR handlers
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleCreateEvent(title: string, timeDisplay: string, startMs: number, endMs: number) {
    setActivePanel('calendar');
    setCalendarFeedback({ phase: 'creating' });
    const result = await createCalendarEvent(title, startMs, endMs, timeDisplay);
    if (result.success && result.event) {
      speak(`${title} added to your calendar for ${timeDisplay}.`);
      setCalendarFeedback({ phase: 'created', event: result.event });
    } else {
      speak(result.message);
      setCalendarFeedback({ phase: 'failed', message: result.message });
    }
  }

  async function handleListEvents() {
    setActivePanel('calendar');
    const result = await listTodayEvents();
    speak(result.message);
    if (result.success) {
      setCalendarFeedback({ phase: 'list', events: result.events ?? [] });
    } else {
      setCalendarFeedback({ phase: 'list_failed', message: result.message });
    }
  }

  async function handleDeleteEvent() {
    setActivePanel('calendar');
    const result = await listTodayEvents();
    if (!result.success || !result.events || result.events.length === 0) {
      speak("No events to delete today.");
      setCalendarFeedback({ phase: 'list_failed', message: 'No events found today.' });
      return;
    }
    if (result.events.length === 1) {
      await doDeleteEvent(result.events[0]);
    } else {
      speak("Which event would you like to delete? Tap it below.");
      setCalendarFeedback({ phase: 'delete_confirm', events: result.events });
    }
  }

  const doDeleteEvent = useCallback(async (event: import('@/utils/calendarManager').CalendarEventInfo) => {
    const del = await deleteCalendarEvent(event.id, event.title);
    if (del.success) {
      speak(del.message);
      setCalendarFeedback({ phase: 'deleted', title: event.title });
    } else {
      speak(del.message);
      setCalendarFeedback({ phase: 'delete_failed', message: del.message });
    }
  }, [speak]);

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.6 DEVICE CONTROL handlers
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleFlashlight(raw: string, on: boolean) {
    const label = on ? 'Flashlight On' : 'Flashlight Off';
    setActivePanel('device');
    setDeviceFeedback({ phase: 'working', transcript: raw, commandLabel: label });
    const result = await setFlashlight(on);
    if (result.success) {
      speak(result.message);
      setDeviceFeedback({ phase: 'success', transcript: raw, commandLabel: label, detail: result.message });
    } else {
      speak(result.message);
      setDeviceFeedback({ phase: 'failed', transcript: raw, commandLabel: label, detail: result.message });
    }
  }

  async function handleVolumeChange(
    raw: string,
    action: 'up' | 'down' | 'set' | 'mute' | 'max',
    percent?: number,
  ) {
    const labelMap = { up: 'Volume Up', down: 'Volume Down', set: `Volume → ${percent}%`, mute: 'Mute', max: 'Max Volume' };
    const label = labelMap[action];
    setActivePanel('device');
    setDeviceFeedback({ phase: 'working', transcript: raw, commandLabel: label });

    let result;
    if (action === 'up')   result = await volumeUp();
    else if (action === 'down') result = await volumeDown();
    else if (action === 'set' && percent !== undefined) result = await setVolumeTo(percent);
    else if (action === 'mute') result = await muteVolume();
    else result = await maxVolume();

    if (result.success) {
      speak(result.message);
      setDeviceFeedback({ phase: 'success', transcript: raw, commandLabel: label, detail: result.message });
    } else {
      speak(result.message);
      setDeviceFeedback({ phase: 'failed', transcript: raw, commandLabel: label, detail: result.message });
    }
  }

  async function handleBrightnessChange(
    raw: string,
    action: 'up' | 'down' | 'set' | 'min' | 'max',
    percent?: number,
  ) {
    const labelMap = { up: 'Brightness Up', down: 'Brightness Down', set: `Brightness → ${percent}%`, min: 'Min Brightness', max: 'Max Brightness' };
    const label = labelMap[action];
    setActivePanel('device');
    setDeviceFeedback({ phase: 'working', transcript: raw, commandLabel: label });

    let result;
    if (action === 'up')   result = await brightnessUp();
    else if (action === 'down') result = await brightnessDown();
    else if (action === 'set' && percent !== undefined) result = await setBrightnessTo(percent);
    else if (action === 'min') result = await setBrightnessMin();
    else result = await setBrightnessMax();

    if (result.success) {
      speak(result.message);
      setDeviceFeedback({ phase: 'success', transcript: raw, commandLabel: label, detail: result.message });
    } else {
      speak(result.message);
      setDeviceFeedback({ phase: 'failed', transcript: raw, commandLabel: label, detail: result.message });
    }
  }

  async function handleBattery(raw: string) {
    setActivePanel('device');
    setDeviceFeedback({ phase: 'working', transcript: raw, commandLabel: 'Battery Status' });
    const result = await getBatteryInfo();
    if (result.success) {
      speak(result.message);
      setDeviceFeedback({ phase: 'success', transcript: raw, commandLabel: 'Battery Status', detail: result.message });
    } else {
      speak(result.message);
      setDeviceFeedback({ phase: 'failed', transcript: raw, commandLabel: 'Battery Status', detail: result.message });
    }
  }

  async function handleConnectivity(
    raw: string,
    action: 'wifi_on' | 'wifi_off' | 'bt_on' | 'bt_off',
  ) {
    const labelMap = { wifi_on: 'Wi-Fi On', wifi_off: 'Wi-Fi Off', bt_on: 'Bluetooth On', bt_off: 'Bluetooth Off' };
    const label = labelMap[action];
    setActivePanel('device');
    setDeviceFeedback({ phase: 'working', transcript: raw, commandLabel: label });

    let result;
    if (action === 'wifi_on')  result = await wifiOn();
    else if (action === 'wifi_off') result = await wifiOff();
    else if (action === 'bt_on')    result = await bluetoothOn();
    else result = await bluetoothOff();

    speak(result.message);
    if (result.success) {
      const phase = result.openedSettings ? 'settings' : 'success';
      setDeviceFeedback({ phase, transcript: raw, commandLabel: label, detail: result.message });
    } else {
      setDeviceFeedback({ phase: 'failed', transcript: raw, commandLabel: label, detail: result.message });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.8 MEMORY handlers
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleMemoryStoreName(name: string) {
    setActivePanel('memory');
    await setUserName(name);
    setPreferredName(name);
    const response = `Got it! I'll call you ${name}.`;
    speak(response);
    setMemoryFeedback({ phase: 'stored', key: 'Name', value: name });
    addTurn(`My name is ${name}`, 'MEMORY_STORE_NAME', response);
  }

  async function handleMemoryQueryName() {
    setActivePanel('memory');
    const name = await getUserName();
    if (name) {
      const response = `Your name is ${name}.`;
      speak(response);
      setMemoryFeedback({ phase: 'recalled', key: 'Name', value: name });
      addTurn("What's my name?", 'MEMORY_QUERY_NAME', response);
    } else {
      const response = "I don't know your name yet. Tell me by saying 'My name is...'";
      speak(response);
      setMemoryFeedback({ phase: 'not_found', key: 'name' });
      addTurn("What's my name?", 'MEMORY_QUERY_NAME', response);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.8 SMALL TALK handler
  // ═══════════════════════════════════════════════════════════════════════════

  function handleSmallTalk(input: string) {
    setActivePanel('small_talk');
    const response = getSmallTalkResponse(input);
    speak(response);
    setSmallTalkFeedback({ phase: 'response', response });
    addTurn(input, 'SMALL_TALK', response);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.8 STUDY handlers
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleStudyTimer(minutes: number, durationDisplay: string) {
    const totalMs = minutes * 60 * 1000;
    await timerManager.startNewTimer(totalMs, `${minutes} minute`);
    const greeting = preferredName ? `Go for it, ${preferredName}!` : 'Stay focused!';
    const response = `${minutes}-minute study timer started. ${greeting}`;
    speak(response);
    setActivePanel('study');
    setStudyFeedback({ phase: 'timer_started', minutes });
    addTurn(`Start ${minutes} minute study timer`, 'STUDY_TIMER', response);
  }

  async function handleStudyReminders() {
    setActivePanel('study');
    const reminders = await getTodayStudyReminders();
    if (reminders.length === 0) {
      speak("You have no study reminders for today. Try: 'Remind me to revise Chemistry at 7 PM'.");
      setStudyFeedback({ phase: 'no_study_data' });
    } else {
      const count = reminders.length;
      speak(`You have ${count} study reminder${count !== 1 ? 's' : ''} today: ${reminders.map(r => r.message).join(', ')}.`);
      setStudyFeedback({ phase: 'reminders', reminders });
    }
    addTurn("Show study reminders", 'STUDY_REMINDERS', `${reminders.length} reminders found`);
  }

  async function handleStudyChecklist() {
    setActivePanel('study');
    const { items, generated } = await buildStudyChecklist();
    if (items.length === 0) {
      speak("No checklist items yet. Add study reminders to auto-generate your checklist.");
      setStudyFeedback({ phase: 'no_study_data' });
    } else {
      speak(`Your study checklist has ${items.length} item${items.length !== 1 ? 's' : ''}.`);
      setStudyFeedback({ phase: 'checklist', items, generated });
    }
    addTurn("Show study checklist", 'STUDY_CHECKLIST', `${items.length} items`);
  }

  const handleToggleChecklistItem = useCallback(async (id: string) => {
    await toggleChecklistItem(id);
    // Re-fetch and update state
    const { items, generated } = await buildStudyChecklist();
    setStudyFeedback(s => s.phase === 'checklist' ? { phase: 'checklist', items, generated } : s);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Mic button handler
  // ═══════════════════════════════════════════════════════════════════════════

  const handleMicPress = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (voiceState === 'listening') {
      await stopListening();
    } else if (voiceState === 'result' || voiceState === 'error') {
      lastProcessed.current = '';
      clearAllPanels();
      stopSpeaking();
      resetVoice();
      setTimeout(startListening, 120);
    } else if (voiceState === 'idle') {
      lastProcessed.current = '';
      clearAllPanels();
      await startListening();
    } else if (voiceState === 'processing') {
      // Do nothing — wait for result
    }
  }, [voiceState, startListening, stopListening, stopSpeaking, resetVoice]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Render helpers
  // ═══════════════════════════════════════════════════════════════════════════

  const showLiveTranscript = (voiceState === 'listening' || voiceState === 'processing') && !!partialTranscript;
  const showHint = activePanel === 'none' && !showLiveTranscript && timerManager.state.isIdle && stopwatch.state.status === 'idle';

  const greetName = preferredName ? `, ${preferredName}` : '';

  const HINTS = [
    '"Call Mom"  ·  "Text Rahul I\'ll be late"  ·  "Open WhatsApp"',
    '"I want to use Chrome"  ·  "Start WhatsApp"  ·  "Launch Netflix"',
    '"Set alarm for 6 AM"  ·  "Start a 10 minute timer"',
    '"Start a 25-minute study timer"  ·  "Show my study checklist"',
    '"My name is Rahul"  ·  "What\'s my name?"',
    '"Turn on flashlight"  ·  "Volume up"  ·  "Battery percentage"',
    '"Who are you?"  ·  "What can you do?"  ·  "Good morning"',
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0),
        },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: 'rgba(124,58,237,0.18)', borderColor: 'rgba(124,58,237,0.35)' }]}>
            <View style={[styles.badgeDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.badgeText, { color: colors.accent }]}>AI ASSISTANT · v0.8</Text>
          </View>
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>VEDRA</Text>
        <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
          {preferredName
            ? `Hello${greetName}! Speak naturally.`
            : 'Speak naturally. I\'ll take care of it.'}
        </Text>
      </View>

      {/* ── Centre: mic + wave ─────────────────────────────────────────────── */}
      <View style={styles.centre}>
        <View style={styles.waveContainer}>
          <ListeningWave isListening={voiceState === 'listening'} />
        </View>
        <MicButton state={voiceState} onPress={handleMicPress} />
        <View style={styles.statusContainer}>
          <StatusText state={voiceState} />
        </View>
      </View>

      {/* ── Bottom: persistent + feedback panels ───────────────────────────── */}
      <ScrollView
        style={styles.bottomScroll}
        contentContainerStyle={styles.bottomContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Always-visible: Timer countdown ── */}
        <TimerDisplay
          state={timerManager.state}
          onCancel={timerManager.cancelActiveTimer}
          onDismiss={timerManager.dismissCompleted}
        />

        {/* ── Always-visible: Stopwatch ── */}
        <StopwatchDisplay
          state={stopwatch.state}
          onAction={stopwatch.dispatch}
        />

        {/* ── Live partial transcript ── */}
        {showLiveTranscript && (
          <TranscriptCard transcript={partialTranscript} isSpeaking={false} />
        )}

        {/* ── App-open feedback ── */}
        {activePanel === 'open_app' && <CommandFeedback state={appFeedback} />}

        {/* ── Call feedback ── */}
        {activePanel === 'call' && (
          <CallFeedback state={callFeedback} onContactSelected={handleContactSelected} />
        )}

        {/* ── SMS feedback ── */}
        {activePanel === 'sms' && (
          <SmsFeedback state={smsFeedback} onContactSelected={handleSmsContactSelected} />
        )}

        {/* ── Alarm feedback ── */}
        {activePanel === 'alarm' && <AlarmFeedback state={alarmFeedback} />}

        {/* ── Reminder feedback ── */}
        {activePanel === 'reminder' && <ReminderFeedback state={reminderFeedback} />}

        {/* ── Calendar feedback ── */}
        {activePanel === 'calendar' && (
          <CalendarFeedback state={calendarFeedback} onDeleteEvent={doDeleteEvent} />
        )}

        {/* ── Device control feedback (v0.6) ── */}
        {activePanel === 'device' && <DeviceControlFeedback state={deviceFeedback} />}

        {/* ── v0.8: Memory feedback ── */}
        {activePanel === 'memory' && <MemoryFeedback state={memoryFeedback} />}

        {/* ── v0.8: Small talk / unknown ── */}
        {activePanel === 'small_talk' && <SmallTalkFeedback state={smallTalkFeedback} />}

        {/* ── v0.8: Study assistant ── */}
        {activePanel === 'study' && (
          <StudyFeedback state={studyFeedback} onToggleItem={handleToggleChecklistItem} />
        )}

        {/* ── Idle hints ── */}
        {showHint && (
          <View style={styles.emptyCard}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {voiceState === 'unavailable'
                ? 'Build the APK to enable voice recognition on your device'
                : HINTS.map((h, i) => (i === HINTS.length - 1 ? h : `${h}\n`)).join('')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },

  header: { alignItems: 'center', paddingTop: 20, gap: 8 },
  badgeRow: { marginBottom: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 100, borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5 },
  appName: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: 10 },
  appTagline: { fontSize: 13, fontFamily: 'Inter_400Regular', letterSpacing: 0.3, opacity: 0.55 },

  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 280,
  },
  waveContainer:   { height: 52, justifyContent: 'center' },
  statusContainer: { marginTop: 16, height: 24, justifyContent: 'center' },

  bottomScroll:  { flexShrink: 1 },
  bottomContent: { paddingBottom: 28, flexGrow: 1, justifyContent: 'flex-end' },

  emptyCard: { paddingVertical: 20, alignItems: 'center' },
  hint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
});
