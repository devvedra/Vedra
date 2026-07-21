/**
 * contactsManager.ts — Vedra Contacts Module
 *
 * Provides offline, on-device contact search using expo-contacts.
 * No network calls are made at any point.
 *
 * ── Permission flow ───────────────────────────────────────────────────────────
 * Call requestContactsPermission() before searching. The first call triggers
 * the system permission dialog; subsequent calls return the cached status.
 *
 * ── Matching strategy ────────────────────────────────────────────────────────
 * expo-contacts supports server-side name filtering, but that does exact/prefix
 * matching only. We fetch all contacts whose name contains the query, then
 * de-duplicate by contactId so a person with three phone numbers appears once.
 *
 * Phone number priority (per contact): mobile/cell > first available.
 *
 * ── Adding common nicknames ───────────────────────────────────────────────────
 * The NICKNAME_MAP lets users say "Call Mom" even if the contact is saved as
 * "Mother" or "Mum". Add entries here to expand coverage.
 */

import * as Contacts from 'expo-contacts';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A resolved contact that has at least one callable phone number. */
export type ContactMatch = {
  /** Stable contact ID from the device's address book */
  id: string;
  /** Full display name as stored in the phone ("Mom", "Rahul Sharma"…) */
  displayName: string;
  /** Best phone number to call (mobile preferred) */
  phoneNumber: string;
  /** Label for the phone number ("mobile", "home", "work"…) */
  phoneLabel: string;
};

// ── Nickname / alias expansion map ────────────────────────────────────────────
// Maps what the user might say → additional search terms to try if the
// primary query returns no results.
// Keys and values are all lower-case.
const NICKNAME_MAP: Record<string, string[]> = {
  mom: ['mom', 'mother', 'mum', 'mama', 'maa'],
  mother: ['mother', 'mom', 'mum', 'mama', 'maa'],
  mum: ['mum', 'mom', 'mother', 'mama'],
  dad: ['dad', 'father', 'papa', 'baba', 'daddy'],
  father: ['father', 'dad', 'papa', 'baba', 'daddy'],
  papa: ['papa', 'dad', 'father', 'baba'],
  grandma: ['grandma', 'grandmother', 'nani', 'dadi', 'granny'],
  grandpa: ['grandpa', 'grandfather', 'nana', 'dada'],
  brother: ['brother', 'bhai', 'bro'],
  sister: ['sister', 'didi', 'sis'],
  wife: ['wife', 'wifey', 'honey'],
  husband: ['husband', 'hubby'],
};

// ── Permission ─────────────────────────────────────────────────────────────────

/**
 * Request read access to the device's contacts.
 * Returns true if granted (or already granted), false if denied.
 */
export async function requestContactsPermission(): Promise<boolean> {
  try {
    // Check current status first to avoid prompting unnecessarily
    const { status: current } = await Contacts.getPermissionsAsync();
    if (current === 'granted') return true;

    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ── Search ─────────────────────────────────────────────────────────────────────

/**
 * Search the on-device address book for contacts whose name matches `query`.
 * Permission must already be granted before calling this.
 *
 * @param query - The contact name extracted from the voice command (e.g. "mom")
 * @returns Array of matching contacts (deduplicated by ID, one entry per contact)
 */
export async function findContactsByName(query: string): Promise<ContactMatch[]> {
  const trimmed = query.trim().toLowerCase();

  // Build a list of search terms: the query itself + any known aliases
  const searchTerms = expandNicknames(trimmed);

  // Collect results from all search terms, deduplicate by contact ID
  const seen = new Set<string>();
  const results: ContactMatch[] = [];

  for (const term of searchTerms) {
    const matches = await searchByTerm(term);
    for (const m of matches) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        results.push(m);
      }
    }
  }

  return results;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Perform a single name search via expo-contacts.
 * Returns contacts that have at least one phone number.
 */
async function searchByTerm(term: string): Promise<ContactMatch[]> {
  try {
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      name: term, // expo-contacts does case-insensitive partial match
    });

    const results: ContactMatch[] = [];

    for (const contact of data) {
      if (!contact.name || !contact.phoneNumbers?.length) continue;

      // Find the best phone number for this contact
      const phone = pickBestPhone(contact.phoneNumbers);
      if (!phone) continue;

      results.push({
        id: contact.id ?? `${contact.name}-${phone.number}`,
        displayName: contact.name,
        phoneNumber: phone.number ?? '',
        phoneLabel: phone.label ?? 'phone',
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Return the best phone number from a contact's list.
 * Preference order: mobile/cell > first available.
 */
function pickBestPhone(
  numbers: Contacts.PhoneNumber[],
): Contacts.PhoneNumber | undefined {
  if (!numbers.length) return undefined;

  // Prefer mobile/cell numbers
  const mobile = numbers.find((n) => {
    const label = (n.label ?? '').toLowerCase();
    return label.includes('mobile') || label.includes('cell');
  });

  return mobile ?? numbers[0];
}

/**
 * Expand a query word to a list of search terms using the nickname map.
 * Always includes the original query so it's always searched.
 */
function expandNicknames(query: string): string[] {
  const aliases = NICKNAME_MAP[query];
  if (aliases) {
    // Put the exact query first, then aliases (without duplicates)
    return Array.from(new Set([query, ...aliases]));
  }
  return [query];
}
