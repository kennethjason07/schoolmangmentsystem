// Real-time Parent Login Debugging Script
// Run this in the browser console while attempting parent login

console.log('🚨 PARENT LOGIN DEBUGGER ACTIVATED 🚨');
console.log('==================================================');
console.log('This will capture and analyze parent login attempts');
console.log('==================================================\n');

// Override console.log to capture AuthContext logs
const originalConsoleLog = console.log;
const authLogs = [];

console.log = function(...args) {
    const message = args.join(' ');
    
    // Capture all AUTH and PARENT-DEBUG logs
    if (message.includes('[AUTH]') || message.includes('[PARENT-DEBUG]') || 
        message.includes('About to set userType') || message.includes('User profile found') ||
        message.includes('role_id') || message.includes('Final role name')) {
        
        authLogs.push({
            timestamp: new Date().toISOString(),
            message: message,
            args: args
        });
        
        // Highlight critical information
        if (message.includes('role_id')) {
            originalConsoleLog('🎯 CRITICAL:', ...args);
        } else if (message.includes('userType')) {
            originalConsoleLog('🎭 USER TYPE:', ...args);
        } else if (message.includes('PARENT-DEBUG')) {
            originalConsoleLog('🐞 PARENT DEBUG:', ...args);
        } else {
            originalConsoleLog('📝 AUTH LOG:', ...args);
        }
    } else {
        originalConsoleLog(...args);
    }
};

// Function to analyze the captured logs
window.analyzeParentLogin = function() {
    console.log('\n🔍 PARENT LOGIN ANALYSIS');
    console.log('========================\n');
    
    const relevantLogs = authLogs.filter(log => 
        log.message.includes('role_id') || 
        log.message.includes('userType') ||
        log.message.includes('PARENT-DEBUG') ||
        log.message.includes('User profile found')
    );
    
    if (relevantLogs.length === 0) {
        console.log('❌ No relevant authentication logs captured.');
        console.log('💡 Try logging in again with a parent account.');
        return;
    }
    
    console.log('📊 Key Authentication Events:');
    relevantLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.timestamp.split('T')[1].split('.')[0]}] ${log.message}`);
    });
    
    // Look for specific issues
    const roleIdLogs = relevantLogs.filter(log => log.message.includes('User role_id:'));
    const userTypeLogs = relevantLogs.filter(log => log.message.includes('About to set userType:'));
    
    console.log('\n🎯 DIAGNOSIS:');
    
    if (roleIdLogs.length > 0) {
        const lastRoleLog = roleIdLogs[roleIdLogs.length - 1];
        console.log('✅ Found role_id in logs:', lastRoleLog.message);
        
        if (lastRoleLog.message.includes('role_id: 3')) {
            console.log('✅ User has correct parent role_id (3)');
        } else {
            console.log('❌ User does NOT have parent role_id (3)');
            console.log('💡 This is likely the root cause of the issue');
        }
    } else {
        console.log('❌ No role_id information found in logs');
    }
    
    if (userTypeLogs.length > 0) {
        const lastUserTypeLog = userTypeLogs[userTypeLogs.length - 1];
        console.log('✅ Found userType setting:', lastUserTypeLog.message);
        
        if (lastUserTypeLog.message.includes('parent')) {
            console.log('✅ userType correctly set to parent');
        } else {
            console.log('❌ userType NOT set to parent');
            console.log('💡 This confirms the bug is still present');
        }
    } else {
        console.log('❌ No userType information found in logs');
    }
    
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Check the database - does this parent user have role_id = 3?');
    console.log('2. Check if the roles table exists and has the correct mapping');
    console.log('3. Check for any database connection issues during login');
    
    return relevantLogs;
};

// Function to check current auth state
window.checkAuthState = function() {
    console.log('\n🔍 CURRENT AUTH STATE CHECK');
    console.log('===========================');
    
    // Try to access React components to get current state
    const reactFiberKey = Object.keys(document.querySelector('#root') || {}).find(key => key.startsWith('__reactFiber'));
    
    if (reactFiberKey) {
        try {
            const fiber = document.querySelector('#root')[reactFiberKey];
            // This is a simplified way to try to access React state
            console.log('📱 React app detected, but cannot directly access auth state from console');
            console.log('💡 Use the React Developer Tools to inspect AuthContext state');
        } catch (e) {
            console.log('❌ Cannot access React state from console');
        }
    } else {
        console.log('❌ React app not detected or not accessible');
    }
};

console.log('🔧 DEBUGGING TOOLS LOADED:');
console.log('- All AuthContext logs will now be highlighted');
console.log('- After attempting parent login, run: analyzeParentLogin()');
console.log('- To check current auth state, run: checkAuthState()');
console.log('\n👉 Now try logging in with your parent account...\n');
