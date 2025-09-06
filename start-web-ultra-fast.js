#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('⚡ Starting ULTRA-FAST web version...');
console.log('🎯 Optimizations applied:');
console.log('   ✅ Minimal polyfills (defer heavy ones)');
console.log('   ✅ Async component loading');
console.log('   ✅ Deferred diagnostics');
console.log('   ✅ Heavy library splitting');
console.log('   ✅ Ultra-minimal entry point');
console.log();

// Backup current index.js
const indexPath = path.join(__dirname, 'index.js');
const backupPath = path.join(__dirname, 'index.js.backup');

try {
  if (fs.existsSync(indexPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(indexPath, backupPath);
    console.log('📦 Backed up current index.js');
  }

  // Use minimal index
  const minimalIndexPath = path.join(__dirname, 'index.minimal.js');
  fs.copyFileSync(minimalIndexPath, indexPath);
  console.log('🚀 Switched to ultra-minimal configuration');

  console.log();
  console.log('Starting Expo web server...');
  console.log();

  const child = spawn('npx', ['expo', 'start', '--web', '--clear'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      EXPO_PLATFORM: 'web'
    }
  });

  // Cleanup on exit
  const cleanup = () => {
    try {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, indexPath);
        fs.unlinkSync(backupPath);
        console.log('✅ Restored original index.js');
      }
    } catch (error) {
      console.warn('Warning: Could not restore original index.js:', error.message);
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  child.on('exit', (code) => {
    console.log(`\nExpo process exited with code ${code}`);
    cleanup();
  });

} catch (error) {
  console.error('❌ Error starting ultra-fast mode:', error.message);
  
  // Try to restore backup if something went wrong
  try {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, indexPath);
      fs.unlinkSync(backupPath);
    }
  } catch (restoreError) {
    console.error('❌ Could not restore backup:', restoreError.message);
  }
  
  process.exit(1);
}
