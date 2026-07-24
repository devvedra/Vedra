/**
 * Vedra — Main Voice Screen (v1.0)
 *
 *  v0.1  Open Apps, Calls, SMS
 *  v0.2  Alarms, Timers, Stopwatch
 *  v0.3  Reminders, Calendar
 *  v0.4  Flashlight, Volume, Brightness, Battery, Wi-Fi, Bluetooth
 *  v0.5  Architecture refactor
 *  v0.6  Device Controls polish
 *  v0.7  Media Controls, Notification Reader, Device Info, Quick Actions
 *  v0.8  Memory (name recall), Study Assistant, Intent Engine fallback
 *  v0.9  Hybrid AI: offline-first + cloud AI router, conversation history
 *  v1.0  Plugin architecture, diagnostics, enhanced settings, error recovery
 *
 * All offline features work 100% without internet.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sidebar from '@/components/Sidebar';

// ── Hooks ─────────────────────────────────────────────────────────────────────
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useTimerManager } from '@/hooks/useTimerManager';
import { useStopwatch } from '@/hooks/useStopwatch';
import { useThemeColors } from '@/contexts/ThemeContext';

// ── Command parser + intent engine ────────────────────────────────────────────
import { parseCommand } from '@/utils/commandParser';
import { classifyIntent, getSmallTalkResponse, findAppByKeyword } from '@/utils/intentEngine';

// ── v0.1 Core utils ───────────────────────────────────────────────────────────
import { launchApp } from '@/utils/appLauncher';
import { findContactsByName, type ContactMatch } from '@/utils/contactsManager';
import { initiateCall } from '@/utils/phoneCall';
import { sendSms } from '@/utils/smsManager';

// ── v0.2 Time utils ───────────────────────────────────────────────────────────
import { setAlarm, listAlarms, cancelAlarm } from '@/utils/alarmManager';

// ── v0.3 Productivity utils ───────────────────────────────────────────────────
import { createReminder, listReminders, deleteReminder } from '@/utils/reminderManager';
import {
  createCalendarEvent, listTodayEvents, deleteCalendarEvent,
  type CalendarEventInfo,
} from '@/utils/calendarManager';

// ── v0.4/v0.6 Device Control utils ───────────────────────────────────────────
import { setFlashlight } from '@/utils/flashlightManager';
import { volumeUp, volumeDown, setVolumeTo, muteVolume, maxVolume } from '@/utils/volumeManager';
import { brightnessUp, brightnessDown, setBrightnessTo, setBrightnessMin, setBrightnessMax } from '@/utils/brightnessManager';
import { getBatteryInfo } from '@/utils/batteryManager';
import { wifiOn, wifiOff, bluetoothOn, bluetoothOff } from '@/utils/connectivityManager';

// ── v0.7 New Feature utils ────────────────────────────────────────────────────
import {
  mediaPlay, mediaPause, mediaPlayPause, mediaNext,
  mediaPrevious, mediaStop, mediaVolumeUp, mediaVolumeDown,
} from '@/utils/mediaController';
import {
  readAllNotifications, readLatestNotification,
  checkNewMessages, readAppNotifications, clearAllNotifications,
} from '@/utils/notificationReader';
import {
  getStorageInfo, getRamInfo, getBatteryHealth, getDeviceModel,
  getAndroidVersion, getDateTime, getAllDeviceInfo,
} from '@/utils/deviceInfoManager';
import {
  openRecentApps, goHome, openNotifications, openQuickSettings,
  openAppInfo, openWifiSettings, openBluetoothSettings, openDisplaySettings,
} from '@/utils/quickActionsManager';
import { trySmallTalk } from '@/utils/smallTalk';

// ── v0.8 Memory + Study utils ─────────────────────────────────────────────────
import { setUserName, getUserName } from '@/utils/memoryManager';
import {
  getTodayStudyReminders, getChecklist, buildStudyChecklist, toggleChecklistItem,
  type StudyReminder, type ChecklistItem,
} from '@/utils/studyAssistant';

// ── UI Components ─────────────────────────────────────────────────────────────
import MicButton from '@/components/MicButton';
import HeroWave from '@/components/HeroWave';
import { Feather } from '@expo/vector-icons';
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
import MediaFeedback, { type MediaFeedbackState } from '@/components/MediaFeedback';
import NotificationFeedback, { type NotificationFeedbackState } from '@/components/NotificationFeedback';
import DeviceInfoFeedback, { type DeviceInfoFeedbackState } from '@/components/DeviceInfoFeedback';
import QuickActionFeedback, { type QuickActionFeedbackState } from '@/components/QuickActionFeedback';
import MemoryFeedback, { type MemoryFeedbackState } from '@/components/MemoryFeedback';
import StudyFeedback, { type StudyFeedbackState } from '@/components/StudyFeedback';
import SmallTalkFeedback, { type SmallTalkState } from '@/components/SmallTalkFeedback';

// ── v0.9 AI + Privacy ─────────────────────────────────────────────────────────
import AIFeedback, { type AIFeedbackState } from '@/components/AIFeedback';
import ConversationHistory from '@/components/ConversationHistory';
import { routeToAI } from '@/utils/ai/aiRouter';
import {
  addConversationTurn, getConversationHistory, clearConversationHistory,
  type ConversationTurn,
} from '@/utils/conversationManager';

// ── v1.0 Plugin system + Error recovery ───────────────────────────────────────
import PluginFeedback, { type PluginFeedbackState } from '@/components/PluginFeedback';
import { PluginManager } from '@/utils/plugins/pluginManager';
import { initPlugins } from '@/utils/plugins/initPlugins';
import { logError } from '@/utils/errorLogger';
import { getSettings } from '@/utils/settingsStore';

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
  | 'media'
  | 'notifications'
  | 'device_info'
  | 'quick_action'
  | 'memory'
  | 'study'
  | 'small_talk'
  | 'ai'
  | 'plugin';

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function VoiceScreen() {
  const insets  = useSafeAreaInsets();
  const colors  = useThemeColors();

  // ── Hooks ────────────────────────────────────────────────────────────────────
  const { speak, stop: stopSpeaking } = useTextToSpeech();
  const {
    state: voiceState, transcript, partialTranscript,
    startListening, stopListening, reset: resetVoice,
  } = useSpeechRecognition();

  const timerManager = useTimerManager((display) => speak(`Timer finished! ${display} is up.`));
  const stopwatch    = useStopwatch();

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activePanel,    setActivePanel]    = useState<ActivePanel>('none');
  const [appFeedback,    setAppFeedback]    = useState<FeedbackState>({ phase: 'none' });
  const [callFeedback,   setCallFeedback]   = useState<CallFeedbackState>({ phase: 'none' });
  const [smsFeedback,    setSmsFeedback]    = useState<SmsFeedbackState>({ phase: 'none' });
  const [alarmFeedback,  setAlarmFeedback]  = useState<AlarmFeedbackState>({ phase: 'none' });
  const [reminderFeedback, setReminderFeedback] = useState<ReminderFeedbackState>({ phase: 'none' });
  const [calendarFeedback, setCalendarFeedback] = useState<CalendarFeedbackState>({ phase: 'none' });
  const [deviceFeedback,   setDeviceFeedback]   = useState<DeviceControlState>({ phase: 'none' });
  const [mediaFeedback,    setMediaFeedback]    = useState<MediaFeedbackState>({ phase: 'none' });
  const [notifFeedback,    setNotifFeedback]    = useState<NotificationFeedbackState>({ phase: 'none' });
  const [devInfoFeedback,  setDevInfoFeedback]  = useState<DeviceInfoFeedbackState>({ phase: 'none' });
  const [qaFeedback,       setQaFeedback]       = useState<QuickActionFeedbackState>({ phase: 'none' });
  const [memoryFeedback,   setMemoryFeedback]   = useState<MemoryFeedbackState>({ phase: 'none' });
  const [studyFeedback,    setStudyFeedback]    = useState<StudyFeedbackState>({ phase: 'none' });
  const [smallTalkFeedback,setSmallTalkFeedback]= useState<SmallTalkState>({ phase: 'none' });

  // ── v0.9 AI state ────────────────────────────────────────────────────────────
  const [aiFeedback,        setAiFeedback]        = useState<AIFeedbackState>({ phase: 'none' });
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [showHistory,       setShowHistory]       = useState(false);
  const [pluginFeedback,    setPluginFeedback]    = useState<PluginFeedbackState>({ phase: 'none' });

  // ── Sidebar + nav state ───────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav,   setActiveNav]   = useState('ask');

  // ── Text input dock state ─────────────────────────────────────────────────────
  const [dockText, setDockText] = useState('');

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const lastProcessed = useRef('');
  const pendingSmsRef = useRef<{ contact: ContactMatch; message: string } | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // Core command pipeline — shared by voice AND text input
  // ═══════════════════════════════════════════════════════════════════════════

  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // ── Handle pending SMS confirmation ──────────────────────────────────────
    if (pendingSmsRef.current) {
      const lc = text.toLowerCase();
      if (lc === 'yes' || lc === 'send' || lc === 'confirm' || lc === 'send it') {
        doSendSms(pendingSmsRef.current.contact, pendingSmsRef.current.message);
        return;
      } else if (lc === 'no' || lc === 'cancel' || lc === 'don\'t send' || lc === 'stop') {
        pendingSmsRef.current = null;
        setActivePanel('sms');
        setSmsFeedback(prev => prev.phase !== 'none' ? { ...prev, phase: 'cancelled' } as any : prev);
        speak('Message cancelled.');
        return;
      }
      // If they typed/spoke a new message body, use it
      if (lc.length > 3 && !lc.startsWith('send') && !lc.startsWith('cancel')) {
        pendingSmsRef.current = { ...pendingSmsRef.current, message: text };
        setSmsFeedback(prev => prev.phase !== 'none' ? { ...prev, message: text } as any : prev);
        speak(`Message updated. Say "send" to confirm, or "cancel".`);
        return;
      }
    }

    // ── Fast-path: keyword parser ────────────────────────────────────────────
    const command = parseCommand(text);

    if (command) {
      switch (command.type) {
        case 'OPEN_APP':     handleOpenApp(text, command.app);                           break;
        case 'CALL_CONTACT': handleCallContact(text, command.contactName);               break;
        case 'SEND_SMS':     handleSendSms(text, command.contactName, command.message);  break;
        case 'SET_ALARM':    handleSetAlarm(command.hour, command.minute, command.timeDisplay);break;
        case 'CANCEL_ALARM': handleCancelAlarm(command.timeDisplay);                     break;
        case 'LIST_ALARMS':  handleListAlarms();                                         break;
        case 'START_TIMER':  handleStartTimer(command.totalMs, command.durationDisplay); break;
        case 'CANCEL_TIMER': handleCancelTimerCmd();                                     break;
        case 'QUERY_TIMER':  handleQueryTimer();                                         break;
        case 'STOPWATCH':    handleStopwatch(command.action);                            break;
        case 'SET_REMINDER': handleSetReminder(command.message, command.timeDisplay, command.triggerMs); break;
        case 'LIST_REMINDERS':  handleListReminders();                                   break;
        case 'DELETE_REMINDER': handleDeleteReminder();                                  break;
        case 'CREATE_EVENT': handleCreateEvent(command.title, command.timeDisplay, command.startMs, command.endMs); break;
        case 'LIST_EVENTS':  handleListEvents();                                         break;
        case 'DELETE_EVENT': handleDeleteEvent();                                        break;
        case 'FLASHLIGHT_ON':    handleFlashlight(text, true);                           break;
        case 'FLASHLIGHT_OFF':   handleFlashlight(text, false);                          break;
        case 'VOLUME_UP':        handleVolumeChange(text, 'up');                         break;
        case 'VOLUME_DOWN':      handleVolumeChange(text, 'down');                       break;
        case 'VOLUME_SET':       handleVolumeChange(text, 'set', command.percent);       break;
        case 'VOLUME_MUTE':      handleVolumeChange(text, 'mute');                       break;
        case 'VOLUME_MAX':       handleVolumeChange(text, 'max');                        break;
        case 'BRIGHTNESS_UP':    handleBrightnessChange(text, 'up');                     break;
        case 'BRIGHTNESS_DOWN':  handleBrightnessChange(text, 'down');                   break;
        case 'BRIGHTNESS_SET':   handleBrightnessChange(text, 'set', command.percent);   break;
        case 'BRIGHTNESS_MIN':   handleBrightnessChange(text, 'min');                    break;
        case 'BRIGHTNESS_MAX':   handleBrightnessChange(text, 'max');                    break;
        case 'BATTERY_STATUS':   handleBattery(text);                                    break;
        case 'WIFI_ON':          handleConnectivity(text, 'wifi_on');                    break;
        case 'WIFI_OFF':         handleConnectivity(text, 'wifi_off');                   break;
        case 'BLUETOOTH_ON':     handleConnectivity(text, 'bt_on');                      break;
        case 'BLUETOOTH_OFF':    handleConnectivity(text, 'bt_off');                     break;
        case 'MEDIA_PLAY':       handleMedia(text, 'play');                              break;
        case 'MEDIA_PAUSE':      handleMedia(text, 'pause');                             break;
        case 'MEDIA_RESUME':     handleMedia(text, 'resume');                            break;
        case 'MEDIA_NEXT':       handleMedia(text, 'next');                              break;
        case 'MEDIA_PREVIOUS':   handleMedia(text, 'previous');                          break;
        case 'MEDIA_STOP':       handleMedia(text, 'stop');                              break;
        case 'MEDIA_VOLUME_UP':  handleMedia(text, 'vol_up');                            break;
        case 'MEDIA_VOLUME_DOWN':handleMedia(text, 'vol_down');                          break;
        case 'READ_NOTIFICATIONS':       handleNotifications(text, command.appFilter);       break;
        case 'READ_LATEST_NOTIFICATION': handleNotifications(text, undefined, 'latest');     break;
        case 'CHECK_MESSAGES':           handleNotifications(text, undefined, 'messages');   break;
        case 'CLEAR_NOTIFICATIONS':      handleNotifications(text, undefined, 'clear');      break;
        case 'DEVICE_INFO':      handleDeviceInfo(text, command.infoType);               break;
        case 'QUICK_ACTION':     handleQuickAction(text, command.action, command.appName);break;
        case 'MEMORY_STORE_NAME': handleMemoryStore(text, command.name);                 break;
        case 'MEMORY_QUERY_NAME': handleMemoryQuery(text);                               break;
        case 'STUDY_TIMER':      handleStudyTimer(text, command.minutes);                break;
        case 'STUDY_REMINDERS':  handleStudyReminders(text);                             break;
        case 'STUDY_CHECKLIST':  handleStudyChecklist(text);                             break;
      }
      return;
    }

    // ── Fallback 1: Intent engine ────────────────────────────────────────────
    const intent = classifyIntent(text);
    if (intent && intent.intent !== 'UNKNOWN') {
      switch (intent.intent) {
        case 'SMALL_TALK': {
          const response = getSmallTalkResponse(text);
          setActivePanel('small_talk');
          setSmallTalkFeedback({ phase: 'response', response });
          speak(response);
          return;
        }
        case 'OPEN_APP': {
          const app = findAppByKeyword(intent.entities.app ?? '');
          if (app) { handleOpenApp(text, app); return; }
          break;
        }
        case 'CALL_CONTACT': {
          const name = intent.entities.name ?? '';
          if (name) { handleCallContact(text, name); return; }
          break;
        }
        case 'MEMORY_STORE_NAME': {
          const name = intent.entities.name ?? '';
          if (name) { handleMemoryStore(text, name); return; }
          break;
        }
        case 'MEMORY_QUERY_NAME': { handleMemoryQuery(text); return; }
        case 'BATTERY':           { handleBattery(text); return; }
        case 'DEVICE_INFO':       { handleDeviceInfo(text, 'all'); return; }
        case 'STUDY_TIMER': {
          const mins = parseInt(intent.entities.minutes ?? '25', 10);
          handleStudyTimer(text, isNaN(mins) ? 25 : mins);
          return;
        }
        case 'STUDY_REMINDERS': { handleStudyReminders(text); return; }
        case 'STUDY_CHECKLIST': { handleStudyChecklist(text); return; }
        default: break;
      }
    }

    // ── Fallback 2: Rule-based small talk ────────────────────────────────────
    const st = trySmallTalk(text);
    if (st.matched) {
      setActivePanel('small_talk');
      setSmallTalkFeedback({ phase: 'response', response: st.response });
      speak(st.response);
      return;
    }

    // ── Fallback 3: Plugin pipeline ──────────────────────────────────────────
    try {
      const s = await getSettings();
      const pluginCtx = { speak, offlineFirst: s.offlineFirst ?? true, cloudAIEnabled: s.cloudAIEnabled, language: s.language };
      const handler = PluginManager.findHandler(text);
      if (handler) {
        setActivePanel('plugin');
        setPluginFeedback({ phase: 'result', pluginName: handler.name });
        const pluginResult = await PluginManager.execute(text, pluginCtx);
        if (pluginResult) {
          setPluginFeedback({ phase: pluginResult.success ? 'result' : 'error', result: pluginResult, pluginName: handler.name });
          speak(pluginResult.response);
          return;
        }
        setPluginFeedback({ phase: 'none' });
        setActivePanel('none');
      }
    } catch (err) {
      logError('VoiceScreen', 'Plugin pipeline error', err);
    }

    // ── Fallback 4: Cloud AI ──────────────────────────────────────────────────
    handleAIQuery(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  // Voice result triggers pipeline
  useEffect(() => {
    if (voiceState !== 'result' || !transcript) return;
    if (transcript === lastProcessed.current) return;
    lastProcessed.current = transcript;
    resetAllPanels();
    void processTranscript(transcript);
  }, [voiceState, transcript]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Load conversation history on mount
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    getConversationHistory().then(setConversationHistory).catch(() => {});
  }, []);

  // Initialise plugin system once on mount
  useEffect(() => {
    initPlugins().catch(err => logError('VoiceScreen', 'Plugin init failed', err));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.9 Handler — AI Query (cloud fallback + graceful offline)
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleAIQuery(raw: string) {
    setActivePanel('ai');
    setAiFeedback({ phase: 'thinking' });

    const result = await routeToAI(raw);

    // Determine display source
    const source =
      result.isError      ? 'error'   :
      result.source === 'online' ? 'online' : 'offline';

    setAiFeedback({
      phase: result.isError ? 'error' : 'response',
      response: result.response,
      source,
      providerName: result.providerName,
    });

    speak(result.response);

    // Persist to conversation history
    await addConversationTurn(raw, result.response, result.source, result.providerName);
    const updated = await getConversationHistory();
    setConversationHistory(updated);
  }

  // ── Clear conversation history ────────────────────────────────────────────

  const handleClearHistory = useCallback(async () => {
    await clearConversationHistory();
    setConversationHistory([]);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.1 Handlers — Open App, Call, SMS
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleOpenApp(raw: string, app: Parameters<typeof launchApp>[0]) {
    setActivePanel('open_app');
    setAppFeedback({ phase: 'launching', transcript: raw, appName: app.displayName });
    speak(`Opening ${app.displayName}`);
    const result = await launchApp(app);
    if (result.success) {
      setAppFeedback({ phase: 'success', transcript: raw, appName: app.displayName });
    } else {
      setAppFeedback({ phase: 'failed', transcript: raw, appName: app.displayName });
      speak(`Couldn't open ${app.displayName}. Is it installed?`);
    }
  }

  async function handleCallContact(raw: string, name: string) {
    setActivePanel('call');
    setCallFeedback({ phase: 'searching', transcript: raw, contactName: name });
    speak(`Searching for ${name}`);

    const contacts = await findContactsByName(name);
    if (contacts.length === 0) {
      setCallFeedback({ phase: 'not_found', transcript: raw, contactName: name });
      speak(`I couldn't find ${name} in your contacts.`);
      return;
    }
    if (contacts.length === 1) {
      await doCallContact(raw, name, contacts[0]);
    } else {
      setCallFeedback({ phase: 'multiple_found', transcript: raw, contactName: name, contacts });
      speak(`I found ${contacts.length} contacts named ${name}. Which one?`);
    }
  }

  async function doCallContact(raw: string, contactName: string, contact: ContactMatch) {
    setCallFeedback({ phase: 'calling', transcript: raw, contactName, contact });
    speak(`Calling ${contact.displayName}`);
    const result = await initiateCall(contact.phoneNumber);
    if (result.success) {
      setCallFeedback({ phase: 'call_started', transcript: raw, contactName, contact, method: result.method ?? 'dialer' });
    } else {
      setCallFeedback({ phase: 'call_failed', transcript: raw, contactName, contact });
      speak(`Failed to call ${contact.displayName}. Please try manually.`);
    }
  }

  const handleContactSelected = useCallback((contact: ContactMatch) => {
    if (callFeedback.phase === 'multiple_found') {
      doCallContact(
        (callFeedback as any).transcript,
        (callFeedback as any).contactName,
        contact,
      );
    }
  }, [callFeedback]);

  async function handleSendSms(raw: string, name: string, prefilledMessage: string) {
    setActivePanel('sms');
    setSmsFeedback({ phase: 'searching', transcript: raw, contactName: name });
    speak(`Searching for ${name}`);

    const contacts = await findContactsByName(name);
    if (contacts.length === 0) {
      setSmsFeedback({ phase: 'not_found', transcript: raw, contactName: name });
      speak(`I couldn't find ${name} in your contacts.`);
      return;
    }
    const contact = contacts[0];

    if (contacts.length > 1) {
      setSmsFeedback({ phase: 'multiple_found', transcript: raw, contactName: name, contacts });
      speak(`Found multiple contacts. I'll use ${contact.displayName}.`);
    }

    if (!prefilledMessage) {
      setSmsFeedback({ phase: 'awaiting_message', transcript: raw, contactName: name, contact });
      speak(`What message should I send to ${contact.displayName}?`);
      pendingSmsRef.current = { contact, message: '' };
      return;
    }

    setSmsFeedback({ phase: 'confirming', transcript: raw, contactName: name, contact, message: prefilledMessage });
    pendingSmsRef.current = { contact, message: prefilledMessage };
    speak(`Ready to send "${prefilledMessage}" to ${contact.displayName}. Say "send" to confirm.`);
  }

  const handleSmsContactSelected = useCallback((contact: ContactMatch) => {
    const prev = smsFeedback as any;
    if (!prev?.contactName) return;
    setSmsFeedback({ phase: 'awaiting_message', transcript: prev.transcript ?? '', contactName: prev.contactName, contact });
    pendingSmsRef.current = { contact, message: '' };
    speak(`What message should I send to ${contact.displayName}?`);
  }, [smsFeedback]);

  async function doSendSms(contact: ContactMatch, message: string) {
    const prev = smsFeedback as any;
    setSmsFeedback({ phase: 'sending', transcript: prev.transcript ?? '', contactName: contact.displayName, contact, message });
    speak(`Sending message to ${contact.displayName}`);
    pendingSmsRef.current = null;

    const result = await sendSms(contact.phoneNumber, message);
    if (result.success) {
      setSmsFeedback({ phase: 'sent', transcript: prev.transcript ?? '', contactName: contact.displayName, contact, message });
      speak(`Message sent to ${contact.displayName}.`);
    } else {
      setSmsFeedback({ phase: 'failed', transcript: prev.transcript ?? '', contactName: contact.displayName, contact, message, reason: result.message ?? 'Unknown error' });
      speak(`Failed to send message. ${result.message ?? ''}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.2 Handlers — Alarms, Timers, Stopwatch
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleSetAlarm(hour: number, minute: number, display: string) {
    setActivePanel('alarm');
    setAlarmFeedback({ phase: 'setting' });
    speak(`Setting alarm for ${display}`);
    const result = await setAlarm(hour, minute);
    if (result.success && result.alarm) {
      setAlarmFeedback({ phase: 'set', alarm: result.alarm });
      speak(`Alarm set for ${display}.`);
    } else {
      setAlarmFeedback({ phase: 'failed', message: result.message ?? 'Could not set alarm.' });
      speak(result.message ?? 'Failed to set alarm.');
    }
  }

  async function handleCancelAlarm(display: string) {
    setActivePanel('alarm');
    const result = await cancelAlarm();
    if (result.success && result.alarm) {
      setAlarmFeedback({ phase: 'cancelled', alarm: result.alarm });
      speak(`Alarm cancelled.`);
    } else {
      setAlarmFeedback({ phase: 'cancel_failed', message: result.message ?? 'No alarm to cancel.' });
      speak(result.message ?? 'No alarm found.');
    }
  }

  async function handleListAlarms() {
    setActivePanel('alarm');
    const alarms = await listAlarms();
    if (alarms.length === 0) {
      setAlarmFeedback({ phase: 'list', alarms: [] });
      speak('You have no alarms set.');
    } else {
      setAlarmFeedback({ phase: 'list', alarms });
      speak(`You have ${alarms.length} alarm${alarms.length === 1 ? '' : 's'}.`);
    }
  }

  async function handleStartTimer(totalMs: number, display: string) {
    await timerManager.startNewTimer(totalMs, display);
    speak(`Starting ${display} timer.`);
  }

  async function handleCancelTimerCmd() {
    const cancelled = await timerManager.cancelActiveTimer();
    speak(cancelled ? 'Timer cancelled.' : 'No active timer to cancel.');
  }

  function handleQueryTimer() {
    if (timerManager.state.isIdle) {
      speak('No timer is running.');
    } else {
      speak(`${timerManager.state.countdownDisplay} remaining.`);
    }
  }

  function handleStopwatch(action: string) {
    stopwatch.dispatch(action as any);
    const msgs: Record<string, string> = {
      start: 'Stopwatch started.', stop: 'Stopwatch paused.', pause: 'Stopwatch paused.',
      resume: 'Stopwatch resumed.', reset: 'Stopwatch reset.', lap: 'Lap recorded.',
      read: `Elapsed: ${stopwatch.state.display}.`,
    };
    speak(msgs[action] ?? 'Done.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.3 Handlers — Reminders, Calendar
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleSetReminder(message: string, timeDisplay: string, triggerMs: number) {
    setActivePanel('reminder');
    setReminderFeedback({ phase: 'setting' });
    speak(`Setting reminder for ${timeDisplay}`);
    const result = await createReminder(message, triggerMs, timeDisplay);
    if (result.success && result.reminder) {
      setReminderFeedback({ phase: 'set', reminder: result.reminder });
      speak(`Reminder set for ${timeDisplay}.`);
    } else {
      setReminderFeedback({ phase: 'failed', message: result.message ?? 'Could not set reminder.' });
      speak(result.message ?? 'Failed to set reminder.');
    }
  }

  async function handleListReminders() {
    setActivePanel('reminder');
    const result = await listReminders();
    if (result.success) {
      const reminders = result.reminders ?? [];
      setReminderFeedback({ phase: 'list', reminders });
      speak(reminders.length === 0 ? 'No reminders set.' : `You have ${reminders.length} reminder${reminders.length === 1 ? '' : 's'}.`);
    } else {
      setReminderFeedback({ phase: 'failed', message: result.message ?? 'Could not list reminders.' });
    }
  }

  async function handleDeleteReminder() {
    setActivePanel('reminder');
    const result = await deleteReminder();
    if (result.success && result.reminder) {
      setReminderFeedback({ phase: 'deleted', reminder: result.reminder });
      speak('Reminder deleted.');
    } else {
      setReminderFeedback({ phase: 'delete_failed', message: result.message ?? 'No reminder to delete.' });
      speak(result.message ?? 'No reminder found.');
    }
  }

  async function handleCreateEvent(title: string, timeDisplay: string, startMs: number, endMs: number) {
    setActivePanel('calendar');
    setCalendarFeedback({ phase: 'creating' });
    speak(`Creating event: ${title}`);
    const result = await createCalendarEvent(title, startMs, endMs, timeDisplay);
    if (result.success && result.event) {
      setCalendarFeedback({ phase: 'created', event: result.event });
      speak(`Event "${title}" created for ${timeDisplay}.`);
    } else {
      setCalendarFeedback({ phase: 'failed', message: result.message ?? 'Could not create event.' });
      speak(result.message ?? 'Failed to create event.');
    }
  }

  async function handleListEvents() {
    setActivePanel('calendar');
    const result = await listTodayEvents();
    if (result.success) {
      const events = result.events ?? [];
      setCalendarFeedback({ phase: 'list', events });
      speak(events.length === 0 ? 'No events today.' : `You have ${events.length} event${events.length === 1 ? '' : 's'} today.`);
    } else {
      setCalendarFeedback({ phase: 'list_failed', message: result.message ?? 'Could not fetch events.' });
      speak(result.message ?? 'Failed to list events.');
    }
  }

  async function handleDeleteEvent() {
    setActivePanel('calendar');
    const result = await listTodayEvents();
    if (result.success && result.events && result.events.length > 0) {
      setCalendarFeedback({ phase: 'delete_confirm', events: result.events });
      speak(`Which event would you like to delete?`);
    } else {
      setCalendarFeedback({ phase: 'list', events: [] });
      speak('No events to delete.');
    }
  }

  const doDeleteEvent = useCallback(async (event: CalendarEventInfo) => {
    setCalendarFeedback({ phase: 'creating' }); // reuse loading phase
    const result = await deleteCalendarEvent(event.id, event.title);
    if (result.success) {
      setCalendarFeedback({ phase: 'deleted', title: event.title });
      speak(`Event "${event.title}" deleted.`);
    } else {
      setCalendarFeedback({ phase: 'delete_failed', message: result.message ?? 'Could not delete event.' });
      speak(result.message ?? 'Failed to delete event.');
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.4/v0.6 Handlers — Device Controls
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleFlashlight(raw: string, on: boolean) {
    const label = on ? 'Flashlight On' : 'Flashlight Off';
    setActivePanel('device');
    setDeviceFeedback({ phase: 'working', transcript: raw, commandLabel: label });
    const result = await setFlashlight(on);
    speak(result.message);
    if (result.success) {
      setDeviceFeedback({ phase: 'success', transcript: raw, commandLabel: label, detail: result.message });
    } else {
      setDeviceFeedback({ phase: 'failed', transcript: raw, commandLabel: label, detail: result.message });
    }
  }

  async function handleVolumeChange(
    raw: string,
    action: 'up' | 'down' | 'set' | 'mute' | 'max',
    percent?: number,
  ) {
    const labelMap = { up: 'Volume Up', down: 'Volume Down', set: `Volume ${percent}%`, mute: 'Mute', max: 'Max Volume' };
    const label = labelMap[action];
    setActivePanel('device');
    setDeviceFeedback({ phase: 'working', transcript: raw, commandLabel: label });

    let result;
    if (action === 'up')      result = await volumeUp();
    else if (action === 'down') result = await volumeDown();
    else if (action === 'mute') result = await muteVolume();
    else if (action === 'max')  result = await maxVolume();
    else result = await setVolumeTo(percent ?? 50);

    speak(result.message);
    if (result.success) {
      setDeviceFeedback({ phase: 'success', transcript: raw, commandLabel: label, detail: result.message });
    } else {
      setDeviceFeedback({ phase: 'failed', transcript: raw, commandLabel: label, detail: result.message });
    }
  }

  async function handleBrightnessChange(
    raw: string,
    action: 'up' | 'down' | 'set' | 'min' | 'max',
    percent?: number,
  ) {
    const labelMap = { up: 'Brightness Up', down: 'Brightness Down', set: `Brightness ${percent}%`, min: 'Min Brightness', max: 'Max Brightness' };
    const label = labelMap[action];
    setActivePanel('device');
    setDeviceFeedback({ phase: 'working', transcript: raw, commandLabel: label });

    let result;
    if (action === 'up')      result = await brightnessUp();
    else if (action === 'down') result = await brightnessDown();
    else if (action === 'min')  result = await setBrightnessMin();
    else if (action === 'max')  result = await setBrightnessMax();
    else result = await setBrightnessTo(percent ?? 50);

    speak(result.message);
    if (result.success) {
      setDeviceFeedback({ phase: 'success', transcript: raw, commandLabel: label, detail: result.message });
    } else {
      setDeviceFeedback({ phase: 'failed', transcript: raw, commandLabel: label, detail: result.message });
    }
  }

  async function handleBattery(raw: string) {
    setActivePanel('device');
    setDeviceFeedback({ phase: 'working', transcript: raw, commandLabel: 'Battery Status' });
    const result = await getBatteryInfo();
    speak(result.message);
    if (result.success) {
      setDeviceFeedback({ phase: 'success', transcript: raw, commandLabel: 'Battery Status', detail: result.message });
    } else {
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
    if (action === 'wifi_on')   result = await wifiOn();
    else if (action === 'wifi_off') result = await wifiOff();
    else if (action === 'bt_on')    result = await bluetoothOn();
    else result = await bluetoothOff();

    speak(result.message);
    const phase = result.success ? (result.openedSettings ? 'settings' : 'success') : 'failed';
    setDeviceFeedback({ phase, transcript: raw, commandLabel: label, detail: result.message });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.7 Handlers — Media, Notifications, Device Info, Quick Actions
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleMedia(
    raw: string,
    action: 'play' | 'pause' | 'resume' | 'next' | 'previous' | 'stop' | 'vol_up' | 'vol_down',
  ) {
    const labelMap: Record<string, string> = {
      play: 'Play Music', pause: 'Pause Music', resume: 'Resume Music',
      next: 'Next Track', previous: 'Previous Track', stop: 'Stop Music',
      vol_up: 'Media Volume Up', vol_down: 'Media Volume Down',
    };
    const label = labelMap[action];
    setActivePanel('media');
    setMediaFeedback({ phase: 'working', transcript: raw, commandLabel: label });

    let result;
    if (action === 'play')       result = await mediaPlay();
    else if (action === 'pause')  result = await mediaPause();
    else if (action === 'resume') result = await mediaPlayPause();
    else if (action === 'next')   result = await mediaNext();
    else if (action === 'previous') result = await mediaPrevious();
    else if (action === 'stop')   result = await mediaStop();
    else if (action === 'vol_up') result = await mediaVolumeUp();
    else result = await mediaVolumeDown();

    speak(result.message);
    const phase = result.success ? (result.openedSettings ? 'settings' : 'success') : 'failed';
    setMediaFeedback({ phase, transcript: raw, commandLabel: label, detail: result.message });
  }

  async function handleNotifications(
    raw: string,
    appFilter?: string,
    mode?: 'latest' | 'messages' | 'clear',
  ) {
    setActivePanel('notifications');
    setNotifFeedback({ phase: 'reading', transcript: raw });

    let result;
    if (mode === 'clear')         result = await clearAllNotifications();
    else if (mode === 'latest')   result = await readLatestNotification();
    else if (mode === 'messages') result = await checkNewMessages();
    else if (appFilter)           result = await readAppNotifications(appFilter);
    else                          result = await readAllNotifications();

    speak(result.message);
    if (result.needsPermission) {
      setNotifFeedback({ phase: 'permission', transcript: raw, message: result.message, items: result.items });
    } else if (result.success && result.items) {
      setNotifFeedback({ phase: 'items', transcript: raw, items: result.items });
    } else {
      setNotifFeedback({ phase: 'failed', transcript: raw, message: result.message });
    }
  }

  async function handleDeviceInfo(
    raw: string,
    infoType: 'storage' | 'ram' | 'battery_health' | 'charging' | 'model' | 'android_version' | 'datetime' | 'all',
  ) {
    const labelMap: Record<string, string> = {
      storage: 'Storage Info', ram: 'RAM Info', battery_health: 'Battery Health',
      charging: 'Charging Status', model: 'Device Model',
      android_version: 'Android Version', datetime: 'Date & Time', all: 'Device Info',
    };
    const queryLabel = labelMap[infoType] ?? 'Device Info';
    setActivePanel('device_info');
    setDevInfoFeedback({ phase: 'loading', transcript: raw, queryLabel });

    let result;
    if (infoType === 'storage')         result = await getStorageInfo();
    else if (infoType === 'ram')        result = await getRamInfo();
    else if (infoType === 'battery_health' || infoType === 'charging') result = await getBatteryHealth();
    else if (infoType === 'model')      result = await getDeviceModel();
    else if (infoType === 'android_version') result = await getAndroidVersion();
    else if (infoType === 'datetime')   result = getDateTime();
    else                                result = await getAllDeviceInfo();

    speak(result.message);
    if (result.success) {
      setDevInfoFeedback({ phase: 'success', transcript: raw, queryLabel, message: result.message, info: result.info });
    } else {
      setDevInfoFeedback({ phase: 'failed', transcript: raw, queryLabel, message: result.message });
    }
  }

  async function handleQuickAction(
    raw: string,
    action: 'recent_apps' | 'go_home' | 'open_notifications' | 'quick_settings' | 'app_info' | 'wifi_settings' | 'bluetooth_settings' | 'display_settings',
    appName?: string,
  ) {
    const labelMap: Record<string, string> = {
      recent_apps: 'Recent Apps', go_home: 'Go Home',
      open_notifications: 'Open Notifications', quick_settings: 'Quick Settings',
      app_info: `App Info${appName ? ` (${appName})` : ''}`,
      wifi_settings: 'Wi-Fi Settings', bluetooth_settings: 'Bluetooth Settings',
      display_settings: 'Display Settings',
    };
    const actionLabel = labelMap[action] ?? action;
    setActivePanel('quick_action');
    setQaFeedback({ phase: 'working', transcript: raw, actionLabel });

    let result;
    if (action === 'recent_apps')           result = await openRecentApps();
    else if (action === 'go_home')          result = await goHome();
    else if (action === 'open_notifications') result = await openNotifications();
    else if (action === 'quick_settings')   result = await openQuickSettings();
    else if (action === 'app_info')         result = await openAppInfo(appName ?? '');
    else if (action === 'wifi_settings')    result = await openWifiSettings();
    else if (action === 'bluetooth_settings') result = await openBluetoothSettings();
    else result = await openDisplaySettings();

    speak(result.message);
    const phase = result.success ? (result.openedSettings ? 'settings' : 'success') : 'failed';
    setQaFeedback({ phase, transcript: raw, actionLabel, detail: result.message });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // v0.8 Handlers — Memory, Study Assistant
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleMemoryStore(raw: string, name: string) {
    setActivePanel('memory');
    await setUserName(name);
    setMemoryFeedback({ phase: 'stored', key: 'name', value: name });
    speak(`Got it! I'll remember your name is ${name}.`);
  }

  async function handleMemoryQuery(raw: string) {
    setActivePanel('memory');
    const name = await getUserName();
    if (name) {
      setMemoryFeedback({ phase: 'recalled', key: 'name', value: name });
      speak(`Your name is ${name}.`);
    } else {
      setMemoryFeedback({ phase: 'not_found', key: 'name' });
      speak(`I don't know your name yet. Tell me: "My name is …"`);
    }
  }

  async function handleStudyTimer(raw: string, minutes: number) {
    setActivePanel('study');
    setStudyFeedback({ phase: 'timer_started', minutes });
    const ms = minutes * 60 * 1000;
    speak(`Starting a ${minutes}-minute focus session. Stay focused!`);
    await timerManager.startNewTimer(ms, `${minutes} min`);
  }

  async function handleStudyReminders(raw: string) {
    setActivePanel('study');
    const reminders = await getTodayStudyReminders();
    setStudyFeedback({ phase: 'reminders', reminders });
    if (reminders.length === 0) {
      speak('No study reminders for today.');
    } else {
      speak(`You have ${reminders.length} study reminder${reminders.length === 1 ? '' : 's'} today.`);
    }
  }

  async function handleStudyChecklist(raw: string) {
    setActivePanel('study');
    const result = await buildStudyChecklist();
    setStudyFeedback({ phase: 'checklist', items: result.items, generated: result.generated });
    if (result.items.length === 0) {
      speak('No checklist items yet. Add study reminders to auto-generate one.');
    } else {
      speak(`Your study checklist has ${result.items.length} item${result.items.length === 1 ? '' : 's'}.`);
    }
  }

  const handleToggleStudyItem = useCallback(async (id: string) => {
    await toggleChecklistItem(id);
    handleStudyChecklist(''); // refresh
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Mic button handler
  // ═══════════════════════════════════════════════════════════════════════════

  const resetAllPanels = useCallback(() => {
    setActivePanel('none');
    setAppFeedback({ phase: 'none' });
    setCallFeedback({ phase: 'none' });
    setSmsFeedback({ phase: 'none' });
    setAlarmFeedback({ phase: 'none' });
    setReminderFeedback({ phase: 'none' });
    setCalendarFeedback({ phase: 'none' });
    setDeviceFeedback({ phase: 'none' });
    setMediaFeedback({ phase: 'none' });
    setNotifFeedback({ phase: 'none' });
    setDevInfoFeedback({ phase: 'none' });
    setQaFeedback({ phase: 'none' });
    setMemoryFeedback({ phase: 'none' });
    setStudyFeedback({ phase: 'none' });
    setSmallTalkFeedback({ phase: 'none' });
    setAiFeedback({ phase: 'none' });
    setPluginFeedback({ phase: 'none' });
    pendingSmsRef.current = null;
  }, []);

  const handleMicPress = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (voiceState === 'listening') {
      await stopListening();
    } else if (voiceState === 'result' || voiceState === 'error') {
      lastProcessed.current = '';
      resetAllPanels();
      stopSpeaking();
      resetVoice();
      setTimeout(startListening, 120);
    } else if (voiceState === 'idle' || voiceState === 'unavailable' || voiceState === 'permission_denied') {
      lastProcessed.current = '';
      resetAllPanels();
      await startListening();
    } else if (voiceState === 'processing') {
      // wait for result
    }
  }, [voiceState, startListening, stopListening, stopSpeaking, resetVoice, resetAllPanels]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Render helpers
  // ═══════════════════════════════════════════════════════════════════════════

  const showLiveTranscript = (voiceState === 'listening' || voiceState === 'processing') && !!partialTranscript;
  const showHint = activePanel === 'none' && !showLiveTranscript && timerManager.state.isIdle && stopwatch.state.status === 'idle';

  const HINTS = [
    '"Play music"  ·  "Next song"  ·  "Pause"',
    '"Set alarm for 7 AM"  ·  "Start 10 minute timer"',
    '"Call Mom"  ·  "Text Rahul saying I\'ll be late"',
    '"My name is …"  ·  "What\'s my name?"',
    '"Start a 25 minute study timer"  ·  "Study checklist"',
    '"Read my notifications"  ·  "Storage remaining"',
    '"Go home"  ·  "Open quick settings"  ·  "Recent apps"',
    '"Volume up"  ·  "Max brightness"  ·  "Battery status"',
    '"Turn on Wi-Fi"  ·  "Bluetooth off"  ·  "Open WhatsApp"',
    '"Hello"  ·  "Who are you?"  ·  "What can you do?"',
  ];

  // ── Ved-Orb breathing animation ──────────────────────────────────────────────
  const orbScale = useSharedValue(1);
  const isListeningVoice = voiceState === 'listening';
  useEffect(() => {
    orbScale.value = withRepeat(
      withSequence(
        withTiming(isListeningVoice ? 1.25 : 1.1, {
          duration: isListeningVoice ? 400 : 2000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(1, {
          duration: isListeningVoice ? 400 : 2000,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
  }, [isListeningVoice]);
  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: '#090A0F' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#090A0F" />

      {/* ── Sidebar (overlaid) ── */}
      <Sidebar
        isOpen={sidebarOpen}
        activeNav={activeNav}
        onNavSelect={(id) => {
          setActiveNav(id);
          if (id === 'vault' || id === 'kb') {
            speak('This feature is coming soon in a future update.');
          }
        }}
        onClose={() => setSidebarOpen(false)}
        conversationHistory={conversationHistory}
        onSettings={() => router.push('/settings')}
        onDiagnostics={() => router.push('/diagnostics')}
      />

      {/* ── Main Canvas ── */}
      <View style={[styles.mainCanvas, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setSidebarOpen(o => !o)}
              activeOpacity={0.75}
            >
              <Text style={styles.toggleIcon}>☰</Text>
            </TouchableOpacity>

            <View style={styles.vedStatus}>
              <Animated.View
                style={[
                  styles.vedOrb,
                  isListeningVoice && styles.vedOrbListening,
                  orbAnimStyle,
                ]}
              />
              <Text style={styles.vedStatusText}>
                {'Ved Core '}
                <Text style={{ color: isListeningVoice ? '#E040FB' : '#00F2FE' }}>
                  {isListeningVoice ? 'Listening...' : 'Active'}
                </Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={12}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Content feed — waveform (Step 2) + panels */}
        <View style={styles.contentFeed}>
          {/* Waveform hero */}
          <View style={styles.waveHero} pointerEvents="none">
            <View style={styles.waveLabel}>
              <View style={styles.waveDot} />
              <Text style={styles.waveLabelText}>VEDRA</Text>
            </View>
            <HeroWave isListening={voiceState === 'listening'} />
          </View>

          {/* Response panels */}
          <ScrollView
            style={styles.panelsScroll}
            contentContainerStyle={[
              styles.panelsContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <TimerDisplay
              state={timerManager.state}
              onCancel={timerManager.cancelActiveTimer}
              onDismiss={timerManager.dismissCompleted}
            />
            <StopwatchDisplay state={stopwatch.state} onAction={stopwatch.dispatch} />

            {showLiveTranscript && (
              <TranscriptCard transcript={partialTranscript} isSpeaking={false} />
            )}

            {activePanel === 'open_app' && <CommandFeedback state={appFeedback} />}
            {activePanel === 'call' && (
              <CallFeedback state={callFeedback} onContactSelected={handleContactSelected} />
            )}
            {activePanel === 'sms' && (
              <SmsFeedback state={smsFeedback} onContactSelected={handleSmsContactSelected} />
            )}
            {activePanel === 'alarm'    && <AlarmFeedback state={alarmFeedback} />}
            {activePanel === 'reminder' && <ReminderFeedback state={reminderFeedback} />}
            {activePanel === 'calendar' && (
              <CalendarFeedback state={calendarFeedback} onDeleteEvent={doDeleteEvent} />
            )}
            {activePanel === 'device' && <DeviceControlFeedback state={deviceFeedback} />}
            {activePanel === 'media'        && <MediaFeedback state={mediaFeedback} />}
            {activePanel === 'notifications'&& <NotificationFeedback state={notifFeedback} />}
            {activePanel === 'device_info'  && <DeviceInfoFeedback state={devInfoFeedback} />}
            {activePanel === 'quick_action' && <QuickActionFeedback state={qaFeedback} />}
            {activePanel === 'memory' && <MemoryFeedback state={memoryFeedback} />}
            {activePanel === 'study' && (
              <StudyFeedback state={studyFeedback} onToggleItem={handleToggleStudyItem} />
            )}
            {activePanel === 'small_talk' && <SmallTalkFeedback state={smallTalkFeedback} />}
            {activePanel === 'plugin' && <PluginFeedback state={pluginFeedback} />}
            {activePanel === 'ai'     && <AIFeedback state={aiFeedback} />}

            {conversationHistory.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowHistory(prev => !prev)}
                style={[styles.historyToggle, { borderColor: 'rgba(255,255,255,0.1)' }]}
                activeOpacity={0.7}
              >
                <Text style={styles.historyToggleText}>
                  {showHistory ? 'Hide History' : `Show History (${conversationHistory.length})`}
                </Text>
              </TouchableOpacity>
            )}
            {showHistory && conversationHistory.length > 0 && (
              <ConversationHistory turns={conversationHistory} onClear={handleClearHistory} />
            )}

            {showHint && (
              <View style={styles.emptyCard}>
                <Text style={styles.hintHeading}>Try saying or typing…</Text>
                {HINTS.map((h, i) => (
                  <View key={i} style={styles.hintChip}>
                    <Text style={styles.hintChipText}>{h}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>

        {/* ── Glass command dock ── */}
        <View style={[styles.dockOuter, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.dock}>
            {/* + button */}
            <TouchableOpacity style={styles.dockIconBtn} activeOpacity={0.7}>
              <Text style={styles.dockIconText}>+</Text>
            </TouchableOpacity>

            {/* Text input */}
            <TextInput
              style={styles.dockInput}
              value={dockText}
              onChangeText={setDockText}
              placeholder={voiceState === 'listening' ? 'Listening to your voice…' : 'Ask Ved anything (or tap mic for voice)…'}
              placeholderTextColor="rgba(255,255,255,0.28)"
              returnKeyType="send"
              onSubmitEditing={() => {
                const t = dockText.trim();
                if (!t) return;
                setDockText('');
                Keyboard.dismiss();
                resetAllPanels();
                lastProcessed.current = '';
                void processTranscript(t);
              }}
            />

            {/* Mic icon button */}
            <TouchableOpacity
              style={[styles.dockIconBtn, voiceState === 'listening' && styles.dockMicActive]}
              onPress={handleMicPress}
              activeOpacity={0.75}
            >
              <Feather
                name="mic"
                size={20}
                color={voiceState === 'listening' ? '#E040FB' : 'rgba(255,255,255,0.5)'}
              />
            </TouchableOpacity>

            {/* Send button */}
            <TouchableOpacity
              style={styles.dockSendBtn}
              activeOpacity={0.8}
              onPress={() => {
                const t = dockText.trim();
                if (!t) return;
                setDockText('');
                Keyboard.dismiss();
                resetAllPanels();
                lastProcessed.current = '';
                void processTranscript(t);
              }}
            >
              <Text style={styles.dockSendText}>→</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1 },

  mainCanvas: { flex: 1, flexDirection: 'column' },

  // ── Header ──
  header: {
    height: 70,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  toggleBtn: {
    width: 36, height: 36, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  toggleIcon: { fontSize: 17, color: '#FFFFFF' },

  vedStatus: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vedOrb: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#00F2FE',
    shadowColor: '#00F2FE',
    shadowRadius: 10, shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
  },
  vedOrbListening: { backgroundColor: '#E040FB', shadowColor: '#E040FB' },
  vedStatusText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.65)',
  },
  settingsIcon: { fontSize: 22, color: 'rgba(255,255,255,0.5)' },

  // ── Content feed ──
  contentFeed: { flex: 1, position: 'relative' },

  waveHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 16,
    gap: 24,
  },
  waveLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#E040FB',
    shadowColor: '#E040FB', shadowRadius: 6,
    shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 },
  },
  waveLabelText: {
    fontSize: 22, fontFamily: 'Inter_700Bold',
    letterSpacing: 4, color: '#FFFFFF',
  },

  panelsScroll: { flex: 1 },
  panelsContent: { paddingHorizontal: 16, paddingTop: 8, gap: 0 },

  historyToggle: {
    alignSelf: 'center', marginTop: 12,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  historyToggleText: {
    fontSize: 12, fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.45)',
  },
  emptyCard: { width: '100%', paddingVertical: 8, paddingHorizontal: 4, gap: 6 },
  hintHeading: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2, textAlign: 'center',
    color: 'rgba(255,255,255,0.25)',
    marginBottom: 4, textTransform: 'uppercase',
  },
  hintChip: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14,
  },
  hintChipText: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    textAlign: 'center', color: 'rgba(255,255,255,0.32)',
    lineHeight: 18,
  },

  // ── Glass command dock ──
  dockOuter: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 8,
    gap: 6,
  },
  dockIconBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  dockMicActive: {
    backgroundColor: 'rgba(224,64,251,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(224,64,251,0.4)',
  },
  dockIconText: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 28,
  },
  dockInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    height: '100%',
  },
  dockSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00F2FE',
  },
  dockSendText: {
    fontSize: 18,
    color: '#000',
    fontFamily: 'Inter_700Bold',
  },
});
