// Quick debug script to identify the exact class deletion issue
console.log('🔍 Starting immediate class deletion debug...');

// Check if we're in a React Native environment or Node.js
const isReactNative = typeof global !== 'undefined' && global.HermesInternal;
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

console.log('Environment check:', { isReactNative, isNode });

if (isNode) {
  console.log('❌ This script is intended to be run in the React Native app console, not Node.js');
  console.log('');
  console.log('📋 Manual Debug Steps:');
  console.log('1. Open your React Native app');
  console.log('2. Open the developer console (Chrome DevTools for Expo/Metro)');
  console.log('3. Navigate to Manage Classes screen');
  console.log('4. Try to delete a class and watch console logs');
  console.log('5. Look for any error messages starting with "❌" or "🗑️"');
  console.log('');
  console.log('🔧 Common issues to check:');
  console.log('- Check if the delete button is actually calling handleDeleteClass function');
  console.log('- Verify tenant ID is being passed correctly');
  console.log('- Look for any RLS (Row Level Security) errors');
  console.log('- Check for foreign key constraint errors');
  process.exit(0);
}

// If we're in React Native environment, run the debug
async function quickDebugClassDeletion() {
  try {
    console.log('🏢 Environment: React Native detected');
    
    // Try to access global objects that should be available
    if (typeof global !== 'undefined') {
      console.log('✅ Global object available');
    }
    
    // Check if supabase is available
    if (typeof window !== 'undefined' && window.supabase) {
      console.log('✅ Supabase available on window object');
    } else {
      console.log('⚠️ Supabase not found on window object');
    }
    
    // Instructions for manual debugging
    console.log('');
    console.log('🔍 MANUAL DEBUGGING INSTRUCTIONS:');
    console.log('================================');
    console.log('');
    console.log('1. Open the Manage Classes screen');
    console.log('2. Open Chrome DevTools (if using Expo web) or React Native Debugger');
    console.log('3. Go to Console tab');
    console.log('4. Try deleting a class and watch for these logs:');
    console.log('   - "🗑️ Starting class deletion process for class ID: [id]"');
    console.log('   - "🏢 Using tenant ID: [tenant_id]"');
    console.log('   - Step-by-step deletion logs (📚, 👨‍🏫, etc.)');
    console.log('');
    console.log('5. If you see an error, note down:');
    console.log('   - The exact error message');
    console.log('   - Which step it failed on');
    console.log('   - Any error codes (like PGRST116, 23503, etc.)');
    console.log('');
    console.log('6. Common error patterns to look for:');
    console.log('   - "row-level security" → RLS policy issue');
    console.log('   - "foreign key constraint" → Delete order issue');
    console.log('   - "permission denied" → Database permissions');
    console.log('   - "tenant_id" errors → Tenant context issue');
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the debug
quickDebugClassDeletion();