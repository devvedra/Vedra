/**
 * notesPlugin.test.ts — Unit tests for the Notes plugin
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem:    jest.fn(() => Promise.resolve(null)),
  setItem:    jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet:   jest.fn(() => Promise.resolve([])),
  multiSet:   jest.fn(() => Promise.resolve()),
}));

import { NotesPlugin } from '../utils/plugins/notesPlugin';

const plugin = new NotesPlugin();
const ctx = {
  speak: jest.fn(),
  offlineFirst: true,
  cloudAIEnabled: false,
  language: 'en-US',
};

describe('NotesPlugin.canHandle', () => {
  test('triggers on note commands', () => {
    expect(plugin.canHandle('take a note buy milk')).toBe(true);
    expect(plugin.canHandle('add note meeting at 3pm')).toBe(true);
    expect(plugin.canHandle('read my notes')).toBe(true);
    expect(plugin.canHandle('clear notes')).toBe(true);
    expect(plugin.canHandle('delete last note')).toBe(true);
  });

  test('does not trigger on unrelated phrases', () => {
    expect(plugin.canHandle('open youtube')).toBe(false);
    expect(plugin.canHandle('what is the weather')).toBe(false);
  });
});

describe('NotesPlugin.execute', () => {
  test('adding a note returns success', async () => {
    const result = await plugin.execute('take a note buy groceries', ctx);
    expect(result.success).toBe(true);
    expect(result.response).toContain('buy groceries');
    expect(result.panelData?.title).toContain('Note');
  });

  test('listing notes when empty gives friendly message', async () => {
    const result = await plugin.execute('read my notes', ctx);
    expect(result.success).toBe(true);
    expect(result.response).toBeTruthy();
  });

  test('clearing notes returns success', async () => {
    const result = await plugin.execute('clear all notes', ctx);
    expect(result.success).toBe(true);
  });
});
