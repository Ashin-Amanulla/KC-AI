import { useEffect } from 'react';
import { useUiPreferencesStore, resolveTheme } from '../store/uiPreferences';

export function useTheme() {
  const theme = useUiPreferencesStore((s) => s.theme);
  const setTheme = useUiPreferencesStore((s) => s.setTheme);
  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark');

    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      document.documentElement.classList.toggle('dark', media.matches);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  return { theme, resolvedTheme, setTheme };
}
