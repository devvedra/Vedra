/**
 * CallFeedback.tsx — Vedra Call UI Module
 *
 * Displays the full lifecycle of a voice-triggered phone call in a single card:
 *
 *   YOU SAID    → raw transcript ("Call Mom")
 *   INTENT      → detected command ("Call Mom")
 *   CONTACT     → resolved contact name + number, OR "Not found"
 *   STATUS      → Searching… / Calling… / ✓ Call started / ✗ Failed
 *
 * When multiple contacts match the spoken name, the card switches to a
 * scrollable contact picker so the user can tap the right person.
 *
 * ── FeedbackState lifecycle ───────────────────────────────────────────────────
 *
 *   none
 *     │  (voice result arrives)
 *   searching  ──────────────────────────────────────────┐
 *     │                                                   │ (no contacts access)
 *     ├─► not_found       ("I couldn't find that contact") │
 *     ├─► contacts_error  (contacts permission denied)    │
 *     ├─► multiple_found  (show picker)                   │
 *     │      │ (user taps a contact)                      │
 *     └─► calling ◄────────────────────────────────────────┘
 *           │
 *           ├─► call_started  (dialer / direct call opened)
 *           └─► call_failed   (dialer unavailable)
 */

import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
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

export type CallFeedbackState =
  | { phase: 'none' }
  | { phase: 'searching';       transcript: string; contactName: string }
  | { phase: 'not_found';       transcript: string; contactName: string }
  | { phase: 'contacts_error';  transcript: string; contactName: string; reason: string }
  | { phase: 'multiple_found';  transcript: string; contactName: string; contacts: ContactMatch[] }
  | { phase: 'calling';         transcript: string; contactName: string; contact: ContactMatch }
  | { phase: 'call_started';    transcript: string; contactName: string; contact: ContactMatch; method: 'direct' | 'dialer' }
  | { phase: 'call_failed';     transcript: string; contactName: string; contact: ContactMatch };

// ── Props ─────────────────────────────────────────────────────────────────────

interface CallFeedbackProps {
  state: CallFeedbackState;
  /** Called when the user taps a contact in the picker (multiple_found phase) */
  onContactSelected: (contact: ContactMatch) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CallFeedback({ state, onContactSelected }: CallFeedbackProps) {
  const colors = useColors();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  const visible = state.phase !== 'none';

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(20, { duration: 200 });
    }
  }, [visible, state.phase]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const s = state as Exclude<CallFeedbackState, { phase: 'none' }>;

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

      {/* ── Row 2: Detected intent ── */}
      <InfoRow icon="phone-call" label="INTENT" value={`Call ${s.contactName}`} />
      <Divider />

      {/* ── Rows 3 & 4: Contact + Status (vary by phase) ── */}
      <PhaseContent state={s} onContactSelected={onContactSelected} />
    </Animated.View>
  );
}

// ── Phase-specific content ────────────────────────────────────────────────────

function PhaseContent({
  state,
  onContactSelected,
}: {
  state: Exclude<CallFeedbackState, { phase: 'none' }>;
  onContactSelected: (contact: ContactMatch) => void;
}) {
  const colors = useColors();

  switch (state.phase) {
    // ── Searching ──────────────────────────────────────────────────────────
    case 'searching':
      return (
        <InfoRow
          icon="search"
          label="STATUS"
          value={
            <Row>
              <ActivityIndicator size="small" color={colors.processingRing} />
              <StatusText color={colors.processingRing}>Searching contacts…</StatusText>
            </Row>
          }
        />
      );

    // ── Not found ──────────────────────────────────────────────────────────
    case 'not_found':
      return (
        <>
          <InfoRow icon="user-x" label="CONTACT" value="Not found" valueColor={colors.destructive} />
          <Divider />
          <InfoRow
            icon="alert-circle"
            label="STATUS"
            value={
              <Row>
                <Feather name="x-circle" size={15} color={colors.destructive} />
                <StatusText color={colors.destructive}>{`No contact matched "${state.contactName}"`}</StatusText>
              </Row>
            }
          />
        </>
      );

    // ── Contacts permission error ──────────────────────────────────────────
    case 'contacts_error':
      return (
        <>
          <InfoRow icon="lock" label="CONTACT" value="Access denied" valueColor={colors.processingRing} />
          <Divider />
          <InfoRow
            icon="alert-triangle"
            label="STATUS"
            value={
              <Row>
                <Feather name="alert-triangle" size={15} color={colors.processingRing} />
                <StatusText color={colors.processingRing}>{state.reason}</StatusText>
              </Row>
            }
          />
        </>
      );

    // ── Multiple contacts — show picker ────────────────────────────────────
    case 'multiple_found':
      return (
        <>
          <InfoRow
            icon="users"
            label="CONTACT"
            value={`${state.contacts.length} matches — tap one to call`}
            valueColor={colors.processingRing}
          />
          <Divider />
          <ContactList contacts={state.contacts} onSelect={onContactSelected} />
        </>
      );

    // ── Calling (in progress) ──────────────────────────────────────────────
    case 'calling':
      return (
        <>
          <InfoRow
            icon="user-check"
            label="CONTACT"
            value={`${state.contact.displayName}  ·  ${state.contact.phoneNumber}`}
          />
          <Divider />
          <InfoRow
            icon="phone"
            label="STATUS"
            value={
              <Row>
                <ActivityIndicator size="small" color={colors.listeningRing} />
                <StatusText color={colors.listeningRing}>Initiating call…</StatusText>
              </Row>
            }
          />
        </>
      );

    // ── Call started ───────────────────────────────────────────────────────
    case 'call_started':
      return (
        <>
          <InfoRow
            icon="user-check"
            label="CONTACT"
            value={`${state.contact.displayName}  ·  ${state.contact.phoneNumber}`}
          />
          <Divider />
          <InfoRow
            icon="phone"
            label="STATUS"
            value={
              <Row>
                <Feather name="check-circle" size={15} color={colors.listeningRing} />
                <StatusText color={colors.listeningRing}>
                  {state.method === 'direct' ? 'Calling directly…' : 'Dialer opened'}
                </StatusText>
              </Row>
            }
          />
        </>
      );

    // ── Call failed ────────────────────────────────────────────────────────
    case 'call_failed':
      return (
        <>
          <InfoRow
            icon="user-check"
            label="CONTACT"
            value={`${state.contact.displayName}  ·  ${state.contact.phoneNumber}`}
          />
          <Divider />
          <InfoRow
            icon="phone-missed"
            label="STATUS"
            value={
              <Row>
                <Feather name="x-circle" size={15} color={colors.destructive} />
                <StatusText color={colors.destructive}>Could not place call</StatusText>
              </Row>
            }
          />
        </>
      );
  }
}

// ── Contact list (multiple_found picker) ─────────────────────────────────────

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

          {/* Call icon */}
          <Feather name="phone" size={18} color={colors.listeningRing} />
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

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.statusRow}>{children}</View>;
}

function StatusText({ children, color }: { children: string; color: string }) {
  return (
    <Text style={[styles.rowValue, { color }]}>{children}</Text>
  );
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

  // Info rows
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

  // Divider
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Contact picker
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
  avatarLetter: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  contactNumber: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
});
