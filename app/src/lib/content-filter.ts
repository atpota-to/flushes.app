// List of banned terms (this is a sample list that can be modified as needed)
// These words will be filtered from all posts in the application
const BANNED_WORDS: string[] = [
  // Generic offensive terms
  'offensive', 'inappropriate', 'slur',
  
  // Hate speech related
  'racist', 'bigot', 'bigotry', 'homophobic', 'transphobic',
  
  // Profanity
  'shit', 'fuck', 'damn', 'ass', 'asshole', 'bitch',
  
  // Violence
  'kill', 'murder', 'attack', 'violence', 'harm', 'hurt',
  
  // Discrimination terms
  'retard', 'retarded', 'idiot', 'stupid', 'dumb',
  
  // Sexual content
  'penis', 'vagina', 'dick', 'cock', 'pussy', 'sex',
  'masturbate', 'orgasm', 'horny', 'erection', 
  'blowjob', 'handjob',
  
  // Bathroom-inappropriate terms (since this is a family-friendly app)
  'diarrhea', 'constipation', 'explosive', 'bloody',
  
  // Spam-related
  'viagra', 'cialis', 'enlarge', 'cryptocurrency', 'bitcoin', 'ethereum',
  'make money', 'get rich', 'earn fast', 'pyramid', 'scheme',
  
  // Links and promotion
  'discord.gg', 'telegram.me'
];

/**
 * Checks if a text contains any banned words
 * @param text The text to check
 * @returns True if the text contains banned words, false otherwise
 */
export function containsBannedWords(text: string): boolean {
  if (!text) return false;
  
  // Normalize text by removing common obfuscation techniques
  let normalizedText = text.toLowerCase()
    .replace(/0/g, 'o')      // Replace numbers with letters they resemble
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')     // Replace symbols with letters they resemble
    .replace(/@/g, 'a')
    .replace(/!/g, 'i')
    .replace(/\*/g, '')      // Remove common censorship characters
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/_/g, '')
    .replace(/\s+/g, ' ');   // Normalize whitespace
  
  // Check for exact matches and partial matches
  return BANNED_WORDS.some(word => {
    // Check for exact word match with word boundaries
    const exactRegex = new RegExp(`\\b${word}\\b`, 'i');
    if (exactRegex.test(normalizedText)) return true;
    
    // Check for intentional letter spacing like "s e x"
    const spacedWord = word.split('').join('\\s*');
    const spacedRegex = new RegExp(`\\b${spacedWord}\\b`, 'i');
    if (spacedRegex.test(normalizedText)) return true;
    
    // For shorter words (4 letters or less), also check for substring matches
    // This helps catch compound words that contain banned terms
    if (word.length <= 4) {
      const substringRegex = new RegExp(word, 'i');
      return substringRegex.test(normalizedText);
    }
    
    return false;
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
  
  // First pass: replace exact word matches
  BANNED_WORDS.forEach(word => {
    const exactRegex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(exactRegex, '*'.repeat(word.length));
  });
  
  // Second pass: look for spaced out words (e.g., "s e x")
  BANNED_WORDS.forEach(word => {
    if (word.length > 2) {
      const spacedWord = word.split('').join('\\s*');
      const spacedRegex = new RegExp(`\\b${spacedWord}\\b`, 'gi');
      
      // Use a callback to replace with the right number of asterisks
      sanitized = sanitized.replace(spacedRegex, (match) => {
        return '*'.repeat(match.replace(/\s+/g, '').length);
      });
    }
  });
  
  // Third pass: for shorter words, also check substrings in larger words
  BANNED_WORDS.filter(word => word.length <= 4).forEach(word => {
    // This regex finds the word as a substring but not at word boundaries
    const substringRegex = new RegExp(`(?<!\\w)${word}(?!\\w)`, 'gi');
    sanitized = sanitized.replace(substringRegex, '*'.repeat(word.length));
  });
  
  return sanitized;
}