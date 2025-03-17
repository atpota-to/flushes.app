'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
          <Image
            src="/flushes-logo-horizontal.png"
            alt="Flushes Logo"
            width={150}
            height={40}
            className={styles.logoImage}
          />
        </Link>
        
        <div className={styles.navLinks}>
          <Link href="/" className={`${styles.navLink} font-medium ${isActive('/') ? styles.active : ''}`}>
            Feed
          </Link>
          <Link href="/stats" className={`${styles.navLink} font-medium ${isActive('/stats') ? styles.active : ''}`}>
            Stats
          </Link>
          <Link href="/shortcut" className={`${styles.navLink} font-medium ${isActive('/shortcut') ? styles.active : ''}`}>
            Shortcut
          </Link>
          <Link href="/about" className={`${styles.navLink} font-medium ${isActive('/about') ? styles.active : ''}`}>
            About
          </Link>
          {isAuthenticated && handle && (
            <Link 
              href={`/profile/${handle}`} 
              className={`${styles.navLink} font-medium ${pathname.startsWith('/profile/') ? styles.active : ''}`}
            >
              Profile
            </Link>
          )}
        </div>
      </div>
      
      <div className={styles.secondRow}>
        <div className={styles.navSearch}>
          <ProfileSearch />
        </div>
        
        <div className={styles.navEnd}>
          <ThemeToggle />
          
          {isAuthenticated ? (
            <button onClick={handleLogout} className={`${styles.authButton} font-medium`}>
              Logout
            </button>
          ) : (
            <Link href="/auth/login" className={`${styles.authButton} font-medium`}>
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}