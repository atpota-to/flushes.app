// A utility file to handle browser storage robustly

// Store data with both localStorage and sessionStorage for redundancy
export function storeAuthData(key: string, value: string): boolean {
  try {
    // Clear any existing values first
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    
    // Store in both storages for redundancy
    sessionStorage.setItem(key, value);
    localStorage.setItem(`bsky_auth_${key}`, value); // Use a prefix to avoid conflicts
    
    return true;
  } catch (error) {
    console.error(`Failed to store auth data for key ${key}:`, error);
    return false;
  }
}

// Retrieve data from sessionStorage first, fall back to localStorage
export function retrieveAuthData(key: string): string | null {
  try {
    // Try sessionStorage first (preferred)
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) {
      return sessionValue;
    }
    
    // Fall back to localStorage if needed
    const localValue = localStorage.getItem(`bsky_auth_${key}`);
    if (localValue) {
      console.log(`Retrieved auth data for ${key} from localStorage fallback`);
      // Store it back in sessionStorage for next time
      try {
        sessionStorage.setItem(key, localValue);
      } catch (e) {
        console.warn('Could not restore value to sessionStorage:', e);
      }
      return localValue;
    }
    
    // Nothing found
    return null;
  } catch (error) {
    console.error(`Failed to retrieve auth data for key ${key}:`, error);
    return null;
  }
}

// Clear auth data from both storages
export function clearAuthData(key: string): void {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(`bsky_auth_${key}`);
  } catch (error) {
    console.error(`Failed to clear auth data for key ${key}:`, error);
  }
}