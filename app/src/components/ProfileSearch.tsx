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
        setPlaceholder('@handle or DID');
      } else {
        setPlaceholder('Search user @handle or did:plc:...');
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

  // Enable suggestions with debouncing
  useEffect(() => {
    // Clear previous timer if it exists
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Don't search for very short queries
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    // Set a debounce timer to avoid too many requests
    debounceTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        
        // Format the query - remove @ if it exists
        const searchQuery = query.trim().startsWith('@') 
          ? query.trim().substring(1) 
          : query.trim();
          
        // Call the Bluesky API for typeahead suggestions
        const response = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(searchQuery)}&limit=5`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.actors && Array.isArray(data.actors)) {
            // Map to our UserSuggestion type
            setSuggestions(data.actors.map((actor: any) => ({
              did: actor.did,
              handle: actor.handle,
              displayName: actor.displayName,
              avatar: actor.avatar
            })));
            setShowSuggestions(true);
          }
        } else {
          console.error('Failed to fetch suggestions:', await response.text());
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
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

  // Handle clicking on a suggestion
  const handleSuggestionClick = (suggestion: UserSuggestion) => {
    router.push(`/profile/${suggestion.handle}`);
    setShowSuggestions(false);
    setQuery(''); // Clear the input
  };

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
      
      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className={styles.suggestionsContainer} ref={suggestionsRef}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingDot}></div>
              <div className={styles.loadingDot}></div>
              <div className={styles.loadingDot}></div>
            </div>
          ) : suggestions.length > 0 ? (
            <ul className={styles.suggestionsList}>
              {suggestions.map((suggestion) => (
                <li key={suggestion.did} className={styles.suggestionItem}>
                  <button 
                    type="button" 
                    className={styles.suggestionButton}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion.avatar ? (
                      <img 
                        src={suggestion.avatar} 
                        alt={suggestion.handle} 
                        className={styles.avatar}
                        width={28}
                        height={28}
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}></div>
                    )}
                    <div className={styles.suggestionInfo}>
                      <span className={`${styles.handle} font-medium`}>@{suggestion.handle}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.noResults}>No results found</div>
          )}
        </div>
      )}
    </div>
  );
}