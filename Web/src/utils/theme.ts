// src/utils/theme.ts

type Theme = 'light' | 'dark';

const readInitialTheme = (): Theme => {
  if (typeof localStorage === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem('theme');
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

let theme: Theme = readInitialTheme();
export const getTheme = (): Theme => theme;

const updateRootTheme = (t: Theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', t === 'dark');
  root.setAttribute('data-theme', t);
};

export const applyTheme = (t: Theme) => {
  theme = t;
  try {
    localStorage.setItem('theme', t);
  } catch {}
  updateRootTheme(t);
};

export const toggleTheme = () => applyTheme(theme === 'dark' ? 'light' : 'dark');

/* apply current on load */
updateRootTheme(theme);
