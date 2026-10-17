import { Theme } from '../types';

export const THEMES: Theme[] = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    colors: {
      bg: '#1a1b26', bgSecondary: '#24283b', fg: '#c0caf5', fgMuted: '#565f89',
      accent: '#7aa2f7', accentMuted: '#3d59a1', border: '#414868',
      success: '#9ece6a', warning: '#e0af68', error: '#f7768e',
      accentAlt: '#bb9af7', info: '#7dcfff',
      heatmap: { level0: '#1f2335', level1: '#1e3a5f', level2: '#2a5e8e', level3: '#3a8ec2', level4: '#7aa2f7' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      bg: '#282a36', bgSecondary: '#44475a', fg: '#f8f8f2', fgMuted: '#6272a4',
      accent: '#bd93f9', accentMuted: '#6272a4', border: '#6272a4',
      success: '#50fa7b', warning: '#f1fa8c', error: '#ff5555',
      accentAlt: '#ff79c6', info: '#8be9fd',
      heatmap: { level0: '#282a36', level1: '#3a3f5c', level2: '#4d5a7a', level3: '#6a8bd8', level4: '#bd93f9' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    colors: {
      bg: '#1e1e2e', bgSecondary: '#313244', fg: '#cdd6f4', fgMuted: '#6c7086',
      accent: '#89b4fa', accentMuted: '#45475a', border: '#45475a',
      success: '#a6e3a1', warning: '#f9e2af', error: '#f38ba8',
      accentAlt: '#cba6f7', info: '#94e2d5',
      heatmap: { level0: '#1e1e2e', level1: '#2d2f4a', level2: '#3d4f6a', level3: '#5d7f8a', level4: '#89b4fa' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'nord',
    name: 'Nord',
    colors: {
      bg: '#2e3440', bgSecondary: '#3b4252', fg: '#d8dee9', fgMuted: '#4c566a',
      accent: '#88c0d0', accentMuted: '#434c5e', border: '#4c566a',
      success: '#a3be8c', warning: '#ebcb8b', error: '#bf616a',
      accentAlt: '#b48ead', info: '#81a1c1',
      heatmap: { level0: '#2e3440', level1: '#3b4b58', level2: '#485d70', level3: '#5e81ac', level4: '#88c0d0' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    colors: {
      bg: '#282828', bgSecondary: '#3c3836', fg: '#ebdbb2', fgMuted: '#928374',
      accent: '#fabd2f', accentMuted: '#504945', border: '#504945',
      success: '#b8bb26', warning: '#fe8019', error: '#fb4934',
      accentAlt: '#d3869b', info: '#83a598',
      heatmap: { level0: '#282828', level1: '#3c3836', level2: '#504945', level3: '#bdae93', level4: '#fabd2f' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    colors: {
      bg: '#282c34', bgSecondary: '#2c313a', fg: '#abb2bf', fgMuted: '#5c6370',
      accent: '#61afef', accentMuted: '#3b4048', border: '#3b4048',
      success: '#98c379', warning: '#e5c07b', error: '#e06c75',
      accentAlt: '#c678dd', info: '#56b6c2',
      heatmap: { level0: '#282c34', level1: '#333a48', level2: '#4a5360', level3: '#5e7a94', level4: '#61afef' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    colors: {
      bg: '#0d1117', bgSecondary: '#161b22', fg: '#e6edf3', fgMuted: '#8b949e',
      accent: '#58a6ff', accentMuted: '#21262d', border: '#30363d',
      success: '#3fb950', warning: '#d29922', error: '#f85149',
      accentAlt: '#bc8cff', info: '#39c5cf',
      heatmap: { level0: '#0d1117', level1: '#161b22', level2: '#21262d', level3: '#30363d', level4: '#58a6ff' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    colors: {
      bg: '#191724', bgSecondary: '#1f1d2e', fg: '#e0def4', fgMuted: '#6e6a86',
      accent: '#ebbcba', accentMuted: '#26233a', border: '#26233a',
      success: '#31748f', warning: '#f6c177', error: '#eb6f92',
      accentAlt: '#c4a7e7', info: '#9ccfd8',
      heatmap: { level0: '#191724', level1: '#232136', level2: '#3a3852', level3: '#56526e', level4: '#ebbcba' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'everforest-dark',
    name: 'Everforest Dark',
    colors: {
      bg: '#2d353b', bgSecondary: '#343f44', fg: '#d3c6aa', fgMuted: '#7a8478',
      accent: '#a7c080', accentMuted: '#3a464b', border: '#3a464b',
      success: '#a7c080', warning: '#e6c384', error: '#e67e80',
      heatmap: { level0: '#2d353b', level1: '#343f44', level2: '#4a5559', level3: '#6a7d6a', level4: '#a7c080' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'terminal-green',
    name: 'Terminal Green',
    colors: {
      bg: '#000000', bgSecondary: '#0a0a0a', fg: '#00ff00', fgMuted: '#006600',
      accent: '#00ff00', accentMuted: '#003300', border: '#003300',
      success: '#00ff00', warning: '#ffff00', error: '#ff0000',
      accentAlt: '#00ffaa', info: '#00ffff',
      heatmap: { level0: '#000000', level1: '#001a00', level2: '#003300', level3: '#006600', level4: '#00ff00' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'terminal-amber',
    name: 'Terminal Amber',
    colors: {
      bg: '#000000', bgSecondary: '#0a0a00', fg: '#ffb000', fgMuted: '#664400',
      accent: '#ffb000', accentMuted: '#332200', border: '#332200',
      success: '#88ff00', warning: '#ffb000', error: '#ff4400',
      accentAlt: '#ff6b00', info: '#ffd000',
      heatmap: { level0: '#000000', level1: '#1a1400', level2: '#332a00', level3: '#665500', level4: '#ffb000' }
    },
    isCustom: false, isPro: false
  }
];

export const DEFAULT_THEME_ID = 'tokyo-night';

export function getTheme(id: string): Theme {
  return THEMES.find(t => t.id === id) || THEMES.find(t => t.id === DEFAULT_THEME_ID)!;
}

export function getFreeThemes(): Theme[] {
  return THEMES.filter(t => !t.isPro);
}

export function getProThemes(): Theme[] {
  return THEMES.filter(t => t.isPro);
}