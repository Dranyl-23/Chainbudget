import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme as NavTheme, DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme } from '@react-navigation/native';
import { ThemeMode, ThemeType, ThemeColors, darkTheme, lightTheme } from '../theme/tokens';

const THEME_STORAGE_KEY = '@chainbudget_theme_mode';

interface ThemeContextValue {
  themeMode: ThemeMode;
  activeTheme: ThemeType;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  navigationTheme: NavTheme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Load saved theme preference on mount
  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        }
      } catch (err) {
        console.warn('Failed to load theme preference from storage:', err);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSavedTheme();
  }, []);

  // 2. Resolve active theme (Light or Dark)
  const activeTheme: ThemeType = useMemo(() => {
    if (themeMode === 'light') return 'light';
    if (themeMode === 'dark') return 'dark';
    return deviceColorScheme === 'light' ? 'light' : 'dark';
  }, [themeMode, deviceColorScheme]);

  const isDark = activeTheme === 'dark';
  const colors: ThemeColors = isDark ? darkTheme : lightTheme;

  // 3. Save preference
  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('Failed to persist theme preference:', err);
    }
  };

  // 4. Construct matching React Navigation theme
  const navigationTheme: NavTheme = useMemo(() => {
    const base = isDark ? NavDarkTheme : NavDefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accentFuchsia,
      },
    };
  }, [isDark, colors]);

  const contextValue = useMemo<ThemeContextValue>(() => ({
    themeMode,
    activeTheme,
    isDark,
    colors,
    setThemeMode,
    navigationTheme,
  }), [themeMode, activeTheme, isDark, colors, navigationTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
