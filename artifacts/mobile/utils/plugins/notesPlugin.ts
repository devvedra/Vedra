/**
 * notesPlugin.ts — Vedra Notes Plugin (v1.0)
 *
 * Handles voice-driven note taking.
 * Stores notes locally in AsyncStorage — never uploaded.
 * Commands: "take a note", "add note", "read my notes", "clear notes",
 *           "delete last note", "how many notes"
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type VedraPlugin, type PluginContext, type PluginResult } from './types';

// ─── Storage ──────────────────────────────────────────────────────────────────

const NOTES_KEY = '@vedra/notes_v1';
const MAX_NOTES = 100;

export interface VedraNote {
  id: string;
  text: string;
  createdAt: number;
}

async function loadNotes(): Promise<VedraNote[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveNotes(notes: VedraNote[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// ─── Intent detection ─────────────────────────────────────────────────────────

type NoteIntent =
  | { action: 'add'; text: string }
  | { action: 'list' }
  | { action: 'count' }
  | { action: 'clear' }
  | { action: 'delete_last' }
  | { action: 'unknown' };

function detectIntent(t: string): NoteIntent {
  const lc = t.toLowerCase().trim();

  // Clear all
  if (/clear (all )?notes|delete all notes|erase notes/i.test(lc)) {
    return { action: 'clear' };
  }
  // Delete last
  if (/delete (last|latest|previous|that) note|remove last note/i.test(lc)) {
    return { action: 'delete_last' };
  }
  // List / read
  if (
    /read (my |all |the )?notes|list (my |all |the )?notes|show (my |all |the )?notes|what (are|are my) notes/i.test(lc) ||
    /^notes$/.test(lc)
  ) {
    return { action: 'list' };
  }
  // Count
  if (/how many notes|count (my )?notes/i.test(lc)) {
    return { action: 'count' };
  }
  // Add note — extract the note text
  const addMatch =
    lc.match(/^(?:take a note|add a note|note down|make a note|note that|note:|write down|add note)\s*[:\-]?\s*(.+)/i) ||
    lc.match(/^(?:note)\s+(.+)/i);
  if (addMatch && addMatch[1]?.trim()) {
    return { action: 'add', text: addMatch[1].trim() };
  }

  return { action: 'unknown' };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const TRIGGERS = [
  'note', 'notes', 'take a note', 'add note', 'make a note',
  'note down', 'write down', 'read my notes', 'show notes',
  'list notes', 'clear notes', 'delete note',
];

export class NotesPlugin implements VedraPlugin {
  readonly id          = 'notes';
  readonly name        = 'Notes';
  readonly description = 'Voice-driven note taking stored locally on your device';
  readonly version     = '1.0.0';
  readonly requiredPermissions: string[] = [];
  readonly triggerKeywords = TRIGGERS;

  canHandle(transcript: string): boolean {
    const t = transcript.toLowerCase();
    return TRIGGERS.some(kw => t.includes(kw)) && detectIntent(t).action !== 'unknown';
  }

  async execute(transcript: string, _context: PluginContext): Promise<PluginResult> {
    try {
      const intent = detectIntent(transcript);

      switch (intent.action) {
        case 'add': {
          const notes = await loadNotes();
          const newNote: VedraNote = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: intent.text,
            createdAt: Date.now(),
          };
          notes.unshift(newNote);
          if (notes.length > MAX_NOTES) notes.length = MAX_NOTES;
          await saveNotes(notes);

          return {
            success: true,
            response: `Note saved: "${intent.text}"`,
            panelData: {
              title: '📝 Note Saved',
              items: [
                { label: 'Note', value: intent.text, highlight: true },
                { label: 'Total notes', value: String(notes.length) },
              ],
            },
          };
        }

        case 'list': {
          const notes = await loadNotes();
          if (notes.length === 0) {
            return {
              success: true,
              response: 'You have no notes yet. Say "take a note" followed by your note text.',
              panelData: {
                title: '📝 Notes',
                items: [{ label: 'Status', value: 'No notes saved yet' }],
              },
            };
          }
          const preview = notes.slice(0, 5);
          const spokenList = preview.map((n, i) => `${i + 1}: ${n.text}`).join('. ');
          return {
            success: true,
            response: `You have ${notes.length} note${notes.length === 1 ? '' : 's'}. ${spokenList}`,
            panelData: {
              title: `📝 Notes (${notes.length})`,
              items: preview.map(n => ({
                label: new Date(n.createdAt).toLocaleDateString(),
                value: n.text,
              })),
              badge: notes.length > 5 ? `+${notes.length - 5} more` : undefined,
            },
          };
        }

        case 'count': {
          const notes = await loadNotes();
          const count = notes.length;
          return {
            success: true,
            response: count === 0
              ? 'You have no notes.'
              : `You have ${count} note${count === 1 ? '' : 's'}.`,
            panelData: {
              title: '📝 Notes',
              items: [{ label: 'Total notes', value: String(count), highlight: true }],
            },
          };
        }

        case 'delete_last': {
          const notes = await loadNotes();
          if (notes.length === 0) {
            return {
              success: false,
              response: 'No notes to delete.',
              panelData: { title: '📝 Notes', items: [{ label: 'Status', value: 'No notes saved' }] },
            };
          }
          const deleted = notes.shift()!;
          await saveNotes(notes);
          return {
            success: true,
            response: `Deleted note: "${deleted.text}"`,
            panelData: {
              title: '📝 Note Deleted',
              items: [
                { label: 'Deleted', value: deleted.text },
                { label: 'Remaining', value: String(notes.length) },
              ],
            },
          };
        }

        case 'clear': {
          await saveNotes([]);
          return {
            success: true,
            response: 'All notes cleared.',
            panelData: { title: '📝 Notes Cleared', items: [{ label: 'Status', value: 'All notes deleted' }] },
          };
        }

        default:
          return {
            success: false,
            response: "I didn't understand that notes command. Try: 'take a note', 'read my notes', or 'clear notes'.",
            error: 'Unknown notes intent',
          };
      }
    } catch (err: any) {
      return {
        success: false,
        response: 'Something went wrong with notes. Please try again.',
        error: 'Notes plugin error',
        internalError: err?.message,
      };
    }
  }
}
