'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './NavigationBar.module.css';
import ProfileSearch from './ProfileSearch';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/lib/auth-context';

export default function NavigationBar() {
  const pathname = usePathname();
  const { isAuthenticated, signOut, session } = useAuth();
  const [handle, setHandle] = useState<string | null>(null);

  // Fetch user's handle when authenticated
  useEffect(() => {
    if (isAuthenticated && session?.sub && !handle) {
      fetchUserHandle(session.sub);
    }
  }, [isAuthenticated, session?.sub, handle]);

  const fetchUserHandle = async (did: string) => {
    try {
      // Try to resolve DID to handle using PLC directory
      const plcResponse = await fetch(`https://plc.directory/${did}/data`);
      
      if (plcResponse.ok) {
        const plcData = await plcResponse.json();
        if (plcData.alsoKnownAs && plcData.alsoKnownAs.length > 0) {
          const handleUrl = plcData.alsoKnownAs[0];
          if (handleUrl.startsWith('at://')) {
            const userHandle = handleUrl.substring(5); // Remove 'at://'
            console.log(`Resolved DID ${did} to handle ${userHandle}`);
            setHandle(userHandle);
            return;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to resolve handle from PLC directory:', error);
    }

    // Fallback: try using the profile API
    try {
      const response = await fetch('/api/bluesky/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessToken: 'placeholder', // OAuth session handles auth internally
          dpopToken: 'placeholder',   // OAuth session handles auth internally
          handle: did,
          pdsEndpoint: null
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.handle && data.handle !== 'unknown') {
          setHandle(data.handle);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch handle from profile API:', error);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setHandle(null); // Clear handle on logout
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
            width={200}
            height={53}
            priority
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