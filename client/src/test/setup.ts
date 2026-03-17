import '@testing-library/jest-dom';
import { vi } from 'vitest';
import type React from 'react';

// ── Mock react-i18next ─────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (!opts) return key;
      // Simple interpolation: replace {{var}} with value
      return Object.entries(opts).reduce(
        (s, [k, v]) => s.replace(`{{${k}}}`, v),
        key,
      );
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// ── Mock MarkdownContent ───────────────────────────────────────────────────
vi.mock('../components/shared/MarkdownContent', () => ({
  default: ({ content }: { content: string }) => {
    // Use createElement to avoid JSX in .ts file
    const { createElement } = require('react');
    return createElement('span', { 'data-testid': 'md' }, content);
  },
  inlineRender: (text: string) => text,
}));
