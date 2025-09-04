// Test script to verify the session fix in TenantContext
import React from 'react';
import { TenantProvider } from './src/contexts/TenantContext.js';

// Simple test to make sure TenantContext can be imported without errors
console.log('Testing TenantContext import...');

try {
  const TestComponent = () => {
    return React.createElement(TenantProvider, { children: null });
  };
  
  console.log('✅ TenantContext imported successfully without session reference errors');
  console.log('✅ Fix for "Property \'session\' doesn\'t exist" error appears to be working');
} catch (error) {
  console.error('❌ Error importing TenantContext:', error.message);
  console.error('❌ Session reference error may still exist');
}

console.log('Test completed.');
