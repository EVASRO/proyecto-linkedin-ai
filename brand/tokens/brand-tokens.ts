/**
 * cazary.ai — Design Tokens (TypeScript)
 * Para uso en Tailwind config, styled-components, o inline styles.
 * Fuente: Manual de Marca Oficial 2026
 */

export const cazaryBrand = {
  // ─── IDENTIDAD ────────────────────────────────────────────────────
  name: 'cazary.ai',
  domain: 'cazary.ai',

  // ─── GRADIENTE IDENTIDAD (Z + Flecha) ─────────────────────────────
  gradient: {
    cobalt:  '#2563EB',   // Cobalto Tech — cuerpo de la 'Z'
    cyan:    '#06B6D4',   // Cian Eléctrico — flecha y acentos IA
    css:     'linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)',
    cssV:    'linear-gradient(180deg,  #2563EB 0%, #06B6D4 100%)',
  },

  // ─── FONDOS ───────────────────────────────────────────────────────
  bg: {
    dark:    '#0F172A',   // Slate muy oscuro — dark mode UI
    light:   '#F8FAFC',  // Off-white — light mode UI
    sidebar: '#080F1E',  // Sidebar — siempre dark
  },

  // ─── TEXTO ────────────────────────────────────────────────────────
  text: {
    onDark:  '#FFFFFF',
    onLight: '#1E293B',
    muted:   '#94A3B8',
    faint:   '#475569',
  },

  // ─── COLORES FUNCIONALES ──────────────────────────────────────────
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    danger:  '#EF4444',
    info:    '#06B6D4',
  },

  // ─── TIPOGRAFÍA ───────────────────────────────────────────────────
  fonts: {
    sans: ['Inter', 'Plus Jakarta Sans', 'Helvetica Neue', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  },
} as const

// ─── TAILWIND COLOR EXTENSION ──────────────────────────────────────
// Pegar en tailwind.config.ts → theme.extend.colors
export const cazaryTailwindColors = {
  cazary: {
    cobalt:  '#2563EB',
    cyan:    '#06B6D4',
    dark:    '#0F172A',
    light:   '#F8FAFC',
    sidebar: '#080F1E',
    surface: {
      dark:  '#1E293B',
      light: '#FFFFFF',
    },
    success: '#10B981',
    warning: '#F59E0B',
    danger:  '#EF4444',
  },
}

export type CazaryTheme = 'dark' | 'light'
