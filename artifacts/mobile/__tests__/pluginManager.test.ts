/**
 * pluginManager.test.ts — Unit tests for the PluginManager
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem:    jest.fn(() => Promise.resolve(null)),
  setItem:    jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet:   jest.fn(() => Promise.resolve([])),
  multiSet:   jest.fn(() => Promise.resolve()),
}));

import { PluginManager } from '../utils/plugins/pluginManager';
import type { VedraPlugin, PluginContext, PluginResult } from '../utils/plugins/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlugin(id: string, keyword: string, result: Partial<PluginResult>): VedraPlugin {
  return {
    id,
    name: `Test Plugin ${id}`,
    description: 'Test',
    version: '1.0.0',
    requiredPermissions: [],
    triggerKeywords: [keyword],
    canHandle: (t: string) => t.toLowerCase().includes(keyword),
    execute: async (_t: string, _ctx: PluginContext): Promise<PluginResult> => ({
      success: true,
      response: 'ok',
      ...result,
    }),
  };
}

const ctx: PluginContext = {
  speak: jest.fn(),
  offlineFirst: true,
  cloudAIEnabled: false,
  language: 'en-US',
};

// ── Registration ──────────────────────────────────────────────────────────────

describe('PluginManager.register / unregister', () => {
  afterEach(() => {
    PluginManager.unregister('reg-test');
  });

  test('registers a plugin and finds it', () => {
    const p = makePlugin('reg-test', 'zestfind', {});
    PluginManager.register(p);
    const handler = PluginManager.findHandler('zestfind this thing');
    expect(handler).toBeDefined();
    expect(handler?.id).toBe('reg-test');
  });

  test('unregisters a plugin', () => {
    const p = makePlugin('reg-test', 'zestfind', {});
    PluginManager.register(p);
    PluginManager.unregister('reg-test');
    const handler = PluginManager.findHandler('zestfind this thing');
    expect(handler).toBeUndefined();
  });
});

// ── findHandler ───────────────────────────────────────────────────────────────

describe('PluginManager.findHandler', () => {
  afterAll(() => {
    PluginManager.unregister('fh-a');
    PluginManager.unregister('fh-b');
  });

  test('returns undefined when no plugin matches', () => {
    expect(PluginManager.findHandler('nothing matches this xyzzy')).toBeUndefined();
  });

  test('returns first matching plugin', () => {
    const a = makePlugin('fh-a', 'abcunique', {});
    const b = makePlugin('fh-b', 'abcunique', { response: 'b response' });
    PluginManager.register(a);
    PluginManager.register(b);
    const handler = PluginManager.findHandler('abcunique something');
    expect(handler?.id).toBe('fh-a'); // first-match-wins
  });
});

// ── execute ───────────────────────────────────────────────────────────────────

describe('PluginManager.execute', () => {
  afterAll(() => {
    PluginManager.unregister('exec-ok');
    PluginManager.unregister('exec-fail');
  });

  test('executes matching plugin and returns result', async () => {
    const p = makePlugin('exec-ok', 'vedratest', { response: 'hello from test' });
    PluginManager.register(p);
    const result = await PluginManager.execute('vedratest command', ctx);
    expect(result).not.toBeNull();
    expect(result?.response).toBe('hello from test');
  });

  test('returns undefined when no plugin matches', async () => {
    const result = await PluginManager.execute('no plugin handles xyzzyabc', ctx);
    expect(result).toBeUndefined();
  });

  test('isolates a crashing plugin — does not throw', async () => {
    const crashPlugin: VedraPlugin = {
      id: 'exec-fail',
      name: 'Crash Plugin',
      description: 'Always crashes',
      version: '1.0.0',
      requiredPermissions: [],
      triggerKeywords: ['crashtest'],
      canHandle: (t: string) => t.includes('crashtest'),
      execute: async () => { throw new Error('intentional crash'); },
    };
    PluginManager.register(crashPlugin);
    await expect(PluginManager.execute('crashtest please', ctx)).resolves.not.toThrow();
  });
});
