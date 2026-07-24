/**
 * Sidebar — Vedra AI Assistant
 *
 * Collapsible left sidebar with glass morphism aesthetic.
 * Slides in/out with a backdrop overlay on mobile.
 */

import React, { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// ── Constants ─────────────────────────────────────────────────────────────────
const SIDEBAR_WIDTH = 260;

// ── Types ─────────────────────────────────────────────────────────────────────
interface NavItem {
  icon: string;
  label: string;
  id: string;
  featherIcon?: string;
}

const WORKSPACE_ITEMS: NavItem[] = [
  { icon: '✨', label: 'Ask Ved',       id: 'ask',         featherIcon: 'zap' },
  { icon: '📁', label: 'Quick Vault',   id: 'vault',       featherIcon: 'folder' },
  { icon: '🧠', label: 'Knowledge Base',id: 'kb',          featherIcon: 'book-open' },
];

const SYSTEM_ITEMS: NavItem[] = [
  { icon: '⚙',  label: 'Settings',     id: 'settings',    featherIcon: 'settings' },
  { icon: '🩺',  label: 'Diagnostics',  id: 'diagnostics', featherIcon: 'activity' },
];

interface SidebarProps {
  isOpen: boolean;
  activeNav: string;
  onNavSelect: (id: string) => void;
  onClose: () => void;
  conversationHistory?: { userText: string }[];
  onSettings: () => void;
  onDiagnostics: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Sidebar({
  isOpen, activeNav, onNavSelect, onClose,
  conversationHistory = [],
  onSettings, onDiagnostics,
}: SidebarProps) {
  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(isOpen ? 0 : -SIDEBAR_WIDTH, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    backdropOpacity.value = withTiming(isOpen ? 1 : 0, { duration: 280 });
  }, [isOpen]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: isOpen ? 'auto' : 'none',
  }));

  return (
    <>
      {/* ── Backdrop ── */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Sidebar panel ── */}
      <Animated.View style={[styles.sidebar, sidebarStyle]}>
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>VEDRA</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {/* Workspace */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>WORKSPACE</Text>
            {WORKSPACE_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.navItem, activeNav === item.id && styles.navItemActive]}
                onPress={() => { onNavSelect(item.id); onClose(); }}
                activeOpacity={0.7}
              >
                <Feather
                  name={item.featherIcon as any}
                  size={15}
                  color={activeNav === item.id ? '#00F2FE' : 'rgba(255,255,255,0.45)'}
                />
                <Text style={[styles.navLabel, activeNav === item.id && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recent History — real conversation turns */}
          {conversationHistory.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>RECENT HISTORY</Text>
              {conversationHistory.slice(-5).reverse().map((turn, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.navItem}
                  onPress={() => onClose()}
                  activeOpacity={0.7}
                >
                  <Feather name="message-circle" size={14} color="rgba(255,255,255,0.35)" />
                  <Text style={styles.navLabel} numberOfLines={1}>
                    {turn.userText.length > 28 ? turn.userText.slice(0, 28) + '…' : turn.userText}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* System */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>SYSTEM</Text>
            {SYSTEM_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.navItem}
                onPress={() => {
                  onClose();
                  if (item.id === 'settings')    onSettings();
                  if (item.id === 'diagnostics') onDiagnostics();
                }}
                activeOpacity={0.7}
              >
                <Feather
                  name={item.featherIcon as any}
                  size={15}
                  color="rgba(255,255,255,0.45)"
                />
                <Text style={styles.navLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Footer — Upgrade card */}
        <View style={styles.upgradeCard}>
          <Text style={styles.upgradeTitle}>Vedra Pro</Text>
          <Text style={styles.upgradeSubtitle}>Unlock GPT-5 & local file analysis.</Text>
          <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.8}>
            <Text style={styles.upgradeBtnText}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 20,
  },

  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#090A0F',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    zIndex: 30,
    flexDirection: 'column',
  },

  // Brand
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 36,
    paddingLeft: 4,
  },
  brandDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00F2FE',
    shadowColor: '#00F2FE',
    shadowRadius: 8,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
  },
  brandText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // Nav sections
  section: { marginBottom: 28 },
  sectionHeader: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 12,
    paddingLeft: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: 'rgba(79,172,254,0.12)',
  },
  navIcon: { fontSize: 16 },
  navLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.65)',
  },
  navLabelActive: {
    color: '#00F2FE',
    fontFamily: 'Inter_600SemiBold',
  },

  // Upgrade card
  upgradeCard: {
    backgroundColor: 'rgba(0,242,254,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(0,242,254,0.18)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  upgradeSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 10,
  },
  upgradeBtn: {
    backgroundColor: 'rgba(0,242,254,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0,242,254,0.4)',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 20,
  },
  upgradeBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#00F2FE',
  },
});
