import { createContext, useContext, useState, useEffect } from 'react';

export type ThemeId = 'phosphor' | 'amber' | 'neural' | 'paper' | 'crimson' | 'slate' | 'aurora' | 'void';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  accent: string;       // preview swatch color
  bg: string;           // preview bg color
  font: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'phosphor',
    label: 'PHOSPHOR',
    description: 'CRT green terminal',
    accent: '#39ff6a',
    bg: '#070b0f',
    font: 'JetBrains Mono',
  },
  {
    id: 'amber',
    label: 'RADAR',
    description: 'Deep space amber',
    accent: '#ffb627',
    bg: '#0e0900',
    font: 'IBM Plex Mono',
  },
  {
    id: 'neural',
    label: 'NEURAL',
    description: 'Cold electric blue',
    accent: '#00d4ff',
    bg: '#010d18',
    font: 'Space Mono',
  },
  {
    id: 'paper',
    label: 'PAPER',
    description: 'Light editorial',
    accent: '#1a1a2e',
    bg: '#faf7f2',
    font: 'Playfair Display',
  },
  {
    id: 'crimson',
    label: 'CRIMSON OPS',
    description: 'Blood red tactical',
    accent: '#ff2244',
    bg: '#0f0005',
    font: 'Share Tech Mono',
  },
  {
    id: 'slate',
    label: 'SLATE',
    description: 'Cool charcoal pro',
    accent: '#94a3b8',
    bg: '#0f1318',
    font: 'IBM Plex Mono',
  },
  {
    id: 'aurora',
    label: 'AURORA',
    description: 'Northern lights',
    accent: '#a78bfa',
    bg: '#0a0618',
    font: 'Space Mono',
  },
  {
    id: 'void',
    label: 'VOID',
    description: 'Near-black mono',
    accent: '#e0e0e0',
    bg: '#080808',
    font: 'Share Tech Mono',
  },
];

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  meta: ThemeMeta;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'phosphor',
  setTheme: () => {},
  meta: THEMES[0],
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('agent-ctrl-theme') as ThemeId | null;
    return saved && THEMES.some(t => t.id === saved) ? saved : 'phosphor';
  });

  useEffect(() => {
    // Enable transition for smooth theme switch, then remove
    const el = document.documentElement;
    el.setAttribute('data-theme-switching', '');
    el.setAttribute('data-theme', theme);
    localStorage.setItem('agent-ctrl-theme', theme);
    const tid = setTimeout(() => el.removeAttribute('data-theme-switching'), 300);
    return () => clearTimeout(tid);
  }, [theme]);

  const setTheme = (id: ThemeId) => setThemeState(id);
  const meta = THEMES.find(t => t.id === theme) ?? THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, meta }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
