# Vedra Plugin Development Guide

This guide shows how to create a new plugin for Vedra v1.0.

---

## Concepts

A **plugin** is a self-contained module that:
- Declares which voice commands it handles (`canHandle`)
- Executes the command and returns a spoken response + optional UI data (`execute`)
- Never crashes the app (all errors are caught by `PluginManager`)

---

## Step 1 — Implement `VedraPlugin`

Create `artifacts/mobile/utils/plugins/myPlugin.ts`:

```typescript
import { type VedraPlugin, type PluginContext, type PluginResult } from './types';

const TRIGGERS = ['my command', 'do the thing'];

export class MyPlugin implements VedraPlugin {
  readonly id          = 'my-plugin';
  readonly name        = 'My Plugin';
  readonly description = 'A one-line description';
  readonly version     = '1.0.0';
  readonly requiredPermissions: string[] = [];
  readonly triggerKeywords = TRIGGERS;

  canHandle(transcript: string): boolean {
    const t = transcript.toLowerCase();
    // Return true if any trigger keyword is present.
    // Keep this O(1) — no async, no heavy computation.
    return TRIGGERS.some(kw => t.includes(kw));
  }

  async execute(transcript: string, context: PluginContext): Promise<PluginResult> {
    // MUST NOT throw. Catch all errors and return a failure result.
    try {
      // ... do the work ...
      const answer = 'Here is your result';

      return {
        success: true,
        response: answer,               // spoken aloud by TTS
        panelData: {                    // optional — shown in PluginFeedback card
          title:    '🔧 My Plugin',
          items: [
            { label: 'Result', value: answer, highlight: true },
          ],
        },
      };
    } catch (err: any) {
      return {
        success:       false,
        response:      'Something went wrong. Please try again.',
        error:         'My plugin failed',
        internalError: err?.message,
      };
    }
  }

  // Optional lifecycle hooks:
  async onLoad(): Promise<void> {
    // Called once at app startup. Load data, open DB connections, etc.
  }
  async onUnload(): Promise<void> {
    // Called when plugin is unregistered. Clean up resources.
  }
}
```

---

## Step 2 — Register the Plugin

Open `artifacts/mobile/utils/plugins/initPlugins.ts` and add:

```typescript
import { MyPlugin } from './myPlugin';

export async function initPlugins(): Promise<void> {
  // ... existing registrations ...
  PluginManager.register(new MyPlugin());  // ← add this line
  await PluginManager.initialize();
}
```

That's it. No changes to the core engine.

---

## `PluginResult` reference

```typescript
interface PluginResult {
  success:       boolean;
  response:      string;          // TTS text — always provide this
  panelData?:    PluginPanelData; // optional UI card
  error?:        string;          // user-visible error label
  internalError?: string;         // developer detail (logged, not shown)
}

interface PluginPanelData {
  title:    string;
  subtitle?: string;
  items:    PluginPanelItem[];
  badge?:   string;               // e.g. "+5 more"
}

interface PluginPanelItem {
  label:      string;
  value:      string;
  icon?:      string;
  highlight?: boolean;  // renders value in accent colour + larger font
}
```

---

## `PluginContext` reference

```typescript
interface PluginContext {
  speak:          (text: string) => void;  // TTS
  offlineFirst:   boolean;
  cloudAIEnabled: boolean;
  language:       string;   // e.g. 'en-US'
}
```

---

## Rules

| Rule | Reason |
|------|--------|
| `canHandle` must be synchronous and O(1) | Called on every transcript; async would block the pipeline |
| `execute` must never throw | PluginManager catches errors, but unhandled promise rejections can still surface |
| Always return a `response` string | Even on failure — the user hears something useful |
| Don't mutate global state in `execute` | Plugins run in the main thread; side effects should be isolated |
| Declare all permissions in `requiredPermissions` | Used by the Diagnostics screen |

---

## Testing a Plugin

Unit tests go in `artifacts/mobile/__tests__/`:

```typescript
import { MyPlugin } from '../utils/plugins/myPlugin';

describe('MyPlugin', () => {
  const plugin = new MyPlugin();

  test('canHandle triggers', () => {
    expect(plugin.canHandle('my command please')).toBe(true);
    expect(plugin.canHandle('unrelated text')).toBe(false);
  });

  test('execute returns success', async () => {
    const ctx = { speak: jest.fn(), offlineFirst: true, cloudAIEnabled: false, language: 'en-US' };
    const result = await plugin.execute('my command', ctx);
    expect(result.success).toBe(true);
    expect(result.response).toBeTruthy();
  });
});
```

Run tests: `pnpm --filter @workspace/mobile run test`

---

## Built-in Plugins

| Plugin | ID | Offline | Commands |
|--------|----|---------|----------|
| Calculator | `calculator` | ✓ | "what is 5 plus 3", "calculate 12 * 4", "square root of 16" |
| Notes | `notes` | ✓ | "take a note …", "read my notes", "clear notes", "delete last note" |
| Weather | `weather` | partial | "weather today" → offline tip or AI route |
