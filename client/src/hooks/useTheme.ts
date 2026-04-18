/**
 * useTheme — dark / light mode toggle with localStorage persistence.
 *
 * Priority: localStorage → system preference (prefers-color-scheme)
 * The initial class is already applied by the inline script in index.html,
 * so there is no flash on load. This hook just reads + writes that class.
 */
import { useState, useCallback } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() =>
    document.documentElement.classList.contains('dark'),
  );

  const toggle = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    const html = document.documentElement;
    if (next) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return { isDark, toggle };
}
