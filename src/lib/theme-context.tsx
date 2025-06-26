'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// Create default context values to avoid SSR errors
const defaultContextValue: ThemeContextType = {
  theme: 'system',
  setTheme: () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaultContextValue);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);
  
  // Get stored theme preference or use system default
  useEffect(() => {
    // Only run in browser context
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme') as Theme | null;
      if (storedTheme) {
        setTheme(storedTheme);
      }
      setMounted(true);
    }
  }, []);
  
  // Apply theme class to document
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    
    // Save to local storage
    localStorage.setItem('theme', theme);
    
    // Apply data-theme attribute
    const root = window.document.documentElement;
    
    if (theme === 'system') {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.removeAttribute('data-theme');
      
      // Only add this class if needed to override system preference
      if (systemPrefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else {
      // Apply explicit preference
      root.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme, mounted]);

  // Handle system preference changes
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        // Update the UI if we're in system mode
        const root = window.document.documentElement;
        if (mediaQuery.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  const value = {
    theme,
    setTheme,
  };

  // Always render the provider to avoid SSR issues, but use default values until mounted
  return (
    <ThemeContext.Provider value={mounted ? value : defaultContextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Safe version of useTheme that won't throw during SSR
export function useTheme() {
  return useContext(ThemeContext);
}