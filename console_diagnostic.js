// 🚨 MARKS SAVE ISSUE - CONSOLE DIAGNOSTIC SCRIPT
// Copy and paste this entire script into your browser console

console.log('🔍 Starting Marks Save Diagnostic...');
console.log('⏰ Diagnostic time:', new Date().toISOString());

// Diagnostic results object
window.marksDebugResults = {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    checks: {}
};

// Check 1: Platform Detection
console.log('\n📱 CHECK 1: Platform Detection');
window.marksDebugResults.checks.platform = {
    detected: navigator.platform,
    isWeb: typeof window !== 'undefined',
    hasReactNative: typeof require !== 'undefined'
};
console.log('✅ Platform:', navigator.platform);
console.log('✅ Running in browser:', typeof window !== 'undefined');

// Check 2: Enhanced Component Loading
console.log('\n🔧 CHECK 2: Enhanced Component Loading');
const expectedLogs = [
    '💻 EXAMS MARKS - Component loaded on platform',
    '🔧 EXAMS MARKS - Enhanced marks saving functionality active',
    '🔍 EXAMS MARKS - Version: Enhanced with web compatibility'
];

window.marksDebugResults.checks.componentLoading = {
    expectedMessages: expectedLogs,
    found: 'Check console history for these messages'
};

console.log('🔍 Looking for enhanced component messages...');
console.log('Expected messages:');
expectedLogs.forEach(msg => console.log('  -', msg));
console.log('❓ Do you see these messages in your console history?');

// Check 3: Global Function Availability
console.log('\n🔧 CHECK 3: Function Availability');
const criticalFunctions = [
    'handleBulkSaveMarks',
    'handleMarksChange'
];

window.marksDebugResults.checks.functions = {};
criticalFunctions.forEach(funcName => {
    const available = typeof window[funcName] === 'function';
    window.marksDebugResults.checks.functions[funcName] = available;
    
    if (available) {
        console.log('✅', funcName, 'is available globally');
    } else {
        console.log('❌', funcName, 'is NOT available globally');
        console.log('   This may indicate the function is scoped to a component');
    }
});

// Check 4: Form State Testing
console.log('\n📊 CHECK 4: Form State');
if (typeof window.marksForm !== 'undefined') {
    const formKeys = Object.keys(window.marksForm);
    window.marksDebugResults.checks.formState = {
        exists: true,
        studentCount: formKeys.length,
        hasData: formKeys.length > 0
    };
    
    console.log('✅ marksForm exists globally');
    console.log('📊 Students with marks:', formKeys.length);
    
    if (formKeys.length > 0) {
        console.log('📋 Form data preview:', window.marksForm);
    } else {
        console.log('⚠️ No marks entered yet');
    }
} else {
    window.marksDebugResults.checks.formState = {
        exists: false,
        note: 'marksForm not available globally - may be component scoped'
    };
    console.log('❌ marksForm not available globally');
    console.log('   This may be normal if form state is component-scoped');
}

// Check 5: Network Monitoring Setup
console.log('\n🌐 CHECK 5: Network Monitoring');
if (window.fetch) {
    console.log('✅ Fetch API available');
    
    // Set up network monitoring
    if (!window.originalFetch) {
        window.originalFetch = window.fetch;
        let requestCount = 0;
        
        window.fetch = function(...args) {
            requestCount++;
            const [url, options] = args;
            
            console.log(`🌐 API Call #${requestCount}:`, {
                url: typeof url === 'string' ? url.substring(url.lastIndexOf('/') + 1) : 'URL object',
                method: options?.method || 'GET',
                timestamp: new Date().toISOString()
            });
            
            return window.originalFetch.apply(this, args)
                .then(response => {
                    console.log(`🌐 Response #${requestCount}:`, {
                        status: response.status,
                        ok: response.ok,
                        statusText: response.statusText
                    });
                    return response;
                })
                .catch(error => {
                    console.error(`🌐 Error #${requestCount}:`, error.message);
                    throw error;
                });
        };
        
        console.log('✅ Network monitoring activated');
        window.marksDebugResults.checks.networkMonitoring = true;
    } else {
        console.log('✅ Network monitoring already active');
    }
} else {
    console.log('❌ Fetch API not available');
    window.marksDebugResults.checks.networkMonitoring = false;
}

