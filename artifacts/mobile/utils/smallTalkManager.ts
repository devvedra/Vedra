/**
 * smallTalkManager.ts — Vedra offline small talk (v0.8)
 * Returns a deterministic response to conversational input.
 */

const RESPONSES: [RegExp, string[]][] = [
  [/^(hello|hi|hey)/, [
    "Hey! Just tap the mic and tell me what you need.",
    "Hello! What can I do for you?",
    "Hi there! How can I help?",
  ]],
  [/how are you/, [
    "Running perfectly, thanks! What do you need?",
    "All systems good! What can I do for you?",
  ]],
  [/good morning/, [
    "Good morning! Ready to make your day productive.",
    "Morning! What can I help you with today?",
  ]],
  [/good (afternoon|evening)/, [
    "Good afternoon! How can I help?",
    "Good evening! What do you need?",
  ]],
  [/good night/, [
    "Good night! Sleep well.",
    "Goodnight! See you tomorrow.",
  ]],
  [/who are you/, [
    "I'm Vedra, your offline AI assistant. I can control your device, set alarms, send messages, and much more — all without internet.",
    "I'm Vedra — everything I do stays on your device. No cloud, no data sharing.",
  ]],
  [/what can you do|help me|what do you do/, [
    "I can open apps, make calls, send SMS, set alarms, timers, reminders, control flashlight, volume, brightness, manage your calendar — all offline!",
    "Try: 'Call Mom', 'Set alarm for 7 AM', 'Open WhatsApp', 'Remind me to study at 6 PM', 'Start a 25-minute study timer'.",
  ]],
  [/thank(s| you)/, [
    "Happy to help! Anything else?",
    "Of course! Let me know if you need anything.",
    "You're welcome!",
  ]],
  [/are you (there|listening|awake)/, [
    "Yes, I'm here! Go ahead.",
    "Always listening — what do you need?",
  ]],
];

let _lastIdx = -1;

export function getSmallTalkResponse(text: string): string {
  const lc = text.toLowerCase();
  for (const [pat, options] of RESPONSES) {
    if (pat.test(lc)) {
      // Rotate through options to avoid repeating
      _lastIdx = (_lastIdx + 1) % options.length;
      return options[_lastIdx];
    }
  }
  return "I'm here. What would you like me to do?";
}

export function getUnknownResponse(transcript: string): string {
  const suggestions = [
    `I didn't understand "${transcript}". Try: "Call Mom", "Open WhatsApp", "Set alarm for 7 AM", or "Start a 25-minute study timer".`,
    `Not sure what you meant by "${transcript}". Say "What can you do?" to hear my capabilities.`,
    `I couldn't process that. Try a command like "Remind me to study at 6 PM" or "Turn on flashlight".`,
  ];
  return suggestions[Math.floor(Math.random() * suggestions.length)];
}
