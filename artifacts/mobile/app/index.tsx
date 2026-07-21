/**
 * Vedra — Voice Screen (v0.6)
 *
 * Extends v0.5 with: Flashlight, Volume, Brightness, Battery, Wi-Fi, Bluetooth.
 *
 * All features work 100% offline using Android's official APIs.
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
  | 'device';

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

  // ── Feedback panels ────────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [appFeedback,     setAppFeedback]     = useState<FeedbackState>({ phase: 'none' });
  const [callFeedback,    setCallFeedback]    = useState<CallFeedbackState>({ phase: 'none' });
  const [smsFeedback,     setSmsFeedback]     = useState<SmsFeedbackState>({ phase: 'none' });
  const [alarmFeedback,   setAlarmFeedback]   = useState<AlarmFeedbackState>({ phase: 'none' });
  const [reminderFeedback,setReminderFeedback]= useState<ReminderFeedbackState>({ phase: 'none' });
  const [calendarFeedback,setCalendarFeedback]= useState<CalendarFeedbackState>({ phase: 'none' });
  const [deviceFeedback,  setDeviceFeedback]  = useState<DeviceControlState>({ phase: 'none' });

  // Prevent double-processing in React strict-mode
  const lastProcessed = useRef<string>('');

  // ── "Awaiting SMS message" state ───────────────────────────────────────────
  const pendingSmsRef = useRef<{
    contactName: string;
    contact: ContactMatch;
    transcript: string;
  } | null>(null);

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

    const command = parseCommand(transcript);

    if (!command) {
      setActivePanel('none');
      speak(`I heard: ${transcript}`);
      return;
    }

    switch (command.type) {
      case 'OPEN_APP':     handleOpenApp(transcript, command.app);                         break;
      case 'CALL_CONTACT': handleCallContact(transcript, command.contactName);             break;
      case 'SEND_SMS':     handleSendSms(transcript, command.contactName, command.message);break;
      case 'SET_ALARM':    handleSetAlarm(command.hour, command.minute, command.timeDisplay);break;
      case 'CANCEL_ALARM': handleCancelAlarm(command.timeDisplay);                         break;
      case 'LIST_ALARMS':  handleListAlarms();                                             break;
      case 'START_TIMER':  handleStartTimer(command.totalMs, command.durationDisplay);     break;
      case 'CANCEL_TIMER': handleCancelTimerCmd();                                         break;
      case 'QUERY_TIMER':  handleQueryTimer();                                             break;
      case 'STOPWATCH':    handleStopwatch(command.action);                                break;
      case 'SET_REMINDER': handleSetReminder(command.message, command.timeDisplay, command.triggerMs); break;
      case 'LIST_REMINDERS': handleListReminders();                                        break;
      case 'DELETE_REMINDER': handleDeleteReminder();                                      break;
      case 'CREATE_EVENT':    handleCreateEvent(command.title, command.timeDisplay, command.startMs, command.endMs); break;
      case 'LIST_EVENTS':     handleListEvents();                                                   break;
      case 'DELETE_EVENT':    handleDeleteEvent();                                                   break;
      // ── v0.6 Device Controls ──────────────────────────────────────────────
      case 'FLASHLIGHT_ON':   handleFlashlight(transcript, true);                                   break;
      case 'FLASHLIGHT_OFF':  handleFlashlight(transcript, false);                                  break;
      case 'VOLUME_UP':       handleVolumeChange(transcript, 'up');                                 break;
      case 'VOLUME_DOWN':     handleVolumeChange(transcript, 'down');                               break;
      case 'VOLUME_SET':      handleVolumeChange(transcript, 'set', command.percent);               break;
      case 'VOLUME_MUTE':     handleVolumeChange(transcript, 'mute');                               break;
      case 'VOLUME_MAX':      handleVolumeChange(transcript, 'max');                                break;
      case 'BRIGHTNESS_UP':   handleBrightnessChange(transcript, 'up');                             break;
      case 'BRIGHTNESS_DOWN': handleBrightnessChange(transcript, 'down');                           break;
      case 'BRIGHTNESS_SET':  handleBrightnessChange(transcript, 'set', command.percent);           break;
      case 'BRIGHTNESS_MIN':  handleBrightnessChange(transcript, 'min');                            break;
      case 'BRIGHTNESS_MAX':  handleBrightnessChange(transcript, 'max');                            break;
      case 'BATTERY_STATUS':  handleBattery(transcript);                                            break;
      case 'WIFI_ON':         handleConnectivity(transcript, 'wifi_on');                            break;
      case 'WIFI_OFF':        handleConnectivity(transcript, 'wifi_off');                           break;
      case 'BLUETOOTH_ON':    handleConnectivity(transcript, 'bt_on');                              break;
      case 'BLUETOOTH_OFF':   handleConnectivity(transcript, 'bt_off');                             break;
    }
  }, [voiceState, transcript]);

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN_APP handler
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleOpenApp(raw: string, app: Parameters<typeof launchApp>[0]) {
    setActivePanel('open_app');
    setAppFeedback({ phase: 'launching', transcript: raw, appName: app.displayName });
    speak(`Opening ${app.displayName}`);
    const result = await launchApp(app);
    if (result.success) {
      setAppFeedback({ phase: 'success', transcript: raw, appName: app.displayName });
    } else {
      speak("I couldn't find that app.");
      setAppFeedback({ phase: 'failed', transcript: raw, appName: app.displayName });
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

    const contact = matches.length === 1 ? matches[0] : matches[0]; // pick first for simplicity

    if (matches.length > 1) {
      setSmsFeedback({ phase: 'multiple_found', transcript: raw, contactName, contacts: matches });
      speak(`I found multiple contacts. Sending to ${matches[0].displayName}.`);
    }

    if (!message) {
      // Ask user to speak the message
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
    const result = await timerManager.startNewTimer(totalMs, durationDisplay);
    speak(`${durationDisplay} timer started.`);
    // The TimerDisplay component shows the countdown; no panel needed
    setActivePanel('none');
  }

  async function handleCancelTimerCmd() {
    const result = await timerManager.cancelActiveTimer();
    speak(result.message);
    setActivePanel('timer_result');
    setAlarmFeedback({ phase: 'none' }); // just surface the message via TTS
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
      // Delete the only event
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
  // Mic button handler
  // ═══════════════════════════════════════════════════════════════════════════

  const handleMicPress = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (voiceState === 'listening') {
      await stopListening();
    } else if (voiceState === 'result' || voiceState === 'error') {
      lastProcessed.current = '';
      setActivePanel('none');
      setAppFeedback({ phase: 'none' });
      setCallFeedback({ phase: 'none' });
      setSmsFeedback({ phase: 'none' });
      setAlarmFeedback({ phase: 'none' });
      setReminderFeedback({ phase: 'none' });
      setCalendarFeedback({ phase: 'none' });
      setDeviceFeedback({ phase: 'none' });
      pendingSmsRef.current = null;
      stopSpeaking();
      resetVoice();
      setTimeout(startListening, 120);
    } else if (voiceState === 'idle') {
      lastProcessed.current = '';
      setActivePanel('none');
      setAppFeedback({ phase: 'none' });
      setCallFeedback({ phase: 'none' });
      setSmsFeedback({ phase: 'none' });
      setAlarmFeedback({ phase: 'none' });
      setReminderFeedback({ phase: 'none' });
      setCalendarFeedback({ phase: 'none' });
      setDeviceFeedback({ phase: 'none' });
      pendingSmsRef.current = null;
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

  const HINTS = [
    '"Set alarm for 6 AM"  ·  "Start a 10 minute timer"',
    '"Turn on flashlight"  ·  "Torch off"',
    '"Volume up"  ·  "Set volume to 50 percent"',
    '"Battery percentage"  ·  "Max brightness"',
    '"Call Mom"  ·  "Open WhatsApp"  ·  "Start stopwatch"',
    '"Turn on Bluetooth"  ·  "Wi-Fi off"',
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
            <Text style={[styles.badgeText, { color: colors.accent }]}>AI ASSISTANT</Text>
          </View>
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>VEDRA</Text>
        <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
          Speak naturally. I'll take care of it.
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

        {/* ── Idle hints ── */}
        {showHint && (
          <View style={styles.emptyCard}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {voiceState === 'unavailable'
                ? 'Build the APK to enable voice recognition'
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
