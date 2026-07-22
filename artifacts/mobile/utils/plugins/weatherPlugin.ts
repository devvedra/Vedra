/**
 * weatherPlugin.ts — Vedra Weather Plugin (v1.0)
 *
 * Handles weather queries. Offline: explains that weather needs cloud AI.
 * When cloud AI is enabled, it routes the query to the AI provider via
 * returning a special "defer_to_ai" flag so the main pipeline can
 * handle it naturally without double-routing.
 */

import { type VedraPlugin, type PluginContext, type PluginResult } from './types';

const TRIGGERS = [
  'weather', 'forecast', 'temperature', "what's it like outside",
  'will it rain', 'is it raining', 'is it hot', 'is it cold',
  'humidity', 'wind speed', 'sunrise', 'sunset', 'uv index',
  'air quality', "today's weather", "tomorrow's weather",
];

export class WeatherPlugin implements VedraPlugin {
  readonly id          = 'weather';
  readonly name        = 'Weather';
  readonly description = 'Weather queries — routed to cloud AI when enabled';
  readonly version     = '1.0.0';
  readonly requiredPermissions: string[] = ['android.permission.ACCESS_COARSE_LOCATION'];
  readonly triggerKeywords = TRIGGERS;

  canHandle(transcript: string): boolean {
    const t = transcript.toLowerCase();
    return TRIGGERS.some(kw => t.includes(kw));
  }

  async execute(transcript: string, context: PluginContext): Promise<PluginResult> {
    // If cloud AI is enabled, let it handle the query naturally
    if (context.cloudAIEnabled) {
      // Return a special signal so PluginManager skips this plugin
      // and falls through to the cloud AI layer
      return {
        success: false,
        response: '',
        error: 'defer_to_ai',
      };
    }

    // Offline-only fallback
    return {
      success: true,
      response:
        "I can answer weather questions when Cloud AI is enabled. " +
        "Go to Settings, enable Cloud AI, and add your API key. " +
        "You can also check your phone's weather app.",
      panelData: {
        title: '🌤 Weather',
        items: [
          {
            label: 'Status',
            value: 'Cloud AI required for weather',
          },
          {
            label: 'Tip',
            value: 'Enable Cloud AI in Settings to get weather answers',
          },
        ],
      },
    };
  }
}
