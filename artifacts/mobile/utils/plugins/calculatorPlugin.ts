/**
 * calculatorPlugin.ts — Vedra Calculator Plugin (v1.0)
 *
 * Handles arithmetic and unit conversion entirely offline.
 * Supports: +, -, *, /, %, sqrt, square, percent-of, and basic conversions.
 */

import { type VedraPlugin, type PluginContext, type PluginResult } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function words(t: string): string {
  return t
    .replace(/plus|add/gi, '+')
    .replace(/minus|subtract/gi, '-')
    .replace(/times|multiplied by|multiply by|x/gi, '*')
    .replace(/divided by|divide by|over/gi, '/')
    .replace(/percent of/gi, '% of')
    .replace(/squared/gi, '^ 2')
    .replace(/cubed/gi, '^ 3')
    .replace(/power of/gi, '^');
}

function fmt(n: number): string {
  if (!isFinite(n)) return 'undefined';
  // Show up to 6 significant digits, strip trailing zeros
  const s = parseFloat(n.toPrecision(8)).toString();
  return s;
}

type CalcResult = { ok: true; value: number; expr: string } | { ok: false; reason: string };

function evaluate(raw: string): CalcResult {
  const normalised = words(raw.toLowerCase());

  // Square root
  const sqrtMatch = normalised.match(/square\s+root\s+of\s+([\d.]+)/i)
    || normalised.match(/sqrt\s+([\d.]+)/i);
  if (sqrtMatch) {
    const n = parseFloat(sqrtMatch[1]);
    if (n < 0) return { ok: false, reason: "Can't take the square root of a negative number." };
    return { ok: true, value: Math.sqrt(n), expr: `√${n}` };
  }

  // Percent of  e.g. "15 % of 200"
  const pctOf = normalised.match(/([\d.]+)\s*%\s*of\s*([\d.]+)/);
  if (pctOf) {
    const [, a, b] = pctOf.map(Number);
    return { ok: true, value: (a! / 100) * b!, expr: `${a}% of ${b}` };
  }

  // Simple expression — allow only safe chars
  const safe = normalised.replace(/[^0-9+\-*/^().% ]/g, '').trim();
  if (!safe) return { ok: false, reason: "I couldn't parse that calculation." };

  // Replace ^ with ** for JS eval
  const jsExpr = safe.replace(/\^/g, '**');
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${jsExpr})`)() as number;
    if (typeof result !== 'number' || !isFinite(result)) {
      return { ok: false, reason: result === Infinity ? 'Division by zero.' : 'Result is not a number.' };
    }
    return { ok: true, value: result, expr: safe };
  } catch {
    return { ok: false, reason: "I couldn't evaluate that expression." };
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const TRIGGERS = [
  'calculate', 'calculator', 'what is', "what's", 'how much is',
  'plus', 'minus', 'times', 'divided by', 'multiplied by',
  'square root', 'sqrt', 'percent of', 'squared', 'cubed',
  'power of', 'mod ', '% of',
];

export class CalculatorPlugin implements VedraPlugin {
  readonly id          = 'calculator';
  readonly name        = 'Calculator';
  readonly description = 'Evaluates arithmetic expressions entirely offline';
  readonly version     = '1.0.0';
  readonly requiredPermissions: string[] = [];
  readonly triggerKeywords = TRIGGERS;

  canHandle(transcript: string): boolean {
    const t = transcript.toLowerCase();
    // Must contain a digit to be a real calculation
    const hasNumber = /\d/.test(t);
    const hasTrigger = TRIGGERS.some(kw => t.includes(kw));
    // Reject pure small-talk "what is your name" etc.
    const isSmallTalk = /your name|are you|vedra|hello|hi there/i.test(t);
    return hasNumber && hasTrigger && !isSmallTalk;
  }

  async execute(transcript: string, context: PluginContext): Promise<PluginResult> {
    try {
      // Strip common leading phrases
      const stripped = transcript
        .replace(/^(calculate|what is|what's|how much is|tell me)\s+/i, '')
        .trim();

      const result = evaluate(stripped);

      if (!result.ok) {
        return {
          success: false,
          response: result.reason,
          error: result.reason,
          panelData: {
            title: '🔢 Calculator',
            items: [{ label: 'Input', value: stripped }],
          },
        };
      }

      const answer = fmt(result.value);
      const response = `${result.expr} equals ${answer}`;

      return {
        success: true,
        response,
        panelData: {
          title: '🔢 Calculator',
          items: [
            { label: 'Expression', value: result.expr },
            { label: 'Result', value: answer, highlight: true },
          ],
        },
      };
    } catch (err: any) {
      return {
        success: false,
        response: "I had trouble with that calculation. Please try again.",
        error: "Calculation failed",
        internalError: err?.message,
      };
    }
  }
}
