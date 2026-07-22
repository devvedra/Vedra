/**
 * initPlugins.ts — Vedra Plugin Initializer (v1.0)
 *
 * Registers all built-in plugins with the PluginManager.
 * Call this once at app startup (in _layout.tsx or index.tsx).
 * New plugins can be added here without touching the core engine.
 */

import { PluginManager } from './pluginManager';
import { CalculatorPlugin } from './calculatorPlugin';
import { NotesPlugin }      from './notesPlugin';
import { WeatherPlugin }    from './weatherPlugin';

let _initialized = false;

export async function initPlugins(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  // Register built-in plugins
  PluginManager.register(new CalculatorPlugin());
  PluginManager.register(new NotesPlugin());
  PluginManager.register(new WeatherPlugin());

  // Call onLoad for each registered plugin
  await PluginManager.initialize();
}
