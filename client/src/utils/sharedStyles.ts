/**
 * Shared CRT-style section & button styles.
 *
 * Extracted from MemoryView, ContextSummaryView, KnowledgeTransfer
 * to eliminate 3× identical definitions.
 */

import type { CSSProperties } from 'react';

export const sectionStyle: CSSProperties = {
  background: 'var(--surface-0)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  overflow: 'hidden',
};

export const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface-1)',
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

type BtnVariant = 'primary' | 'ghost' | 'danger';

const VARIANT_COLORS: Record<BtnVariant, { border: string; bg: string; fg: string }> = {
  primary: {
    border: 'var(--phosphor)',
    bg: 'var(--phosphor-glow)',
    fg: 'var(--phosphor)',
  },
  ghost: {
    border: 'var(--border)',
    bg: 'transparent',
    fg: 'var(--text-secondary)',
  },
  danger: {
    border: 'var(--crimson, #ff4466)',
    bg: 'transparent',
    fg: 'var(--crimson, #ff4466)',
  },
};

export function btnStyle(variant: BtnVariant = 'ghost'): CSSProperties {
  const v = VARIANT_COLORS[variant];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.06em',
    border: `1px solid ${v.border}`,
    borderRadius: '3px',
    background: v.bg,
    color: v.fg,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textTransform: 'uppercase',
  };
}
