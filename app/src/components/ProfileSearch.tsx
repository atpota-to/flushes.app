'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ProfileSearch.module.css';

export default function ProfileSearch() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Normalize the handle by removing @ if present
      const handle = query.trim().startsWith('@') 
        ? query.trim().substring(1) 
        : query.trim();
        
      router.push(`/profile/${handle}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className={styles.searchForm}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search user @handle"
        className={styles.searchInput}
        aria-label="Search for a user profile"
      />
      <button type="submit" className={styles.searchButton}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
    </form>
  );
}