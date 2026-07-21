/**
 * SmsFeedback.tsx — Vedra SMS UI Module (v0.4)
 *
 * Displays the full lifecycle of a voice-triggered SMS in a single animated card:
 *
 *   YOU SAID   → raw transcript ("Send SMS to Mom")
 *   INTENT     → detected command ("SMS Mom")
 *   CONTACT    → resolved contact name + number, OR error state
 *   MESSAGE    → the message body (when available)
 *   STATUS     → Searching… / Listening… / Confirm? / Sending… / ✓ Sent / ✗ Failed
 *
 * When multiple contacts match the spoken name, the card switches to a contact
 * picker so the user can tap the right person.
 *
 * ── SmsFeedbackState lifecycle ────────────────────────────────────────────────
 *
 *   none
 *     │  (SMS command recognised)
 *   searching
 *     ├─► not_found        ("I couldn't find that contact")
 *     ├─► contacts_error   (permission denied)
 *     ├─► multiple_found   (show contact picker)
 *     │       │ (user taps a contact)
 *     └─► awaiting_message ("What would you like to say?")  ← if no inline message
 *           │  (user speaks the message)
 *         confirming        ("You said: X. Say YES to send.")
 *           ├─► sending     (opening SMS app)
 *           │       ├─► sent    (✓ SMS app opened)
 *           │       └─► failed  (✗ error / cancelled)
 *           └─► cancelled   (user said no)
 *
 *   OR when message is extracted from the command:
 *   searching → (contact found) → confirming (skips awaiting_message)
 */

import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { ContactMatch } from '@/utils/contactsManager';

// ── State type ────────────────────────────────────────────────────────────────

export type SmsFeedbackState =
  | { phase: 'none' }
  | { phase: 'searching';        transcript: string; contactName: string }
  | { phase: 'not_found';        transcript: string; contactName: string }
  | { phase: 'contacts_error';   transcript: string; contactName: string; reason: string }
  | { phase: 'multiple_found';   transcript: string; contactName: string; contacts: ContactMatch[] }
  | { phase: 'awaiting_message'; transcript: string; contactName: string; contact: ContactMatch }
  | { phase: 'confirming';       transcript: string; contactName: string; contact: ContactMatch; message: string }
  | { phase: 'sending';          transcript: string; contactName: string; contact: ContactMatch; message: string }
  | { phase: 'sent';             transcript: string; contactName: string; contact: ContactMatch; message: string }
  | { phase: 'cancelled';        transcript: string; contactName: string; contact: ContactMatch; message: string }
  | { phase: 'failed';           transcript: string; contactName: string; contact: ContactMatch; message: string; reason: string };

// ── Props ─────────────────────────────────────────────────────────────────────

interface SmsFeedbackProps {
  state: SmsFeedbackState;
  /** Called when the user taps a contact in the multi-match picker */
  onContactSelected: (contact: ContactMatch) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SmsFeedback({ state, onContactSelected }: SmsFeedbackProps) {
  const colors = useColors();
  const opacity   = useSharedValue(0);
  const translateY = useSharedValue(20);

  const visible = state.phase !== 'none';

  useEffect(() => {
    if (visible) {
      opacity.value    = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    } else {
      opacity.value    = withTiming(0, { duration: 200 });
      translateY.value = withTiming(20, { duration: 200 });
    }
  }, [visible, state.phase]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const s = state as Exclude<SmsFeedbackState, { phase: 'none' }>;

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        animStyle,
      ]}
    >
      {/* ── Row 1: You said ── */}
      <InfoRow icon="message-circle" label="YOU SAID" value={`"${s.transcript}"`} />
      <Divider />

      {/* ── Row 2: Intent ── */}
      <InfoRow icon="send" label="INTENT" value={`SMS to ${s.contactName}`} />
      <Divider />

      {/* ── Phase-specific content ── */}
      <PhaseContent state={s} onContactSelected={onContactSelected} />
    </Animated.View>
  );
}

// ── Phase-specific content ────────────────────────────────────────────────────

