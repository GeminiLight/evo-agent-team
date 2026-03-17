import { describe, it, expect, beforeEach } from 'vitest';

// The module uses a module-level cache + counter, so we need to
// re-import with a fresh module for isolation in some tests.
// For basic tests, we can use the same import.

describe('agentColors', () => {
  // We dynamically import to get a fresh module per describe block where needed
  let agentColor: (name: string) => string;
  let agentColorBg: (name: string) => string;
  let agentInitials: (name: string) => string;
  let agentAvatarStyle: (name: string) => { background: string; border: string; color: string };

  beforeEach(async () => {
    // Use a fresh module each time to reset the cache
    const mod = await import('../../utils/agentColors');
    agentColor = mod.agentColor;
    agentColorBg = mod.agentColorBg;
    agentInitials = mod.agentInitials;
    agentAvatarStyle = mod.agentAvatarStyle;
  });

  describe('agentColor', () => {
    it('returns a hex color', () => {
      expect(agentColor('alice')).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('is idempotent for the same name', () => {
      const c1 = agentColor('bob');
      const c2 = agentColor('bob');
      expect(c1).toBe(c2);
    });

    it('returns distinct colors for 10 different names', () => {
      const names = Array.from({ length: 10 }, (_, i) => `agent-${i}`);
      const colors = names.map(n => agentColor(n));
      expect(new Set(colors).size).toBe(10);
    });

    it('returns fallback #94a3b8 for empty name', () => {
      expect(agentColor('')).toBe('#94a3b8');
    });
  });

  describe('agentInitials', () => {
    it('returns first 2 chars uppercased for single word', () => {
      expect(agentInitials('lead')).toBe('LE');
    });

    it('returns first letter of each part for hyphenated name', () => {
      expect(agentInitials('team-lead')).toBe('TL');
    });

    it('returns ? for empty name', () => {
      expect(agentInitials('')).toBe('?');
    });

    it('handles underscore-separated names', () => {
      expect(agentInitials('code_reviewer')).toBe('CR');
    });
  });

  describe('agentColorBg', () => {
    it('appends 1a to the hex color', () => {
      const bg = agentColorBg('test');
      expect(bg).toMatch(/^#[0-9a-f]{6}1a$/i);
    });
  });

  describe('agentAvatarStyle', () => {
    it('returns object with background, border, and color', () => {
      const style = agentAvatarStyle('dev');
      expect(style).toHaveProperty('background');
      expect(style).toHaveProperty('border');
      expect(style).toHaveProperty('color');
      expect(style.background).toContain('#');
      expect(style.border).toContain('solid');
      expect(style.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});
