/**
 * Assigns a stable, distinct color to each agent name.
 * Colors are picked from a perceptually-distinct palette that works on both
 * dark and light themes, stored in CSS-variable form where possible.
 *
 * The palette intentionally avoids the theme primary (phosphor/amber) so
 * agent colors don't clash with status colors.
 */

// 10 distinct hues — enough for any realistic team size.
// Intentionally avoids warm orange (#ff8c42 = --amber) and yellow to prevent
// clashing with the in-progress status color.
const PALETTE: string[] = [
  '#5bc8f5', // cyan-blue  (matches --ice)
  '#f472b6', // rose pink
  '#a78bfa', // soft violet
  '#34d399', // mint green
  '#fb7185', // coral-red
  '#60cdff', // sky blue
  '#c084fc', // lavender
  '#4ade80', // lime green
  '#e879f9', // fuchsia
  '#38bdf8', // light blue
];

const cache = new Map<string, string>();
let nextIndex = 0;

/**
 * Returns a stable hex color for an agent name.
 * The mapping is deterministic within a session.
 */
export function agentColor(name: string): string {
  if (!name) return '#94a3b8';
  if (cache.has(name)) return cache.get(name)!;
  const color = PALETTE[nextIndex % PALETTE.length];
  nextIndex++;
  cache.set(name, color);
  return color;
}

/** Translucent background version (10% opacity) */
export function agentColorBg(name: string): string {
  const hex = agentColor(name);
  return hex + '1a'; // ~10% alpha
}

/** Returns initials for an agent name (up to 2 chars) */
export function agentInitials(name: string): string {
  if (!name) return '?';
  const parts = name.split(/[-_\s]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Tiny colored avatar badge */
export interface AgentAvatarStyle {
  background: string;
  border: string;
  color: string;
}
export function agentAvatarStyle(name: string): AgentAvatarStyle {
  const hex = agentColor(name);
  return {
    background: hex + '22',
    border: `1px solid ${hex}55`,
    color: hex,
  };
}
