/**
 * The landing page's seven semantic colours, as hex.
 *
 * Kept in one place so the stage, the static plan fallback and the tests agree;
 * screens never import this (they use CSS variables), only lib code does.
 */
export const LANDING_PALETTE = {
  paper: '#F3EFE6', // Paper Ivory: the sheet
  graphite: '#252B35', // Graphite: ink, walls
  signal: '#4785F5', // Signal Blue: detected
  jade: '#20B89A', // Jade: recognised / pass
  amber: '#F2AD53', // Amber: uncertain / edit
  coral: '#E66C68', // Coral: fail
  mineral: '#B9C9C5', // Mineral: neutral concrete
} as const;

export type LandingColour = keyof typeof LANDING_PALETTE;
