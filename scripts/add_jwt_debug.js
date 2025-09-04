// Add this code to your NotificationManagement.js loadNotifications function
// (around line 65, after getting the session)

console.log('🔍 [JWT_DEBUG] Analyzing JWT token content...');
if (session?.access_token) {
  try {
    // Decode JWT payload (not verifying signature, just reading)
    const token = session.access_token;
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(atob(base64Payload));
    
    console.log('🔍 [JWT_DEBUG] JWT Payload:');
    console.log('   - iss (issuer):', payload.iss);
    console.log('   - sub (subject/user_id):', payload.sub);
    console.log('   - email:', payload.email);
    console.log('   - role:', payload.role);
    console.log('   - tenant_id:', payload.tenant_id || '❌ MISSING!');
    console.log('   - user_metadata:', JSON.stringify(payload.user_metadata || {}, null, 2));
    console.log('   - app_metadata:', JSON.stringify(payload.app_metadata || {}, null, 2));
    
    if (!payload.tenant_id) {
      console.log('❌ [JWT_DEBUG] CRITICAL: No tenant_id in JWT token!');
      console.log('❌ [JWT_DEBUG] This explains why RLS policies block all access');
      console.log('💡 [JWT_DEBUG] Need to update user authentication to include tenant_id in JWT');
    } else {
      console.log('✅ [JWT_DEBUG] tenant_id found in JWT:', payload.tenant_id);
      console.log('🔍 [JWT_DEBUG] Matches expected tenant?', payload.tenant_id === 'b8f8b5f0-1234-4567-8901-123456789000');
    }
    
  } catch (e) {
    console.log('❌ [JWT_DEBUG] Failed to decode JWT:', e.message);
  }
} else {
  console.log('❌ [JWT_DEBUG] No access token in session');
}

// COPY THE CODE ABOVE AND ADD TO NotificationManagement.js around line 65-70
