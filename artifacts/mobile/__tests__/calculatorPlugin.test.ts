/**
 * calculatorPlugin.test.ts — Unit tests for the Calculator plugin
 */

import { CalculatorPlugin } from '../utils/plugins/calculatorPlugin';

const plugin = new CalculatorPlugin();
const ctx = {
  speak: jest.fn(),
  offlineFirst: true,
  cloudAIEnabled: false,
  language: 'en-US',
};

// ── canHandle ──────────────────────────────────────────────────────────────────

describe('CalculatorPlugin.canHandle', () => {
  test('triggers on arithmetic expressions', () => {
    expect(plugin.canHandle('what is 5 plus 3')).toBe(true);
    expect(plugin.canHandle('calculate 12 times 4')).toBe(true);
    expect(plugin.canHandle('what is 100 divided by 4')).toBe(true);
    expect(plugin.canHandle('square root of 16')).toBe(true);
    expect(plugin.canHandle('15 percent of 200')).toBe(true);
  });

  test('does not trigger on small talk', () => {
    expect(plugin.canHandle('what is your name')).toBe(false);
    expect(plugin.canHandle('hello vedra')).toBe(false);
    expect(plugin.canHandle('what are you')).toBe(false);
  });

  test('requires a number in the input', () => {
    expect(plugin.canHandle('calculate something')).toBe(false);
    expect(plugin.canHandle('what is love')).toBe(false);
  });
});

// ── execute ───────────────────────────────────────────────────────────────────

describe('CalculatorPlugin.execute', () => {
  test('addition', async () => {
    const result = await plugin.execute('what is 5 plus 3', ctx);
    expect(result.success).toBe(true);
    expect(result.response).toContain('8');
    expect(result.panelData?.title).toContain('Calculator');
  });

  test('subtraction', async () => {
    const result = await plugin.execute('calculate 10 minus 4', ctx);
    expect(result.success).toBe(true);
    expect(result.response).toContain('6');
  });

  test('multiplication', async () => {
    const result = await plugin.execute('what is 6 times 7', ctx);
    expect(result.success).toBe(true);
    expect(result.response).toContain('42');
  });

  test('division', async () => {
    const result = await plugin.execute('100 divided by 4', ctx);
    expect(result.success).toBe(true);
    expect(result.response).toContain('25');
  });

  test('square root', async () => {
    const result = await plugin.execute('square root of 16', ctx);
    expect(result.success).toBe(true);
    expect(result.response).toContain('4');
  });

  test('percentage', async () => {
    const result = await plugin.execute('15 percent of 200', ctx);
    expect(result.success).toBe(true);
    expect(result.response).toContain('30');
  });

  test('returns panel data with highlight item', async () => {
    const result = await plugin.execute('what is 2 plus 2', ctx);
    expect(result.panelData?.items.some(i => i.highlight)).toBe(true);
  });

  test('handles division by zero gracefully', async () => {
    const result = await plugin.execute('calculate 5 / 0', ctx);
    expect(result.success).toBe(false);
    expect(result.response).toBeTruthy();
  });

  test('handles square root of negative gracefully', async () => {
    const result = await plugin.execute('square root of -4', ctx);
    expect(result.success).toBe(false);
    expect(result.response).toBeTruthy();
  });
});
