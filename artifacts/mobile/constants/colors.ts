/**
 * Vedra Design Tokens
 *
 * Deep dark theme with an indigo/violet accent — evokes a premium AI assistant.
 * Colors are organised as semantic tokens so components stay theme-unaware.
 *
 * Listening state uses `listeningRing` (green) to give clear visual feedback.
 * Processing state uses `processingRing` (amber) to indicate "thinking".
 */

const colors = {
  light: {
    // ─── Base surfaces ────────────────────────────────────────────────────────
    background: '#070711',       // near-black navy
    foreground: '#F1F5F9',       // off-white text

    // ─── Cards / elevated panels ──────────────────────────────────────────────
    card: '#0E0E1C',
    cardForeground: '#F1F5F9',

    // ─── Primary action — mic button idle colour ───────────────────────────────
    primary: '#6366F1',          // indigo
    primaryForeground: '#FFFFFF',

    // ─── Secondary surfaces ───────────────────────────────────────────────────
    secondary: '#141428',
    secondaryForeground: '#F1F5F9',

    // ─── Muted / subdued ──────────────────────────────────────────────────────
    muted: '#1E1E38',
    mutedForeground: '#64748B',

    // ─── Accent glow colour ───────────────────────────────────────────────────
    accent: '#818CF8',           // soft indigo glow
    accentForeground: '#070711',

    // ─── State colours ────────────────────────────────────────────────────────
    listeningRing: '#22C55E',    // vivid green — "I'm listening"
    processingRing: '#F59E0B',   // amber — "thinking"

    // ─── Semantic ─────────────────────────────────────────────────────────────
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
    border: '#1E1E38',
    input: '#1E1E38',

    // ─── Legacy alias (kept for scaffold compatibility) ────────────────────────
    text: '#F1F5F9',
    tint: '#6366F1',
  },

  // Border radius shared across cards, buttons, inputs
  radius: 16,
};

export default colors;
