// Copy and paste this entire script into your browser console while on the Manage Classes page

console.log('🔍 STARTING WEB CONSOLE TEST');
console.log('================================');

// Test 1: Check basic environment
console.log('🌐 Environment Check:');
console.log('- URL:', window.location.href);
console.log('- User Agent:', navigator.userAgent);
console.log('- Timestamp:', new Date().toISOString());

// Test 2: Check if React DevTools can see components
console.log('\n🔍 React Component Check:');
if (window.React) {
  console.log('✅ React is available globally');
} else {
  console.log('❌ React not available globally');
}

// Test 3: Check Supabase availability
console.log('\n📡 Supabase Check:');
if (typeof supabase !== 'undefined') {
  console.log('✅ Supabase available globally');
  
  // Quick connection test
  supabase.from('classes').select('id, class_name').limit(1)
    .then(result => {
      console.log('✅ Supabase connection test successful:', result);
    })
    .catch(error => {
      console.log('❌ Supabase connection test failed:', error);
    });
} else {
  console.log('❌ Supabase not available globally');
}

// Test 4: Check localStorage for auth and tenant info
console.log('\n💾 Local Storage Check:');
console.log('- Auth token:', localStorage.getItem('supabase.auth.token') ? 'EXISTS' : 'MISSING');
console.log('- Tenant ID:', localStorage.getItem('tenantId') || 'MISSING');
console.log('- User ID:', localStorage.getItem('userId') || 'MISSING');

// Test 5: Check for common JavaScript errors
console.log('\n🚨 Error Check:');
let errorCount = 0;
const originalError = console.error;
console.error = (...args) => {
  errorCount++;
  console.log(`❌ Error #${errorCount}:`, ...args);
  originalError.apply(console, args);
};

// Test 6: Manual function availability test
console.log('\n🔧 Function Availability:');
setTimeout(() => {
  console.log('- handleDeleteClass:', typeof handleDeleteClass);
  console.log('- Alert function:', typeof alert);
  console.log('- Fetch function:', typeof fetch);
}, 1000);

console.log('\n✅ WEB CONSOLE TEST COMPLETE');
console.log('================================');
console.log('Now try clicking the 🧪 Test Delete button and watch for more logs...');