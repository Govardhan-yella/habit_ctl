import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

// ── Theme palette definitions ──────────────────────────────────────────────
// Soft, organic color palettes inspired by but deviating from init.habits.
// Each theme adds bg-card and shadow variables for the non-AI aesthetic.

export const THEMES = {
  'tokyo-night': {
    name: 'Tokyo Night',
    vars: {
      '--bg': '#14151e',
      '--bg-elevated': '#1d1f2d',
      '--bg-card': '#23253a',
      '--fg': '#cdd1e0',
      '--fg-muted': '#9194b3',
      '--fg-dim': '#6b6d87',
      '--accent': '#7aa2f7',
      '--accent-bright': '#89b4fa',
      '--accent-soft': 'rgba(122, 162, 247, 0.12)',
      '--success': '#50e3a4',
      '--danger': '#f7768e',
      '--warning': '#e0af68',
      '--border': 'rgba(255, 255, 255, 0.05)',
      '--border-bright': 'rgba(255, 255, 255, 0.08)',
      '--cursor': '#7aa2f7',
      '--selection-bg': '#2a2d40',
      '--scrollbar-thumb': '#3b3d57',
      '--scrollbar-track': 'transparent',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
      '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.15)',
      '--shadow-lg': '0 8px 28px rgba(0, 0, 0, 0.25)',
    },
  },
  'dracula': {
    name: 'Dracula',
    vars: {
      '--bg': '#1e1f29',
      '--bg-elevated': '#2a2b3a',
      '--bg-card': '#33354a',
      '--fg': '#f8f8f2',
      '--fg-muted': '#9aa0c5',
      '--fg-dim': '#6b6e89',
      '--accent': '#bd93f9',
      '--accent-bright': '#d6acff',
      '--accent-soft': 'rgba(189, 147, 249, 0.12)',
      '--success': '#50fa7b',
      '--danger': '#ff5555',
      '--warning': '#ffb86c',
      '--border': 'rgba(255, 255, 255, 0.06)',
      '--border-bright': 'rgba(255, 255, 255, 0.10)',
      '--cursor': '#ff79c6',
      '--selection-bg': '#44475a',
      '--scrollbar-thumb': '#44475a',
      '--scrollbar-track': 'transparent',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
      '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.15)',
      '--shadow-lg': '0 8px 28px rgba(0, 0, 0, 0.25)',
    },
  },
  'catppuccin-mocha': {
    name: 'Catppuccin Mocha',
    vars: {
      '--bg': '#11111b',
      '--bg-elevated': '#181825',
      '--bg-card': '#1e1e2e',
      '--fg': '#cdd6f4',
      '--fg-muted': '#a6adc8',
      '--fg-dim': '#7f849c',
      '--accent': '#89b4fa',
      '--accent-bright': '#7cc8f8',
      '--accent-soft': 'rgba(137, 180, 250, 0.12)',
      '--success': '#a6e3a1',
      '--danger': '#f38ba8',
      '--warning': '#f9e2af',
      '--border': 'rgba(255, 255, 255, 0.05)',
      '--border-bright': 'rgba(255, 255, 255, 0.08)',
      '--cursor': '#89b4fa',
      '--selection-bg': '#363649',
      '--scrollbar-thumb': '#45475a',
      '--scrollbar-track': 'transparent',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
      '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.15)',
      '--shadow-lg': '0 8px 28px rgba(0, 0, 0, 0.25)',
    },
  },
  'gruvbox-dark': {
    name: 'Gruvbox Dark',
    vars: {
      '--bg': '#1d1f1d',
      '--bg-elevated': '#2a2b2a',
      '--bg-card': '#343533',
      '--fg': '#d5c6aa',
      '--fg-muted': '#a89d7b',
      '--fg-dim': '#827860',
      '--accent': '#fabd2f',
      '--accent-bright': '#f3e387',
      '--accent-soft': 'rgba(250, 189, 47, 0.12)',
      '--success': '#b8bb26',
      '--danger': '#fb4934',
      '--warning': '#d79921',
      '--border': 'rgba(213, 198, 170, 0.08)',
      '--border-bright': 'rgba(213, 198, 170, 0.12)',
      '--cursor': '#fabd2f',
      '--selection-bg': '#3b3d31',
      '--scrollbar-thumb': '#3b3d31',
      '--scrollbar-track': 'transparent',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.10)',
      '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.18)',
      '--shadow-lg': '0 8px 28px rgba(0, 0, 0, 0.30)',
    },
  },
  'one-dark': {
    name: 'One Dark',
    vars: {
      '--bg': '#1b1d25',
      '--bg-elevated': '#24272e',
      '--bg-card': '#2c313c',
      '--fg': '#b7c1d1',
      '--fg-muted': '#8a92a8',
      '--fg-dim': '#5c6370',
      '--accent': '#61afef',
      '--accent-bright': '#7ec6e6',
      '--accent-soft': 'rgba(97, 175, 239, 0.12)',
      '--success': '#98c379',
      '--danger': '#e06c75',
      '--warning': '#d19a66',
      '--border': 'rgba(255, 255, 255, 0.05)',
      '--border-bright': 'rgba(255, 255, 255, 0.08)',
      '--cursor': '#61afef',
      '--selection-bg': '#2f3349',
      '--scrollbar-thumb': '#3e4451',
      '--scrollbar-track': 'transparent',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
      '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.15)',
      '--shadow-lg': '0 8px 28px rgba(0, 0, 0, 0.25)',
    },
  },
  'github-dark': {
    name: 'GitHub Dark',
    vars: {
      '--bg': '#0c0f14',
      '--bg-elevated': '#13171f',
      '--bg-card': '#1a202c',
      '--fg': '#cdd9e5',
      '--fg-muted': '#8695b3',
      '--fg-dim': '#57606a',
      '--accent': '#58a6ff',
      '--accent-bright': '#79c0ff',
      '--accent-soft': 'rgba(88, 166, 255, 0.12)',
      '--success': '#3fb950',
      '--danger': '#f85149',
      '--warning': '#d29922',
      '--border': 'rgba(255, 255, 255, 0.05)',
      '--border-bright': 'rgba(255, 255, 255, 0.08)',
      '--cursor': '#58a6ff',
      '--selection-bg': '#1f6feb33',
      '--scrollbar-thumb': '#30363d',
      '--scrollbar-track': 'transparent',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.12)',
      '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.20)',
      '--shadow-lg': '0 8px 28px rgba(0, 0, 0, 0.30)',
    },
  },
  'light': {
    name: 'Light',
    vars: {
      '--bg': '#f8f7f4',
      '--bg-elevated': '#ffffff',
      '--bg-card': '#fcf9f5',
      '--fg': '#1f2328',
      '--fg-muted': '#656d76',
      '--fg-dim': '#9da5b3',
      '--accent': '#0969da',
      '--accent-bright': '#0550ae',
      '--accent-soft': 'rgba(9, 105, 218, 0.08)',
      '--success': '#1a7f37',
      '--danger': '#cf222e',
      '--warning': '#bf8700',
      '--border': 'rgba(0, 0, 0, 0.06)',
      '--border-bright': 'rgba(0, 0, 0, 0.10)',
      '--cursor': '#0969da',
      '--selection-bg': '#ddf4ff',
      '--scrollbar-thumb': '#d0d7de',
      '--scrollbar-track': 'transparent',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.04)',
      '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.06)',
      '--shadow-lg': '0 8px 28px rgba(0, 0, 0, 0.10)',
    },
  },
};

export type ThemeId = keyof typeof THEMES;

// ── Context ────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  themes: typeof THEMES;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeId;
}

export function ThemeProvider({ children, initialTheme = 'tokyo-night' }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<ThemeId>(initialTheme);

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('habitctl.theme') as ThemeId | null;
      if (saved && THEMES[saved]) setThemeId(saved);
    } catch { /* localStorage may be unavailable */ }
  }, []);

  const updateTheme = useCallback(
    (id: ThemeId) => {
      setThemeId(id);
      try { localStorage.setItem('habitctl.theme', id); } catch { /* ignore */ }
    },
    [],
  );

  const value: ThemeContextValue = {
    themeId,
    setThemeId: updateTheme,
    themes: THEMES,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Apply the active theme's CSS variables to the root element.
export function useApplyTheme() {
  const { themeId } = useTheme();
  const theme = THEMES[themeId];
  useEffect(() => {
    const root = document.documentElement;
    for (const [prop, val] of Object.entries(theme.vars)) {
      root.style.setProperty(prop, val);
    }
  }, [theme]);
  return theme;
}
