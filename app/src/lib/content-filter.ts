// List of banned terms (this is a sample list that can be modified as needed)
// These words will be filtered from all posts in the application
const BANNED_WORDS: string[] = [
  // Generic offensive terms
  'slur',
  
  // Hate speech related
  'racist', 'bigot', 'bigotry', 'homophobic', 'transphobic',
  
  // Profanity
  'fuck', 'damn', 'ass', 'asshole', 'bitch',
  
  // Violence
  'kill', 'murder', 'attack', 'violence', 'harm', 'hurt',
  
  // Discrimination terms
  'retard', 'retarded', 'idiot', 'stupid', 'dumb',
  
  // Sexual content
  'penis', 'vagina', 'dick', 'cock', 'pussy', 'sex',
  'masturbate', 'orgasm', 'horny', 'erection', 
  'blowjob', 'handjob',
  
  // Spam-related
  'viagra', 'cialis', 'enlarge', 'cryptocurrency', 'bitcoin', 'ethereum',
  'make money', 'get rich', 'earn fast', 'pyramid', 'scheme',
  
  // Links and promotion
  'discord.gg', 'telegram.me'
];

// Special regexes for detecting slurs - adapted from https://github.com/Blank-Cheque/Slurs
/* eslint-disable no-misleading-character-class */
const EXPLICIT_SLUR_REGEXES = [
  /\bc[hH][iIl1][nN][kKsS]?\b/,                    // Anti-Asian slur
  /\bc[oO]{2}[nN][sS]?\b/,                         // Anti-Black slur
  /\bf[aA][gG]{1,2}([oOeE][tT]?|[iIyY][nNeE]?)?s?\b/, // Anti-LGBTQ+ slur
  /\bk[iIyY][kK][eE][sS]?\b/,                      // Anti-Semitic slur
  /\bn[iIl1oO][gG]{2}([aAeE][rR]?|[lL][eE][tT]|[nNoO][gG])?s?\b/, // Anti-Black slur
  /\bn[iIl1oO][gG]{2}[aAeE][sS]\b/,                // Anti-Black slur variation
  /\bt[rR][aA][nN][nN][iIyY][eE]?[sS]?\b/,         // Anti-transgender slur
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
  
  // Check explicit slur regexes (specialized pattern matching)
  for (const regex of EXPLICIT_SLUR_REGEXES) {
    if (regex.test(text)) {
      return true;
    }
  }
  
  // Check for exact matches and partial matches in the banned words list
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

/**
 * Specialized function to check for explicit slurs using the advanced regex patterns
 * @param text The text to check
 * @returns True if the text contains any explicit slurs
 */
export function containsExplicitSlurs(text: string): boolean {
  if (!text) return false;
  
  return EXPLICIT_SLUR_REGEXES.some(regex => regex.test(text));
}

/**
 * Checks if a character is one of our allowed emojis
 * @param emoji The emoji character to check
 * @returns True if the emoji is in our allowed list
 */
export function isAllowedEmoji(emoji: string): boolean {
  const ALLOWED_EMOJIS = [
    '🚽', '🧻', '💩', '💨', '🚾', '🧼', '🪠', '🚻', '🩸', '💧', '💦', '😌', 
    '😣', '🤢', '🤮', '🥴', '😮‍💨', '😳', '😵', '🌾', '🍦', '📱', '📖', '💭',
    '1️⃣', '2️⃣', '🟡', '🟤'
  ];
  
  return ALLOWED_EMOJIS.includes(emoji);
}