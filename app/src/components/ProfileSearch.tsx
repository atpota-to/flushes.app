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
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch suggestions when query changes
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Return early if query is too short
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Set a new timer to fetch suggestions
    debounceTimerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Normalize query by removing @ if present
        const searchTerm = query.trim().startsWith('@') 
          ? query.trim().substring(1) 
          : query.trim();

        console.log('Fetching suggestions for:', searchTerm);
        const response = await fetch(`/api/bluesky/search?q=${encodeURIComponent(searchTerm)}`);
        
        const data = await response.json();
        
        if (response.ok) {
          console.log('Search suggestions:', data.suggestions);
          setSuggestions(data.suggestions);
          setShowSuggestions(true);
        } else {
          console.error('Search API error:', data.error, data.message);
          setSuggestions([]);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce delay

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

  const handleSuggestionClick = (handle: string) => {
    router.push(`/profile/${handle}`);
    setQuery(`@${handle}`);
    setShowSuggestions(false);
  };

  return (
    <div className={styles.searchContainer}>
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setShowSuggestions(true)}
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
      
      {showSuggestions && (
        <div ref={suggestionsRef} className={styles.suggestionsContainer}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <span className={styles.loadingDot}></span>
              <span className={styles.loadingDot}></span>
              <span className={styles.loadingDot}></span>
            </div>
          ) : suggestions.length > 0 ? (
            <ul className={styles.suggestionsList}>
              {suggestions.map((suggestion) => (
                <li key={suggestion.did} className={styles.suggestionItem}>
                  <button 
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion.handle)}
                    className={styles.suggestionButton}
                  >
                    <div className={styles.suggestionInfo}>
                      {suggestion.displayName && (
                        <span className={styles.displayName}>{suggestion.displayName}</span>
                      )}
                      <span className={styles.handle}>@{suggestion.handle}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.noResults}>No users found</div>
          )}
        </div>
      )}
    </div>
  );
}