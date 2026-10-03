import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

// ── Theme palette definitions ──────────────────────────────────────────────
// Each theme is a set of CSS custom property values.
// Naming matches init.habits' built-in themes where possible.

export const THEMES = {
  'tokyo-night': {
    name: 'Tokyo Night',
    vars: {
      '--bg': '#1a1b26',
      '--bg-elevated': '#24253a',
      '--fg': '#c0c0d0',
      '--fg-muted': '#6b6c87',
      '--fg-dim': '#55567a',
      '--accent': '#7aa2f7',
      '--accent-bright': '#89b4fa',
      '--success': '#9ece6a',
      '--danger': '#f7768e',
      '--warning': '#e0af68',
      '--border': '#3b3d57',
      '--border-bright': '#55567a',
      '--cursor': '#7aa2f7',
      '--selection-bg': '#2f3349',
      '--scrollbar-thumb': '#3b3d57',
      '--scrollbar-track': 'transparent',
    },
  },
  'dracula': {
    name: 'Dracula',
    vars: {
      '--bg': '#282a36',
      '--bg-elevated': '#343746',
      '--fg': '#f8f8f2',
      '--fg-muted': '#6272a4',
      '--fg-dim': '#44475a',
      '--accent': '#bd93f9',
      '--accent-bright': '#d6acff',
      '--success': '#50fa7b',
      '--danger': '#ff5555',
      '--warning': '#ffb86c',
      '--border': '#44475a',
      '--border-bright': '#55567a',
      '--cursor': '#ff79c6',
      '--selection-bg': '#44475a',
      '--scrollbar-thumb': '#44475a',
      '--scrollbar-track': 'transparent',
    },
  },
  'catppuccin-mocha': {
    name: 'Catppuccin Mocha',
    vars: {
      '--bg': '#1e1e2e',
      '--bg-elevated': '#2a2a3e',
      '--fg': '#cdd6f4',
      '--fg-muted': '#bac2de',
      '--fg-dim': '#a6adc8',
      '--accent': '#89b4fa',
      '--accent-bright': '#7cc8f8',
      '--success': '#a6e3a1',
      '--danger': '#f38ba8',
      '--warning': '#f9e2af',
      '--border': '#45475a',
      '--border-bright': '#585b70',
      '--cursor': '#89b4fa',
      '--selection-bg': '#363649',
      '--scrollbar-thumb': '#45475a',
      '--scrollbar-track': 'transparent',
    },
  },
  'gruvbox-dark': {
    name: 'Gruvbox Dark',
    vars: {
      '--bg': '#282828',
      '--bg-elevated': '#353535',
      '--fg': '#ebdbb2',
      '--fg-muted': '#bdae93',
      '--fg-dim': '#928374',
      '--accent': '#fabd2f',
      '--accent-bright': '#f3e387',
      '--success': '#b8bb26',
      '--danger': '#fb4934',
      '--warning': '#d79921',
      '--border': '#4a4a4a',
      '--border-bright': '#6c6c6c',
      '--cursor': '#fabd2f',
      '--selection-bg': '#4a4a4a',
      '--scrollbar-thumb': '#4a4a4a',
      '--scrollbar-track': 'transparent',
    },
  },
  'one-dark': {
    name: 'One Dark',
    vars: {
      '--bg': '#282c34',
      '--bg-elevated': '#363a44',
      '--fg': '#abb2bf',
      '--fg-muted': '#7d8590',
      '--fg-dim': '#5c6370',
      '--accent': '#61afef',
      '--accent-bright': '#7ec6e6',
      '--success': '#98c379',
      '--danger': '#e06c75',
      '--warning': '#d19a66',
      '--border': '#3e4451',
      '--border-bright': '#5c6370',
      '--cursor': '#61afef',
      '--selection-bg': '#3e4451',
      '--scrollbar-thumb': '#3e4451',
      '--scrollbar-track': 'transparent',
    },
  },
  'github-dark': {
    name: 'GitHub Dark',
    vars: {
      '--bg': '#0d1117',
      '--bg-elevated': '#161b22',
      '--fg': '#c9d1d9',
      '--fg-muted': '#8b949e',
      '--fg-dim': '#484f58',
      '--accent': '#58a6ff',
      '--accent-bright': '#79c0ff',
      '--success': '#3fb950',
      '--danger': '#f85149',
      '--warning': '#d29922',
      '--border': '#30363d',
      '--border-bright': '#484f58',
      '--cursor': '#58a6ff',
      '--selection-bg': '#1f6feb33',
      '--scrollbar-thumb': '#30363d',
      '--scrollbar-track': 'transparent',
    },
  },
  'light': {
    name: 'Light',
    vars: {
      '--bg': '#fafafa',
      '--bg-elevated': '#ffffff',
      '--fg': '#1f2328',
      '--fg-muted': '#656d76',
      '--fg-dim': '#8c959f',
      '--accent': '#0969da',
      '--accent-bright': '#0550ae',
      '--success': '#1a7f37',
      '--danger': '#cf222e',
      '--warning': '#bf8700',
      '--border': '#d0d7de',
      '--border-bright': '#8c959f',
      '--cursor': '#0969da',
      '--selection-bg': '#ccffcc',
      '--scrollbar-thumb': '#d0d7de',
      '--scrollbar-track': 'transparent',
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
