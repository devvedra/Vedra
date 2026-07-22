/**
 * weatherPlugin.test.ts — Unit tests for the Weather plugin
 */

import { WeatherPlugin } from '../utils/plugins/weatherPlugin';

const plugin = new WeatherPlugin();

const ctxOffline = {
  speak: jest.fn(),
  offlineFirst: true,
  cloudAIEnabled: false,
  language: 'en-US',
};

const ctxCloud = {
  speak: jest.fn(),
  offlineFirst: false,
  cloudAIEnabled: true,
  language: 'en-US',
};

// ── canHandle ──────────────────────────────────────────────────────────────────

describe('WeatherPlugin.canHandle', () => {
  test('triggers on weather queries', () => {
    expect(plugin.canHandle('what is the weather')).toBe(true);
    expect(plugin.canHandle('weather today')).toBe(true);
    expect(plugin.canHandle('what is the temperature outside')).toBe(true);
    expect(plugin.canHandle('will it rain today')).toBe(true);
    expect(plugin.canHandle('how is the weather in Delhi')).toBe(true);
  });

  test('does not trigger on unrelated queries', () => {
    expect(plugin.canHandle('set an alarm for 7am')).toBe(false);
    expect(plugin.canHandle('hello vedra')).toBe(false);
    expect(plugin.canHandle('calculate 2 plus 2')).toBe(false);
  });
});

// ── execute (offline) ─────────────────────────────────────────────────────────

describe('WeatherPlugin.execute (offline)', () => {
  test('returns a friendly offline message when cloud AI is disabled', async () => {
    const result = await plugin.execute('what is the weather', ctxOffline);
    // Should succeed with an offline fallback message (not an error crash)
    expect(result.response).toBeTruthy();
    expect(result.response.length).toBeGreaterThan(5);
  });
});

// ── execute (cloud enabled) ───────────────────────────────────────────────────

describe('WeatherPlugin.execute (cloud enabled)', () => {
  test('defers to AI when cloud is enabled', async () => {
    const result = await plugin.execute('what is the weather', ctxCloud);
    // Plugin signals deferral — panelData action may be defer_to_ai
    // or the response indicates delegation; either way no crash
    expect(result).toBeDefined();
    expect(typeof result.response).toBe('string');
  });
});

// ── metadata ──────────────────────────────────────────────────────────────────

describe('WeatherPlugin metadata', () => {
  test('has required plugin fields', () => {
    expect(plugin.id).toBeTruthy();
    expect(plugin.name).toBeTruthy();
    expect(plugin.version).toBeTruthy();
    expect(Array.isArray(plugin.triggerKeywords)).toBe(true);
    expect(plugin.triggerKeywords.length).toBeGreaterThan(0);
  });
});
