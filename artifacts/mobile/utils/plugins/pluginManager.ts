/**
 * pluginManager.ts — Vedra Plugin Manager (v1.0)
 *
 * Central registry for all Vedra plugins.
 * Plugins are checked in registration order; the first match wins.
 * Plugin failures are caught and logged — they NEVER crash the app.
 */

import { type VedraPlugin, type PluginContext, type PluginResult } from './types';
import { logError } from '../errorLogger';

// ─── Manager ──────────────────────────────────────────────────────────────────

class PluginManagerClass {
  private readonly _plugins: Map<string, VedraPlugin> = new Map();
  private _loaded = false;

  /** Register a plugin. Idempotent — re-registering replaces the old instance. */
  register(plugin: VedraPlugin): void {
    if (this._plugins.has(plugin.id)) {
      console.warn(`[PluginManager] Replacing existing plugin: ${plugin.id}`);
    }
    this._plugins.set(plugin.id, plugin);
  }

  /** Unregister a plugin by id. */
  unregister(id: string): void {
    const plugin = this._plugins.get(id);
    if (plugin?.onUnload) {
      plugin.onUnload().catch(err =>
        logError('PluginManager', `onUnload failed for ${id}`, err),
      );
    }
    this._plugins.delete(id);
  }

  /** List all registered plugins. */
  listPlugins(): VedraPlugin[] {
    return Array.from(this._plugins.values());
  }

  /** Get a specific plugin by id. */
  getPlugin(id: string): VedraPlugin | undefined {
    return this._plugins.get(id);
  }

  /**
   * Find the first plugin that can handle this transcript.
   * Returns undefined if no plugin matches.
   */
  findHandler(transcript: string): VedraPlugin | undefined {
    for (const plugin of this._plugins.values()) {
      try {
        if (plugin.canHandle(transcript)) return plugin;
      } catch (err) {
        logError('PluginManager', `canHandle() threw in plugin ${plugin.id}`, err);
      }
    }
    return undefined;
  }

  /**
   * Execute the appropriate plugin for a transcript.
   * Returns undefined if no plugin can handle it (caller should fall through).
   * NEVER throws — all plugin errors are caught and returned as PluginResult.
   */
  async execute(
    transcript: string,
    context: PluginContext,
  ): Promise<PluginResult | undefined> {
    const plugin = this.findHandler(transcript);
    if (!plugin) return undefined;

    try {
      const result = await plugin.execute(transcript, context);
      // Special case: weather plugin defers to AI
      if (!result.success && result.error === 'defer_to_ai') {
        return undefined;
      }
      return result;
    } catch (err: any) {
      logError('PluginManager', `Plugin "${plugin.id}" threw an unhandled error`, err);
      return {
        success: false,
        response:
          `The ${plugin.name} feature ran into a problem. ` +
          `You can keep using other Vedra features normally.`,
        error: `Plugin "${plugin.id}" threw: ${err?.message ?? 'unknown'}`,
        internalError: err?.stack,
      };
    }
  }

  /**
   * Initialize all plugins (call onLoad).
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async initialize(): Promise<void> {
    if (this._loaded) return;
    this._loaded = true;
    for (const plugin of this._plugins.values()) {
      if (plugin.onLoad) {
        try {
          await plugin.onLoad();
        } catch (err) {
          logError('PluginManager', `onLoad() failed for plugin ${plugin.id}`, err);
        }
      }
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const PluginManager = new PluginManagerClass();

// ─── Re-export types for convenience ─────────────────────────────────────────
export type { VedraPlugin, PluginContext, PluginResult, PluginPanelData, PluginPanelItem } from './types';
