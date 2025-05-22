#!/usr/bin/env node

/**
 * Restore script for OAuth migration
 * 
 * This script restores the original OAuth implementation after testing
 * Run with: node restore-oauth.js
 */

const fs = require('fs');
const path = require('path');

const LAYOUT_PATH = path.join(__dirname, 'app/src/app/layout.tsx');
const BACKUP_PATH = path.join(__dirname, 'app/src/app/layout.tsx.backup');

function restore() {
  try {
    // Check if backup exists
    if (!fs.existsSync(BACKUP_PATH)) {
      console.log('⚠️  No backup found - nothing to restore');
      return;
    }
    
    // Read backup content
    const backupContent = fs.readFileSync(BACKUP_PATH, 'utf8');
    
    // Restore the original file
    fs.writeFileSync(LAYOUT_PATH, backupContent);
    console.log('✅ Restored original layout.tsx');
    
    // Remove backup file
    fs.unlinkSync(BACKUP_PATH);
    console.log('✅ Cleaned up backup file');
    
    console.log('\n🔄 Restoration Complete!');
    console.log('');
    console.log('The app is now using the original OAuth implementation.');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error restoring layout:', error.message);
  }
}

// Main execution
console.log('🔄 Restoring original OAuth implementation...\n');
restore(); 