function PhaseContent({
  state,
  onContactSelected,
}: {
  state: Exclude<SmsFeedbackState, { phase: 'none' }>;
  onContactSelected: (contact: ContactMatch) => void;
}) {
  const colors = useColors();

  switch (state.phase) {

    // ── Searching contacts ────────────────────────────────────────────────────
    case 'searching':
      return (
        <InfoRow
          icon="search"
          label="STATUS"
          value={
            <StatusRow>
              <ActivityIndicator size="small" color={colors.processingRing} />
              <StatusLabel color={colors.processingRing}>Searching contacts…</StatusLabel>
            </StatusRow>
          }
        />
      );

    // ── Contact not found ─────────────────────────────────────────────────────
    case 'not_found':
      return (
        <>
          <InfoRow
            icon="user-x"
            label="CONTACT"
            value="Not found"
            valueColor={colors.destructive}
          />
          <Divider />
          <InfoRow
            icon="alert-circle"
            label="STATUS"
            value={
              <StatusRow>
                <Feather name="x-circle" size={15} color={colors.destructive} />
                <StatusLabel color={colors.destructive}>{`No contact matched "${state.contactName}"`}</StatusLabel>
              </StatusRow>
            }
          />
        </>
      );

    // ── Contacts permission error ─────────────────────────────────────────────
    case 'contacts_error':
      return (
        <>
          <InfoRow
            icon="lock"
            label="CONTACT"
            value="Access denied"
            valueColor={colors.processingRing}
          />
          <Divider />
          <InfoRow
            icon="alert-triangle"
            label="STATUS"
            value={
              <StatusRow>
                <Feather name="alert-triangle" size={15} color={colors.processingRing} />
                <StatusLabel color={colors.processingRing}>{state.reason}</StatusLabel>
              </StatusRow>
            }
          />
        </>
      );

    // ── Multiple contacts — tap to select ─────────────────────────────────────
    case 'multiple_found':
      return (
        <>
          <InfoRow
            icon="users"
            label="CONTACT"
            value={`${state.contacts.length} matches — tap one to text`}
            valueColor={colors.processingRing}
          />
          <Divider />
          <ContactList contacts={state.contacts} onSelect={onContactSelected} />
        </>
      );

    // ── Waiting for the user to speak the message ─────────────────────────────
    case 'awaiting_message':
      return (
        <>
          <InfoRow
            icon="user-check"
            label="CONTACT"
            value={`${state.contact.displayName}  ·  ${state.contact.phoneNumber}`}
          />
          <Divider />
          <InfoRow
            icon="mic"
            label="STATUS"
            value={
              <StatusRow>
                <ActivityIndicator size="small" color={colors.listeningRing} />
                <StatusLabel color={colors.listeningRing}>Listening for your message…</StatusLabel>
              </StatusRow>
            }
          />
        </>
      );

    // ── Confirming the message before sending ─────────────────────────────────
    case 'confirming':
      return (
        <>
          <InfoRow
            icon="user-check"
            label="CONTACT"
            value={`${state.contact.displayName}  ·  ${state.contact.phoneNumber}`}
          />
          <Divider />
          <InfoRow icon="file-text" label="MESSAGE" value={`"${state.message}"`} />
          <Divider />
          <InfoRow
            icon="help-circle"
            label="STATUS"
            value={
              <StatusRow>
                <ActivityIndicator size="small" color={colors.processingRing} />
                <StatusLabel color={colors.processingRing}>Say YES to send or NO to cancel</StatusLabel>
              </StatusRow>
            }
          />
        </>
      );

    // ── Opening SMS app ───────────────────────────────────────────────────────
    case 'sending':
      return (
        <>
          <InfoRow
            icon="user-check"
            label="CONTACT"
            value={`${state.contact.displayName}  ·  ${state.contact.phoneNumber}`}
          />
          <Divider />
          <InfoRow icon="file-text" label="MESSAGE" value={`"${state.message}"`} />
          <Divider />
          <InfoRow
            icon="send"
            label="STATUS"
            value={
              <StatusRow>
                <ActivityIndicator size="small" color={colors.listeningRing} />
                <StatusLabel color={colors.listeningRing}>Opening SMS app…</StatusLabel>
              </StatusRow>
            }
          />
        </>
      );

    // ── SMS app opened successfully ───────────────────────────────────────────
    case 'sent':
      return (
        <>
          <InfoRow
            icon="user-check"
            label="CONTACT"
            value={`${state.contact.displayName}  ·  ${state.contact.phoneNumber}`}
          />
          <Divider />
          <InfoRow icon="file-text" label="MESSAGE" value={`"${state.message}"`} />
          <Divider />
          <InfoRow
            icon="check-circle"
            label="STATUS"
            value={
              <StatusRow>
                <Feather name="check-circle" size={15} color={colors.listeningRing} />
                <StatusLabel color={colors.listeningRing}>SMS app opened — tap Send</StatusLabel>
              </StatusRow>
            }
          />
        </>
      );

    // ── User cancelled ────────────────────────────────────────────────────────
    case 'cancelled':
      return (
        <>
          <InfoRow
            icon="user-check"
            label="CONTACT"
            value={`${state.contact.displayName}  ·  ${state.contact.phoneNumber}`}
          />
          <Divider />
          <InfoRow icon="file-text" label="MESSAGE" value={`"${state.message}"`} />
          <Divider />
          <InfoRow
            icon="x-circle"
            label="STATUS"
            value={
              <StatusRow>
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
                <StatusLabel color={colors.mutedForeground}>Cancelled</StatusLabel>
              </StatusRow>
            }
          />
        </>
      );

    // ── Send failed ───────────────────────────────────────────────────────────
    case 'failed':
      return (
        <>
          <InfoRow
            icon="user-check"
            label="CONTACT"
            value={`${state.contact.displayName}  ·  ${state.contact.phoneNumber}`}
          />
          <Divider />
          <InfoRow icon="file-text" label="MESSAGE" value={`"${state.message}"`} />
          <Divider />
          <InfoRow
            icon="alert-circle"
            label="STATUS"
            value={
              <StatusRow>
                <Feather name="x-circle" size={15} color={colors.destructive} />
                <StatusLabel color={colors.destructive}>{state.reason}</StatusLabel>
              </StatusRow>
            }
          />
        </>
      );
  }
}

