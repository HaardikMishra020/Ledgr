/**
 * Ledgr Design Tokens — Single source of truth
 * Extracted from Stitch project: projects/1000559476541031569
 * Values match the Stitch-generated Tailwind config exactly.
 *
 * Consume this file only in tailwind.config.ts.
 * Components use Tailwind class names — never import tokens directly.
 */

// ---------------------------------------------------------------------------
// Brand palette (semantic intent anchors)
// ---------------------------------------------------------------------------
export const brand = {
  /** Jet black — primary actions, logo, nav (Material Design 3 primary role) */
  black: "#000000",
  /** Teal — success, "you are owed" amounts (secondary role) */
  teal: "#006b5f",
  /** Red — error, "you owe" amounts (error role) */
  red: "#ba1a1a",
  /** Off-white — base background canvas */
  offWhite: "#f7f9fb",
} as const;

// ---------------------------------------------------------------------------
// Full color palette (Material Design 3 roles — from Stitch HTML config)
// ---------------------------------------------------------------------------
export const colors = {
  // --- Primary (Black) ---
  primary: "#000000",
  "on-primary": "#ffffff",
  "primary-container": "#1b1b1b",
  "on-primary-container": "#848484",
  "inverse-primary": "#c6c6c6",
  "primary-fixed": "#e2e2e2",
  "primary-fixed-dim": "#c6c6c6",
  "on-primary-fixed": "#1b1b1b",
  "on-primary-fixed-variant": "#474747",

  // --- Secondary (Teal) ---
  secondary: "#006b5f",
  "on-secondary": "#ffffff",
  "secondary-container": "#9cefdf",
  "on-secondary-container": "#0b6f63",
  "secondary-fixed": "#9ff2e2",
  "secondary-fixed-dim": "#83d5c6",
  "on-secondary-fixed": "#00201c",
  "on-secondary-fixed-variant": "#005047",

  // --- Tertiary (Black) ---
  tertiary: "#000000",
  "on-tertiary": "#ffffff",
  "tertiary-container": "#410002",
  "on-tertiary-container": "#f0443a",
  "tertiary-fixed": "#ffdad5",
  "tertiary-fixed-dim": "#ffb4ab",
  "on-tertiary-fixed": "#410002",
  "on-tertiary-fixed-variant": "#930009",

  // --- Error ---
  error: "#ba1a1a",
  "on-error": "#ffffff",
  "error-container": "#ffdad6",
  "on-error-container": "#93000a",

  // --- Background ---
  background: "#f7f9fb",
  "on-background": "#191c1e",

  // --- Surface scale (lowest = brightest → highest = darkest neutral) ---
  "surface-container-lowest": "#ffffff",
  "surface-container-low": "#f2f4f6",
  "surface-container": "#eceef0",
  "surface-container-high": "#e6e8ea",
  "surface-container-highest": "#e0e3e5",
  surface: "#f7f9fb",
  "surface-dim": "#d8dadc",
  "surface-bright": "#f7f9fb",
  "surface-variant": "#e0e3e5",
  "surface-tint": "#5e5e5e",
  "on-surface": "#191c1e",
  "on-surface-variant": "#4c4546",
  "inverse-surface": "#2d3133",
  "inverse-on-surface": "#eff1f3",

  // --- Outline ---
  outline: "#7e7576",
  "outline-variant": "#cfc4c5",
} as const;

// ---------------------------------------------------------------------------
// Semantic aliases — use these for intent, not raw palette
// ---------------------------------------------------------------------------
export const semantic = {
  /** Positive financial state — "you are owed" */
  owed: colors.secondary,
  "on-owed": colors["on-secondary"],

  /** Negative financial state — "you owe" */
  owes: colors.error,
  "on-owes": colors["on-error"],

  /** Settled / neutral transaction */
  settled: colors.outline,

  /** Card surface (pure white) */
  card: colors["surface-container-lowest"],
  "card-border": colors["outline-variant"],

  /** App background */
  canvas: colors.background,
} as const;

// ---------------------------------------------------------------------------
// Typography — all faces are Inter
// ---------------------------------------------------------------------------
export const fontFamily = {
  // Base utility
  sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
  // Stitch semantic aliases — all resolve to Inter
  // These generate font-{name} utilities used in Stitch-generated HTML
  "body-lg": ["Inter"],
  "label-md": ["Inter"],
  "headline-lg": ["Inter"],
  "amount-display": ["Inter"],
  "headline-md": ["Inter"],
  "headline-lg-mobile": ["Inter"],
  "body-md": ["Inter"],
} as const;

export const fontSize = {
  "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
  "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "700" }],
  "headline-md": ["20px", { lineHeight: "28px", fontWeight: "600" }],
  /** Always the most prominent number on-screen */
  "amount-display": ["28px", { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "600" }],
  "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
  "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
  "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
} as const;

// ---------------------------------------------------------------------------
// Spacing (8px base unit)
// ---------------------------------------------------------------------------
export const spacing = {
  base: "8px",
  "element-gap": "12px",
  gutter: "16px",
  "card-padding": "20px",
  "container-padding": "24px",
} as const;

// ---------------------------------------------------------------------------
// Border radius — matches Tailwind v3 defaults (which Stitch uses verbatim)
// ---------------------------------------------------------------------------
export const borderRadius = {
  sm: "0.125rem",  // 2px
  DEFAULT: "0.25rem", // 4px
  md: "0.375rem",  // 6px
  lg: "0.5rem",    // 8px  — buttons, inputs, small cards
  xl: "0.75rem",   // 12px — feature cards, floating card
  "2xl": "1rem",   // 16px
  "3xl": "1.5rem", // 24px — hero image, CTA section
  full: "9999px",  // pill badges, avatars
} as const;

// ---------------------------------------------------------------------------
// Elevation & Shadows
// Tonal: large blur, very low opacity, tinted with secondary teal
// ---------------------------------------------------------------------------
export const boxShadow = {
  none: "none",
  /** Cards and interactive surfaces — teal-tinted ambient */
  tonal: "0 4px 16px -4px rgba(0, 107, 95, 0.06)",
  /** Modals and overlays */
  modal: "0 8px 32px 0 rgba(0, 0, 0, 0.12)",
  /** Input focus ring */
  "focus-ring": "0 0 0 3px rgba(0, 0, 0, 0.10)",
} as const;

// ---------------------------------------------------------------------------
// Component intent map (documentation only — use Tailwind classes in JSX)
// ---------------------------------------------------------------------------
export const components = {
  button: {
    primary: { bg: colors.primary, text: colors["on-primary"], radius: borderRadius.lg },
    ghost: { bg: "transparent", border: colors["outline-variant"], text: colors["on-surface"], radius: borderRadius.lg },
  },
  card: {
    bg: colors["surface-container-lowest"],
    border: colors["outline-variant"],
    radius: borderRadius.xl,
    shadow: boxShadow.tonal,
    padding: spacing["card-padding"],
  },
  input: {
    bg: colors["surface-container-lowest"],
    border: colors["outline-variant"],
    "border-focus": colors.primary,
    radius: borderRadius.lg,
  },
  chip: {
    bg: colors["secondary-container"],
    text: colors["on-secondary-container"],
    radius: borderRadius.full,
  },
  amount: {
    owed: semantic.owed,
    owes: semantic.owes,
    settled: semantic.settled,
  },
} as const;