// Check 6: Error Detection
console.log('\n🚨 CHECK 6: Error Detection');
const originalError = console.error;
let errorCount = 0;

console.error = function(...args) {
    errorCount++;
    console.log(`🚨 Error #${errorCount} detected:`, args[0]);
    return originalError.apply(console, args);
};

window.marksDebugResults.checks.errorMonitoring = true;
console.log('✅ Error monitoring activated');

// Check 7: Local Storage & Session
console.log('\n💾 CHECK 7: Storage');
try {
    const testKey = 'marksDebugTest';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    
    window.marksDebugResults.checks.storage = {
        localStorage: true,
        sessionStorage: typeof sessionStorage !== 'undefined'
    };
    
    console.log('✅ localStorage available');
    console.log('✅ sessionStorage available');
} catch (e) {
    window.marksDebugResults.checks.storage = {
        localStorage: false,
        error: e.message
    };
    console.log('❌ Storage issue:', e.message);
}

// Helper Functions for Manual Testing
console.log('\n🔧 HELPER FUNCTIONS AVAILABLE:');

// Test form state
window.testFormState = function() {
    console.log('\n📊 TESTING FORM STATE...');
    
    if (typeof window.marksForm !== 'undefined') {
        const keys = Object.keys(window.marksForm);
        console.log('✅ Form keys:', keys);
        console.log('📊 Form data:', window.marksForm);
        
        let totalMarks = 0;
        keys.forEach(studentId => {
            const studentMarks = window.marksForm[studentId];
            if (studentMarks && typeof studentMarks === 'object') {
                Object.values(studentMarks).forEach(mark => {
                    if (mark && mark.trim() !== '') {
                        totalMarks++;
                    }
                });
            }
        });
        
        console.log('📊 Total marks entered:', totalMarks);
        return { studentCount: keys.length, totalMarks };
    } else {
        console.log('❌ marksForm not available');
        return null;
    }
};

// Test save function
window.testSaveFunction = function() {
    console.log('\n🚀 TESTING SAVE FUNCTION...');
    
    if (typeof handleBulkSaveMarks === 'function') {
        console.log('✅ handleBulkSaveMarks is available');
        console.log('⚠️ Calling function...');
        handleBulkSaveMarks();
        return true;
    } else {
        console.log('❌ handleBulkSaveMarks not available globally');
        console.log('💡 Try calling it from within the component context');
        return false;
    }
};

// Test network activity
window.testNetworkActivity = function() {
    console.log('\n🌐 TESTING NETWORK ACTIVITY...');
    console.log('Making test API call...');
    
    fetch('/api/test')
        .then(response => console.log('Test response:', response.status))
        .catch(error => console.log('Test error (expected):', error.message));
};

// Generate diagnostic report
window.generateDiagnosticReport = function() {
    console.log('\n📋 DIAGNOSTIC REPORT');
    console.log('═══════════════════');
    console.log(JSON.stringify(window.marksDebugResults, null, 2));
    
    // Copy to clipboard if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(JSON.stringify(window.marksDebugResults, null, 2))
            .then(() => console.log('✅ Report copied to clipboard'))
            .catch(() => console.log('❌ Could not copy to clipboard'));
    }
    
    return window.marksDebugResults;
};

// Instructions
console.log('\n📋 USAGE INSTRUCTIONS:');
console.log('1. Review the checks above for any ❌ errors');
console.log('2. Navigate to Admin → Exams and Marks → Enter Marks');
console.log('3. Enter some marks in the form');
console.log('4. Run: testFormState() - to check if marks are captured');
console.log('5. Run: testSaveFunction() - to test save functionality');
console.log('6. Click "Save Changes" and watch for network activity');
console.log('7. Run: generateDiagnosticReport() - to get full report');

console.log('\n✅ Diagnostic setup complete! Use the helper functions above.');
