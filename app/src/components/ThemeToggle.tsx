'use client';

import { useTheme, ThemeContextType, Theme } from '@/lib/theme-context';
import React, { useState, useEffect } from 'react';
import styles from './ThemeToggle.module.css';

// Default light theme icon as fallback for static rendering
const LightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

// Dark theme icon
const DarkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

// System theme icon
const SystemIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);

export default function ThemeToggle() {
  // Prevent hydration errors by using conditional hooks
  const [mounted, setMounted] = useState(false);
  const [themeState, setThemeState] = useState<Theme>('system');
  
  // Safe way to access theme context that won't break SSR
  let themeContext: ThemeContextType | undefined = undefined;
  try {
    themeContext = useTheme();
  } catch (e) {
    // During SSR, the context won't be available, and that's ok
  }
  
  useEffect(() => {
    setMounted(true);
    if (themeContext) {
      setThemeState(themeContext.theme);
    }
  }, [themeContext]);

  const toggleTheme = () => {
    if (!themeContext) return;
    
    if (themeState === 'light') {
      themeContext.setTheme('dark');
      setThemeState('dark');
    } else if (themeState === 'dark') {
      themeContext.setTheme('system');
      setThemeState('system');
    } else {
      themeContext.setTheme('light');
      setThemeState('light');
    }
  };

  const getIcon = () => {
    if (themeState === 'light') {
      return <LightIcon />;
    } else if (themeState === 'dark') {
      return <DarkIcon />;
    } else {
      return <SystemIcon />;
    }
  };

  const getLabel = () => {
    if (themeState === 'light') return 'Light';
    if (themeState === 'dark') return 'Dark';
    return 'System';
  };

  // During SSR or before mounting, render a placeholder that won't try to use the context
  if (!mounted) {
    return (
      <button className={styles.themeToggle} aria-label="Theme toggle">
        <LightIcon />
        <span className={styles.themeLabel}>Theme</span>
      </button>
    );
  }

  return (
    <button 
      className={styles.themeToggle} 
      onClick={toggleTheme} 
      aria-label={`Switch to ${themeState === 'light' ? 'dark' : themeState === 'dark' ? 'system' : 'light'} theme`}
    >
      {getIcon()}
      <span className={styles.themeLabel}>{getLabel()}</span>
    </button>
  );
}