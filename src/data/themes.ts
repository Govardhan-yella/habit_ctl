import { Theme } from '../types';

export const THEMES: Theme[] = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    colors: {
      bg: '#1a1b26', bgSecondary: '#24283b', fg: '#c0caf5', fgMuted: '#565f89',
      accent: '#7aa2f7', accentMuted: '#3d59a1', border: '#2c3247',
      success: '#9ece6a', warning: '#e0af68', error: '#f7768e',
      accentAlt: '#bb9af7', info: '#7dcfff',
      heatmap: { level0: '#1c2030', level1: '#263a63', level2: '#3a5aa8', level3: '#567ed0', level4: '#7aa2f7' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      bg: '#282a36', bgSecondary: '#34384a', fg: '#f8f8f2', fgMuted: '#6272a4',
      accent: '#bd93f9', accentMuted: '#6d5aa8', border: '#3a3f56',
      success: '#50fa7b', warning: '#f1fa8c', error: '#ff5555',
      accentAlt: '#ff79c6', info: '#8be9fd',
      heatmap: { level0: '#2c2e3c', level1: '#4a3f70', level2: '#6a54a0', level3: '#9474cf', level4: '#bd93f9' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    colors: {
      bg: '#1e1e2e', bgSecondary: '#2a2b3d', fg: '#cdd6f4', fgMuted: '#7f849c',
      accent: '#89b4fa', accentMuted: '#4c5a8f', border: '#363850',
      success: '#a6e3a1', warning: '#f9e2af', error: '#f38ba8',
      accentAlt: '#cba6f7', info: '#89dceb',
      heatmap: { level0: '#24253a', level1: '#33406b', level2: '#4f66a8', level3: '#6d90d8', level4: '#89b4fa' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'nord',
    name: 'Nord',
    colors: {
      bg: '#2e3440', bgSecondary: '#3b4252', fg: '#e5e9f0', fgMuted: '#7b88a1',
      accent: '#88c0d0', accentMuted: '#4c6a80', border: '#434c5e',
      success: '#a3be8c', warning: '#ebcb8b', error: '#bf616a',
      accentAlt: '#b48ead', info: '#81a1c1',
      heatmap: { level0: '#333b49', level1: '#3f5566', level2: '#4f7382', level3: '#6a9aa8', level4: '#88c0d0' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    colors: {
      bg: '#282828', bgSecondary: '#32302f', fg: '#ebdbb2', fgMuted: '#928374',
      accent: '#d79921', accentMuted: '#8a6d1f', border: '#3c3836',
      success: '#b8bb26', warning: '#fe8019', error: '#fb4934',
      accentAlt: '#d3869b', info: '#83a598',
      heatmap: { level0: '#2c2a29', level1: '#5c4a1c', level2: '#8a6a1e', level3: '#b3851f', level4: '#d79921' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    colors: {
      bg: '#282c34', bgSecondary: '#2f343d', fg: '#abb2bf', fgMuted: '#66707f',
      accent: '#61afef', accentMuted: '#3a6a9c', border: '#3b414d',
      success: '#98c379', warning: '#e5c07b', error: '#e06c75',
      accentAlt: '#c678dd', info: '#56b6c2',
      heatmap: { level0: '#2c313b', level1: '#2f4a68', level2: '#3f6fa0', level3: '#5090ca', level4: '#61afef' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    colors: {
      bg: '#0d1117', bgSecondary: '#161b22', fg: '#e6edf3', fgMuted: '#8b949e',
      accent: '#58a6ff', accentMuted: '#1f6feb', border: '#30363d',
      success: '#3fb950', warning: '#d29922', error: '#f85149',
      accentAlt: '#bc8cff', info: '#39c5cf',
      heatmap: { level0: '#11161d', level1: '#143a63', level2: '#1f5fae', level3: '#3a86e0', level4: '#58a6ff' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    colors: {
      bg: '#191724', bgSecondary: '#1f1d2e', fg: '#e0def4', fgMuted: '#6e6a86',
      accent: '#ebbcba', accentMuted: '#9a7d86', border: '#26233a',
      success: '#31748f', warning: '#f6c177', error: '#eb6f92',
      accentAlt: '#c4a7e7', info: '#9ccfd8',
      heatmap: { level0: '#201d30', level1: '#4a3f63', level2: '#7a6a94', level3: '#b798b6', level4: '#ebbcba' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'everforest-dark',
    name: 'Everforest Dark',
    colors: {
      bg: '#2d353b', bgSecondary: '#343f44', fg: '#d3c6aa', fgMuted: '#859289',
      accent: '#a7c080', accentMuted: '#5c6f57', border: '#3d484d',
      success: '#a7c080', warning: '#dbbc7f', error: '#e67e80',
      accentAlt: '#d699b6', info: '#7fbbb3',
      heatmap: { level0: '#303a3f', level1: '#4a5a4a', level2: '#6d8a5f', level3: '#8aa871', level4: '#a7c080' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'kanagawa',
    name: 'Kanagawa',
    colors: {
      bg: '#1f1f28', bgSecondary: '#2a2a37', fg: '#dcd7ba', fgMuted: '#727169',
      accent: '#7e9cd8', accentMuted: '#4a5f8a', border: '#363646',
      success: '#98bb6c', warning: '#e6c384', error: '#e82424',
      accentAlt: '#957fb8', info: '#7fb4ca',
      heatmap: { level0: '#22222e', level1: '#35456a', level2: '#4f679e', level3: '#6685c4', level4: '#7e9cd8' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'ayu-mirage',
    name: 'Ayu Mirage',
    colors: {
      bg: '#1f2430', bgSecondary: '#242936', fg: '#cccac2', fgMuted: '#707a8c',
      accent: '#ffcc66', accentMuted: '#a8843f', border: '#2b3241',
      success: '#bae67e', warning: '#ffa759', error: '#f28779',
      accentAlt: '#d4bfff', info: '#73d0ff',
      heatmap: { level0: '#232838', level1: '#4a4a2f', level2: '#7a6a2f', level3: '#c2a04a', level4: '#ffcc66' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'terminal-green',
    name: 'Terminal Green',
    colors: {
      bg: '#0a0f0a', bgSecondary: '#101710', fg: '#7ee787', fgMuted: '#3f6b4a',
      accent: '#4ade80', accentMuted: '#1f6b3a', border: '#1b2b20',
      success: '#4ade80', warning: '#e3b341', error: '#f85149',
      accentAlt: '#56d364', info: '#39d353',
      heatmap: { level0: '#0c130c', level1: '#16321f', level2: '#1f5a33', level3: '#349b52', level4: '#4ade80' }
    },
    isCustom: false, isPro: false
  },
  {
    id: 'terminal-amber',
    name: 'Terminal Amber',
    colors: {
      bg: '#0f0b06', bgSecondary: '#17110a', fg: '#f0b86e', fgMuted: '#7a5b34',
      accent: '#e8a33d', accentMuted: '#6b4a1e', border: '#241a0e',
      success: '#b8bb26', warning: '#f0883e', error: '#f85149',
      accentAlt: '#f5a97f', info: '#e8c07d',
      heatmap: { level0: '#120d07', level1: '#3a2a12', level2: '#6b4a1e', level3: '#b07a2a', level4: '#e8a33d' }
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
