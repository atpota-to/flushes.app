#!/usr/bin/env node

/**
 * Test script for OAuth migration
 * 
 * This script temporarily switches the app to use the new OAuth implementation
 * for testing purposes. Run with: node test-new-oauth.js
 */

const fs = require('fs');
const path = require('path');

const LAYOUT_PATH = path.join(__dirname, 'app/src/app/layout.tsx');
const BACKUP_PATH = path.join(__dirname, 'app/src/app/layout.tsx.backup');

function backupAndUpdate() {
  try {
    // Read the current layout file
    const layoutContent = fs.readFileSync(LAYOUT_PATH, 'utf8');
    
    // Create backup
    fs.writeFileSync(BACKUP_PATH, layoutContent);
    console.log('✅ Created backup of layout.tsx');
    
    // Update to use new auth context
    const updatedContent = layoutContent.replace(
      "import { AuthProvider } from '@/lib/auth-context';",
      "import { AuthProvider } from '@/lib/auth-context-new';"
    );
    
    if (updatedContent === layoutContent) {
      console.log('⚠️  No changes needed - import not found or already updated');
      return;
    }
    
    // Write updated content
    fs.writeFileSync(LAYOUT_PATH, updatedContent);
    console.log('✅ Updated layout.tsx to use new OAuth implementation');
    
    console.log('\n🧪 Test Setup Complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: cd app && npm run dev');
    console.log('2. Test authentication at http://localhost:3000/auth/login');
    console.log('3. Try both Bluesky and third-party PDS handles');
    console.log('4. When done testing, run: node restore-oauth.js');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error updating layout:', error.message);
  }
}

function checkFiles() {
  const requiredFiles = [
    'app/src/lib/oauth-client.ts',
    'app/src/lib/auth-context-new.tsx',
    'app/src/lib/api-client.ts',
    'app/src/app/auth/login/page-new.tsx',
    'app/src/app/auth/callback/page-new.tsx'
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    console.error('❌ Missing required files:');
    missingFiles.forEach(file => console.error(`   - ${file}`));
    console.error('\nPlease ensure all new OAuth files have been created.');
    process.exit(1);
  }
  
  console.log('✅ All required files found');
}

// Main execution
console.log('🔄 Setting up OAuth migration test...\n');

checkFiles();
backupAndUpdate(); 