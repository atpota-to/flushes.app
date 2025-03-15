'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './ProfileSearch.module.css';

type UserSuggestion = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string | null;
};

export default function ProfileSearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [placeholder, setPlaceholder] = useState('Search user @handle');
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update placeholder text based on screen width
  useEffect(() => {
    const updatePlaceholder = () => {
      if (window.innerWidth <= 480) {
        setPlaceholder('@handle');
      } else {
        setPlaceholder('Search user @handle');
      }
    };
    
    // Initial check
    updatePlaceholder();
    
    // Listen for resize events
    window.addEventListener('resize', updatePlaceholder);
    
    // Cleanup
    return () => window.removeEventListener('resize', updatePlaceholder);
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Suggestions fetch is disabled for now
  useEffect(() => {
    // Clear previous timer if it exists
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Always hide suggestions
    setSuggestions([]);
    setShowSuggestions(false);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Normalize the handle by removing @ if present
      const handle = query.trim().startsWith('@') 
        ? query.trim().substring(1) 
        : query.trim();
        
      router.push(`/profile/${handle}`);
      setShowSuggestions(false);
    }
  };

  // Removed handleSuggestionClick as it's no longer needed

  return (
    <div className={styles.searchContainer}>
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={`${styles.searchInput} font-regular`}
          aria-label="Search for a user profile"
        />
        <button type="submit" className={`${styles.searchButton} font-medium`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
      </form>
      {/* Suggestions dropdown removed */}
    </div>
  );
}