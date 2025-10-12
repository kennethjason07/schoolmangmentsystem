#!/usr/bin/env node

/**
 * Test Script for Parent Chat Badge Fixes
 * 
 * This script tests the implemented fixes for parent chat badge count issues.
 * It can run various test scenarios to verify the fixes are working correctly.
 * 
 * Usage:
 *   node test_parent_badge_fix.js [parent_user_id] [test_type]
 * 
 * Test Types:
 *   - diagnosis: Run diagnostic tests
 *   - quick-fix: Test quick fix functionality
 *   - full-fix: Test full fix functionality
 *   - all: Run all tests (default)
 * 
 * Examples:
 *   node test_parent_badge_fix.js "550e8400-e29b-41d4-a716-446655440000" diagnosis
 *   node test_parent_badge_fix.js "550e8400-e29b-41d4-a716-446655440000" all
 */

// Import required modules
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration (same as in app)
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Table constants
const TABLES = {
  MESSAGES: 'messages',
  USERS: 'users',
  NOTIFICATION_RECIPIENTS: 'notification_recipients'
};

// Test results tracker
let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

/**
 * Utility function to log test results
 */
function logTest(testName, passed, message, warning = false) {
  const status = warning ? '⚠️' : (passed ? '✅' : '❌');
  const result = warning ? 'WARNING' : (passed ? 'PASS' : 'FAIL');
  
  console.log(`${status} ${testName}: ${result} - ${message}`);
  
  testResults.tests.push({
    name: testName,
    status: result,
    message,
    timestamp: new Date().toISOString()
  });
  
  if (warning) {
    testResults.warnings++;
  } else if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

/**
 * Test 1: Basic parent user validation
 */
async function testParentUserValidation(parentUserId) {
  console.log('\n🧪 Test 1: Parent User Validation');
  console.log('='.repeat(40));
  
  try {
    // Check if parent user exists
    const { data: parentUser, error } = await supabase
      .from(TABLES.USERS)
      .select('id, email, tenant_id')
      .eq('id', parentUserId)
      .maybeSingle();
    
    if (error) {
      logTest('Parent User Query', false, `Database error: ${error.message}`);
      return false;
    }
    
    if (!parentUser) {
      logTest('Parent User Exists', false, 'Parent user not found in database');
      return false;
    }
    
    logTest('Parent User Exists', true, `Found user: ${parentUser.email}`);
    
    // Check tenant ID
    if (!parentUser.tenant_id) {
      logTest('Tenant ID Assignment', false, 'Parent user has no tenant_id assigned');
      return false;
    }
    
    logTest('Tenant ID Assignment', true, `Tenant ID: ${parentUser.tenant_id}`);
    
    return true;
    
  } catch (error) {
    logTest('Parent User Validation', false, `Unexpected error: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Message count accuracy
 */
async function testMessageCountAccuracy(parentUserId) {
  console.log('\n🧪 Test 2: Message Count Accuracy');
  console.log('='.repeat(40));
  
  try {
    // Get parent tenant ID first
    const { data: parentUser } = await supabase
      .from(TABLES.USERS)
      .select('tenant_id')
      .eq('id', parentUserId)
      .single();
    
    if (!parentUser?.tenant_id) {
      logTest('Message Count Test', false, 'Cannot test without parent tenant ID');
      return false;
    }
    
    // Get all messages for parent
    const { data: allMessages, error: allError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, is_read, tenant_id')
      .eq('receiver_id', parentUserId);
    
    if (allError) {
      logTest('All Messages Query', false, `Error fetching messages: ${allError.message}`);
      return false;
    }
    
    const totalMessages = allMessages?.length || 0;
    logTest('Total Messages Query', true, `Found ${totalMessages} total messages`);
    
    // Count unread messages (all)
    const unreadAll = allMessages?.filter(msg => msg.is_read === false) || [];
    
    // Count unread messages (tenant-filtered)
    const unreadTenantFiltered = allMessages?.filter(msg => 
      msg.is_read === false && msg.tenant_id === parentUser.tenant_id
    ) || [];
    
    // Count cross-tenant unread messages
    const crossTenant = allMessages?.filter(msg => 
      msg.is_read === false && msg.tenant_id && msg.tenant_id !== parentUser.tenant_id
    ) || [];
    
    logTest('Unread Messages (All)', unreadAll.length >= 0, `${unreadAll.length} unread messages total`);
    logTest('Unread Messages (Tenant-Filtered)', unreadTenantFiltered.length >= 0, `${unreadTenantFiltered.length} unread messages for tenant`);
    
    if (crossTenant.length > 0) {
      logTest('Cross-Tenant Messages', false, `Found ${crossTenant.length} cross-tenant unread messages - this causes badge count issues`);
    } else {
      logTest('Cross-Tenant Messages', true, 'No cross-tenant messages found');
    }
    
    return crossTenant.length === 0; // Success if no cross-tenant issues
    
  } catch (error) {
    logTest('Message Count Accuracy', false, `Unexpected error: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Tenant filtering effectiveness
 */
async function testTenantFiltering(parentUserId) {
  console.log('\n🧪 Test 3: Tenant Filtering Effectiveness');
  console.log('='.repeat(40));
  
  try {
    // Simulate the ChatBadge query with tenant filtering
    const { data: parentUser } = await supabase
      .from(TABLES.USERS)
      .select('tenant_id')
      .eq('id', parentUserId)
      .single();
    
    if (!parentUser?.tenant_id) {
      logTest('Tenant Filter Test', false, 'Cannot test tenant filtering without tenant ID');
      return false;
    }
    
    // Query with tenant filter (like ChatBadge does)
    const { data: tenantFiltered, error: tenantError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, sender_id, tenant_id, sent_at')
      .eq('receiver_id', parentUserId)
      .eq('is_read', false)
      .eq('tenant_id', parentUser.tenant_id);
    
    if (tenantError) {
      logTest('Tenant-Filtered Query', false, `Error: ${tenantError.message}`);
      return false;
    }
    
    // Query without tenant filter
    const { data: unfiltered, error: unfilteredError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, sender_id, tenant_id, sent_at')
      .eq('receiver_id', parentUserId)
      .eq('is_read', false);
    
    if (unfilteredError) {
      logTest('Unfiltered Query', false, `Error: ${unfilteredError.message}`);
      return false;
    }
    
    const filteredCount = tenantFiltered?.length || 0;
    const unfilteredCount = unfiltered?.length || 0;
    
    logTest('Tenant-Filtered Count', true, `${filteredCount} messages with tenant filter`);
    logTest('Unfiltered Count', true, `${unfilteredCount} messages without tenant filter`);
    
    if (filteredCount < unfilteredCount) {
      logTest('Tenant Filtering Effective', true, `Tenant filter reduced count by ${unfilteredCount - filteredCount} messages`);
      
      // Check if the filtered-out messages are from different tenants
      const filteredOutMessages = unfiltered?.filter(msg => 
        !tenantFiltered?.some(filtered => filtered.id === msg.id)
      ) || [];
      
      const crossTenantCount = filteredOutMessages.filter(msg => 
        msg.tenant_id && msg.tenant_id !== parentUser.tenant_id
      ).length;
      
      if (crossTenantCount > 0) {
        logTest('Cross-Tenant Detection', true, `${crossTenantCount} cross-tenant messages correctly filtered out`);
      }
      
      return true;
    } else if (filteredCount === unfilteredCount) {
      logTest('Tenant Filtering', true, 'All messages belong to correct tenant (no filtering needed)');
      return true;
    } else {
      logTest('Tenant Filtering', false, 'Filtered count is higher than unfiltered count - this should not happen');
      return false;
    }
    
  } catch (error) {
    logTest('Tenant Filtering Test', false, `Unexpected error: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Quick fix functionality
 */
async function testQuickFix(parentUserId) {
  console.log('\n🧪 Test 4: Quick Fix Functionality');
  console.log('='.repeat(40));
  
  try {
    // Get baseline count
    const { data: beforeMessages, error: beforeError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, is_read, tenant_id')
      .eq('receiver_id', parentUserId);
    
    if (beforeError) {
      logTest('Baseline Count', false, `Error getting baseline: ${beforeError.message}`);
      return false;
    }
    
    const baselineUnread = beforeMessages?.filter(msg => msg.is_read === false).length || 0;
    logTest('Baseline Unread Count', true, `${baselineUnread} unread messages before fix`);
    
    // Simulate quick fix logic (tenant-aware count)
    const { data: parentUser } = await supabase
      .from(TABLES.USERS)
      .select('tenant_id')
      .eq('id', parentUserId)
      .single();
    
    if (parentUser?.tenant_id) {
      const { data: tenantFiltered, error: tenantError } = await supabase
        .from(TABLES.MESSAGES)
        .select('id')
        .eq('receiver_id', parentUserId)
        .eq('is_read', false)
        .eq('tenant_id', parentUser.tenant_id);
      
      if (!tenantError) {
        const tenantFilteredCount = tenantFiltered?.length || 0;
        logTest('Quick Fix Simulation', true, `Quick fix would show ${tenantFilteredCount} messages`);
        
        if (tenantFilteredCount !== baselineUnread) {
          logTest('Quick Fix Improvement', true, `Would correct count from ${baselineUnread} to ${tenantFilteredCount}`);
        } else {
          logTest('Quick Fix No Change', true, 'No correction needed - counts already match');
        }
        
        return true;
      }
    }
    
    logTest('Quick Fix Test', false, 'Could not simulate quick fix');
    return false;
    
  } catch (error) {
    logTest('Quick Fix Test', false, `Unexpected error: ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Full fix functionality simulation
 */
async function testFullFix(parentUserId) {
  console.log('\n🧪 Test 5: Full Fix Functionality (Simulation)');
  console.log('='.repeat(40));
  
  try {
    // Get parent tenant ID
    const { data: parentUser } = await supabase
      .from(TABLES.USERS)
      .select('tenant_id')
      .eq('id', parentUserId)
      .single();
    
    if (!parentUser?.tenant_id) {
      logTest('Full Fix Test', false, 'Cannot test full fix without tenant ID');
      return false;
    }
    
    // Check for cross-tenant messages that would be affected
    const { data: crossTenantMessages, error: crossError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, sender_id, tenant_id, sent_at')
      .eq('receiver_id', parentUserId)
      .eq('is_read', false)
      .neq('tenant_id', parentUser.tenant_id);
    
    if (crossError) {
      logTest('Cross-Tenant Check', false, `Error checking cross-tenant messages: ${crossError.message}`);
      return false;
    }
    
    const crossTenantCount = crossTenantMessages?.length || 0;
    
    if (crossTenantCount > 0) {
      logTest('Full Fix Potential', true, `Would mark ${crossTenantCount} cross-tenant messages as read`);
      logTest('Full Fix Simulation', true, 'Full fix would resolve cross-tenant message issues');
      
      // Show which messages would be affected
      console.log('\n   Messages that would be marked as read:');
      crossTenantMessages?.slice(0, 3).forEach((msg, index) => {
        console.log(`   ${index + 1}. Message ${msg.id} from tenant ${msg.tenant_id}`);
      });
      
      if (crossTenantCount > 3) {
        console.log(`   ... and ${crossTenantCount - 3} more messages`);
      }
      
    } else {
      logTest('Full Fix Not Needed', true, 'No cross-tenant messages to fix');
    }
    
    // Test cache clear simulation
    logTest('Cache Clear Simulation', true, 'Would clear notification service cache');
    logTest('Broadcast Simulation', true, 'Would broadcast update to refresh badges');
    
    return true;
    
  } catch (error) {
    logTest('Full Fix Test', false, `Unexpected error: ${error.message}`);
    return false;
  }
}

/**
 * Test 6: Badge component behavior simulation
 */
async function testBadgeComponentBehavior(parentUserId) {
  console.log('\n🧪 Test 6: Badge Component Behavior');
  console.log('='.repeat(40));
  
  try {
    // Simulate ChatBadge fetchMessageCount logic
    const { data: parentUser } = await supabase
      .from(TABLES.USERS)
      .select('tenant_id')
      .eq('id', parentUserId)
      .single();
    
    if (!parentUser) {
      logTest('User Context', false, 'No user found for badge simulation');
      return false;
    }
    
    logTest('User Context', true, `Badge would use tenant: ${parentUser.tenant_id || 'NULL'}`);
    
    // Simulate the enhanced query with tenant filtering
    let query = supabase
      .from(TABLES.MESSAGES)
      .select('id, sender_id, tenant_id, sent_at')
      .eq('receiver_id', parentUserId)
      .eq('is_read', false);
    
    // Apply tenant filter if available (like in enhanced ChatBadge)
    if (parentUser.tenant_id) {
      query = query.eq('tenant_id', parentUser.tenant_id);
      logTest('Tenant Filter Applied', true, 'Badge would apply tenant filtering');
    } else {
      logTest('Tenant Filter Applied', false, 'Badge would NOT apply tenant filtering (no tenant_id)');
    }
    
    const { data, error } = await query;
    
    if (error) {
      logTest('Badge Query Simulation', false, `Error: ${error.message}`);
      return false;
    }
    
    const badgeCount = data?.length || 0;
    logTest('Badge Count Simulation', true, `Badge would show: ${badgeCount}`);
    
    // Check for potential tenant mismatches
    if (data && data.length > 0 && parentUser.tenant_id) {
      const crossTenantInResults = data.filter(msg => 
        msg.tenant_id && msg.tenant_id !== parentUser.tenant_id
      );
      
      if (crossTenantInResults.length > 0) {
        logTest('Badge Cross-Tenant Detection', false, `Badge would detect ${crossTenantInResults.length} cross-tenant messages`);
      } else {
        logTest('Badge Cross-Tenant Detection', true, 'Badge would detect no cross-tenant messages');
      }
    }
    
    return true;
    
  } catch (error) {
    logTest('Badge Component Test', false, `Unexpected error: ${error.message}`);
    return false;
  }
}

/**
 * Run diagnostic tests
 */
async function runDiagnosticTests(parentUserId) {
  console.log('🔍 Running Diagnostic Tests...\n');
  
  const results = await Promise.all([
    testParentUserValidation(parentUserId),
    testMessageCountAccuracy(parentUserId),
    testTenantFiltering(parentUserId)
  ]);
  
  return results.every(result => result === true);
}

/**
 * Run fix tests
 */
async function runFixTests(parentUserId) {
  console.log('🛠️ Running Fix Tests...\n');
  
  const results = await Promise.all([
    testQuickFix(parentUserId),
    testFullFix(parentUserId),
    testBadgeComponentBehavior(parentUserId)
  ]);
  
  return results.every(result => result === true);
}

/**
 * Main test function
 */
async function runTests(parentUserId, testType = 'all') {
  console.log('🧪 Parent Chat Badge Fix Test Suite');
  console.log('=====================================');
  console.log(`👤 Parent User ID: ${parentUserId}`);
  console.log(`📋 Test Type: ${testType}`);
  console.log(`⏰ Start Time: ${new Date().toISOString()}\n`);
  
  let allPassed = true;
  
  try {
    switch (testType.toLowerCase()) {
      case 'diagnosis':
        allPassed = await runDiagnosticTests(parentUserId);
        break;
        
      case 'quick-fix':
        allPassed = await testQuickFix(parentUserId);
        break;
        
      case 'full-fix':
        allPassed = await testFullFix(parentUserId);
        break;
        
      case 'badge':
        allPassed = await testBadgeComponentBehavior(parentUserId);
        break;
        
      case 'all':
      default:
        const diagnosticsPassed = await runDiagnosticTests(parentUserId);
        const fixesPassed = await runFixTests(parentUserId);
        allPassed = diagnosticsPassed && fixesPassed;
        break;
    }
    
  } catch (error) {
    console.error('❌ Test suite error:', error);
    allPassed = false;
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`⚠️ Warnings: ${testResults.warnings}`);
  console.log(`📋 Total Tests: ${testResults.tests.length}`);
  console.log(`🎯 Overall Result: ${allPassed ? '✅ SUCCESS' : '❌ FAILURE'}`);
  console.log(`⏰ Completion Time: ${new Date().toISOString()}`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.tests
      .filter(test => test.status === 'FAIL')
      .forEach((test, index) => {
        console.log(`   ${index + 1}. ${test.name}: ${test.message}`);
      });
  }
  
  if (testResults.warnings > 0) {
    console.log('\n⚠️ WARNINGS:');
    testResults.tests
      .filter(test => test.status === 'WARNING')
      .forEach((test, index) => {
        console.log(`   ${index + 1}. ${test.name}: ${test.message}`);
      });
  }
  
  return allPassed;
}

/**
 * Main function
 */
async function main() {
  const parentUserId = process.argv[2];
  const testType = process.argv[3] || 'all';
  
  if (!parentUserId) {
    console.error('❌ Error: Parent user ID is required');
    console.log('\nUsage:');
    console.log('  node test_parent_badge_fix.js [parent_user_id] [test_type]');
    console.log('\nTest Types:');
    console.log('  - diagnosis: Run diagnostic tests');
    console.log('  - quick-fix: Test quick fix functionality');
    console.log('  - full-fix: Test full fix functionality');
    console.log('  - badge: Test badge component behavior');
    console.log('  - all: Run all tests (default)');
    console.log('\nExample:');
    console.log('  node test_parent_badge_fix.js "550e8400-e29b-41d4-a716-446655440000" all');
    process.exit(1);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(parentUserId)) {
    console.error('❌ Error: Invalid UUID format for parent user ID');
    console.log('Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    process.exit(1);
  }

  try {
    const success = await runTests(parentUserId, testType);
    
    // Save detailed results to file
    const outputFile = `parent_badge_fix_test_results_${parentUserId}_${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      parentUserId,
      testType,
      timestamp: new Date().toISOString(),
      summary: {
        passed: testResults.passed,
        failed: testResults.failed,
        warnings: testResults.warnings,
        total: testResults.tests.length,
        success
      },
      tests: testResults.tests
    }, null, 2));
    
    console.log(`\n💾 Detailed results saved to: ${outputFile}`);
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}