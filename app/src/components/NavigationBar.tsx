'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './NavigationBar.module.css';
import ProfileSearch from './ProfileSearch';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/lib/auth-context';

export default function NavigationBar() {
  const pathname = usePathname();
  const { isAuthenticated, clearAuth, handle } = useAuth();

  const handleLogout = () => {
    clearAuth();
  };

  // Check if a link is active
  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navStart}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoText}>Flushes</span>
        </Link>
        
        <div className={styles.navLinks}>
          <Link href="/" className={`${styles.navLink} ${isActive('/') ? styles.active : ''}`}>
            Feed
          </Link>
          <Link href="/stats" className={`${styles.navLink} ${isActive('/stats') ? styles.active : ''}`}>
            Stats
          </Link>
          <Link href="/shortcut" className={`${styles.navLink} ${isActive('/shortcut') ? styles.active : ''}`}>
            Shortcut
          </Link>
          <Link href="/about" className={`${styles.navLink} ${isActive('/about') ? styles.active : ''}`}>
            About
          </Link>
          {isAuthenticated && handle && (
            <Link 
              href={`/profile/${handle}`} 
              className={`${styles.navLink} ${pathname.startsWith('/profile/') ? styles.active : ''}`}
            >
              Profile
            </Link>
          )}
        </div>
      </div>
      
      <div className={styles.navSearch}>
        <ProfileSearch />
      </div>
      
      <div className={styles.navEnd}>
        <ThemeToggle />
        
        {isAuthenticated ? (
          <button onClick={handleLogout} className={styles.authButton}>
            Logout
          </button>
        ) : (
          <Link href="/auth/login" className={styles.authButton}>
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}