// ── Contact picker (multiple_found) ──────────────────────────────────────────

function ContactList({
  contacts,
  onSelect,
}: {
  contacts: ContactMatch[];
  onSelect: (c: ContactMatch) => void;
}) {
  const colors = useColors();

  return (
    <FlatList
      data={contacts}
      keyExtractor={(item) => item.id}
      scrollEnabled={contacts.length > 3}
      style={{ maxHeight: 180 }}
      ItemSeparatorComponent={() => <Divider />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onSelect(item)}
          style={({ pressed }) => [
            styles.contactRow,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          {/* Avatar initial */}
          <View style={[styles.avatar, { backgroundColor: colors.primary + '33' }]}>
            <Text style={[styles.avatarLetter, { color: colors.primary }]}>
              {item.displayName[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>

          {/* Name + number */}
          <View style={styles.contactInfo}>
            <Text style={[styles.contactName, { color: colors.foreground }]}>
              {item.displayName}
            </Text>
            <Text style={[styles.contactNumber, { color: colors.mutedForeground }]}>
              {item.phoneLabel} · {item.phoneNumber}
            </Text>
          </View>

          {/* SMS icon */}
          <Feather name="message-square" size={18} color={colors.accent} />
        </Pressable>
      )}
    />
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <View style={styles.rowHeader}>
        <Feather name={icon as any} size={11} color={colors.accent} />
        <Text style={[styles.rowLabel, { color: colors.accent }]}>{label}</Text>
      </View>
      {typeof value === 'string' ? (
        <Text style={[styles.rowValue, { color: valueColor ?? colors.foreground }]}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

function StatusRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.statusRow}>{children}</View>;
}

function StatusLabel({ children, color }: { children: string; color: string }) {
  return <Text style={[styles.rowValue, { color }]}>{children}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },

  infoRow: { gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  contactNumber: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
});
