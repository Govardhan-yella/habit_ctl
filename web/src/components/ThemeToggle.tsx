import { useTheme } from '../themes/index';

export function ThemeToggle() {
  const { themeId, setThemeId, themes } = useTheme();

  const cycle = () => {
    const ids = Object.keys(themes) as Array<keyof typeof themes>;
    const idx = ids.indexOf(themeId);
    const next = ids[(idx + 1) % ids.length];
    setThemeId(next);
  };

  const current = themes[themeId];

  return (
    <button className="theme-btn" onClick={cycle} title={`Theme: ${current.name} — click to change`}>
      <span style={{ fontSize: '14px' }}>
        {themeId === 'tokyo-night' ? '🌙' :
         themeId === 'dracula' ? '🧛' :
         themeId === 'catppuccin-mocha' ? '🐱' :
         themeId === 'gruvbox-dark' ? '🪵' :
         themeId === 'one-dark' ? '🔷' :
         themeId === 'github-dark' ? '🐙' :
         themeId === 'light' ? '☀️' : '🎨'}
      </span>
    </button>
  );
}
