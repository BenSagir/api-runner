import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgSurface: string;
  bgHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  error: string;
  border: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  emoji: string;
  colors: ThemeColors;
}

export const themePresets: ThemePreset[] = [
  {
    id: 'catppuccin',
    name: 'Ocean Blue',
    emoji: '🌊',
    colors: {
      bgPrimary: '#1e1e2e',
      bgSecondary: '#181825',
      bgSurface: '#313244',
      bgHover: '#45475a',
      textPrimary: '#cdd6f4',
      textSecondary: '#a6adc8',
      textMuted: '#6c7086',
      accent: '#89b4fa',
      accentHover: '#74c7ec',
      success: '#a6e3a1',
      warning: '#f9e2af',
      error: '#f38ba8',
      border: '#45475a',
    },
  },
  {
    id: 'slate',
    name: 'Slate Gray',
    emoji: '🌑',
    colors: {
      bgPrimary: '#1a1d23',
      bgSecondary: '#15171c',
      bgSurface: '#2a2d35',
      bgHover: '#3a3d45',
      textPrimary: '#d1d5db',
      textSecondary: '#9ca3af',
      textMuted: '#6b7280',
      accent: '#9ca3af',
      accentHover: '#d1d5db',
      success: '#86efac',
      warning: '#fde68a',
      error: '#fca5a5',
      border: '#374151',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson Red',
    emoji: '🔴',
    colors: {
      bgPrimary: '#1c1517',
      bgSecondary: '#161012',
      bgSurface: '#2d2023',
      bgHover: '#3f2d31',
      textPrimary: '#f0dde0',
      textSecondary: '#c4a5aa',
      textMuted: '#7a5a60',
      accent: '#f87171',
      accentHover: '#fb923c',
      success: '#86efac',
      warning: '#fde68a',
      error: '#fca5a5',
      border: '#3f2d31',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    emoji: '🟢',
    colors: {
      bgPrimary: '#141c1a',
      bgSecondary: '#0f1614',
      bgSurface: '#1e2d28',
      bgHover: '#2a3f38',
      textPrimary: '#d5f0e8',
      textSecondary: '#a0c4b8',
      textMuted: '#5e857a',
      accent: '#34d399',
      accentHover: '#6ee7b7',
      success: '#86efac',
      warning: '#fde68a',
      error: '#fca5a5',
      border: '#2a3f38',
    },
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    emoji: '🟣',
    colors: {
      bgPrimary: '#1a1625',
      bgSecondary: '#14101e',
      bgSurface: '#2a2438',
      bgHover: '#3b3350',
      textPrimary: '#e8dff5',
      textSecondary: '#b5a5d0',
      textMuted: '#6e5c8a',
      accent: '#c084fc',
      accentHover: '#d8b4fe',
      success: '#86efac',
      warning: '#fde68a',
      error: '#fca5a5',
      border: '#3b3350',
    },
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    emoji: '🟠',
    colors: {
      bgPrimary: '#1c1a14',
      bgSecondary: '#16140f',
      bgSurface: '#2d2a20',
      bgHover: '#3f3b2d',
      textPrimary: '#f0ead5',
      textSecondary: '#c4bca0',
      textMuted: '#7a755e',
      accent: '#fbbf24',
      accentHover: '#fcd34d',
      success: '#86efac',
      warning: '#fde68a',
      error: '#fca5a5',
      border: '#3f3b2d',
    },
  },
];

const STORAGE_KEY = 'api-runner-theme';

function applyThemeToDOM(colors: ThemeColors) {
  const root = document.documentElement;
  root.style.setProperty('--bg-primary', colors.bgPrimary);
  root.style.setProperty('--bg-secondary', colors.bgSecondary);
  root.style.setProperty('--bg-surface', colors.bgSurface);
  root.style.setProperty('--bg-hover', colors.bgHover);
  root.style.setProperty('--text-primary', colors.textPrimary);
  root.style.setProperty('--text-secondary', colors.textSecondary);
  root.style.setProperty('--text-muted', colors.textMuted);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-hover', colors.accentHover);
  root.style.setProperty('--success', colors.success);
  root.style.setProperty('--warning', colors.warning);
  root.style.setProperty('--error', colors.error);
  root.style.setProperty('--border', colors.border);
}

interface ThemeContextValue {
  activeThemeId: string;
  setTheme: (id: string) => void;
  presets: ThemePreset[];
}

const ThemeContext = createContext<ThemeContextValue>({
  activeThemeId: 'catppuccin',
  setTheme: () => {},
  presets: themePresets,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'catppuccin';
    } catch {
      return 'catppuccin';
    }
  });

  const setTheme = useCallback((id: string) => {
    setActiveThemeId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  // Apply theme on mount and when it changes
  useEffect(() => {
    const preset = themePresets.find(p => p.id === activeThemeId) || themePresets[0];
    applyThemeToDOM(preset.colors);
  }, [activeThemeId]);

  return (
    <ThemeContext.Provider value={{ activeThemeId, setTheme, presets: themePresets }}>
      {children}
    </ThemeContext.Provider>
  );
}
