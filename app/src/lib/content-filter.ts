// List of banned terms (keep this empty or minimal for the example - in production you would use a more robust solution)
// This is just a placeholder list for demonstration purposes
const BANNED_WORDS: string[] = [
  // Add offensive words here
  'offensive', 'inappropriate', 'slur'
];

/**
 * Checks if a text contains any banned words
 * @param text The text to check
 * @returns True if the text contains banned words, false otherwise
 */
export function containsBannedWords(text: string): boolean {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  
  // Check for exact matches and word boundaries
  return BANNED_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Sanitizes text by removing or replacing banned words
 * @param text The text to sanitize
 * @returns Sanitized text with banned words replaced by asterisks
 */
export function sanitizeText(text: string): string {
  if (!text) return text;
  
  let sanitized = text;
  
  BANNED_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '*'.repeat(word.length));
  });
  
  return sanitized;
}