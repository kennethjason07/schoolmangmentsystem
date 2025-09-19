// 🚨 IMMEDIATE DEBUGGING SCRIPT FOR MARKS SAVE ISSUE
// Copy and paste this entire script into your browser console while on the marks page

console.log('🔧 INJECTING REAL-TIME DEBUGGING FOR MARKS SAVE...');

// Step 1: Check if enhanced components are loaded
console.log('\n📋 STEP 1: Checking component enhancements...');

if (typeof window.React !== 'undefined') {
    console.log('✅ React is available');
} else {
    console.log('❌ React not found in window object');
}

// Check for Platform detection
try {
    console.log('📱 Platform detection test...');
    // This will help us understand if Platform.OS is available
    console.log('🔍 navigator.userAgent:', navigator.userAgent);
    console.log('🔍 window.location:', window.location.href);
} catch (e) {
    console.log('❌ Error checking platform:', e.message);
}

// Step 2: Function to manually trigger save with debugging
window.debugMarksSave = function() {
    console.log('\n🚀 MANUAL MARKS SAVE TEST');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // Try to access React component state
    try {
        // Look for React components in the DOM
        const app = document.querySelector('#root') || document.querySelector('[data-reactroot]') || document.body;
        console.log('🔍 App container found:', !!app);
        
        // Try to find the save button
        const saveButton = document.querySelector('button');
        const saveButtons = document.querySelectorAll('button');
        console.log('🔍 Buttons found:', saveButtons.length);
        
        saveButtons.forEach((btn, index) => {
            console.log(`Button ${index + 1}:`, btn.textContent.trim());
        });
        
        // Look for Save Changes button specifically
        const saveChangesButton = Array.from(saveButtons).find(btn => 
            btn.textContent.includes('Save') || btn.textContent.includes('save')
        );
        
        if (saveChangesButton) {
            console.log('✅ Found Save button:', saveChangesButton.textContent);
            console.log('🎯 Attempting to click save button...');
            saveChangesButton.click();
            console.log('✅ Save button clicked programmatically');
        } else {
            console.log('❌ Save button not found');
        }
        
    } catch (error) {
        console.error('💥 Error in manual save test:', error);
    }
};

// Step 3: Function to check form state
window.debugFormState = function() {
    console.log('\n📊 FORM STATE DEBUG');
    
    // Look for input fields
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input');
    console.log('📝 Input fields found:', inputs.length);
    
    inputs.forEach((input, index) => {
        if (input.value && input.value.trim() !== '') {
            console.log(`Input ${index + 1}:`, {
                value: input.value,
                placeholder: input.placeholder,
                type: input.type
            });
        }
    });
    
    // Check if there's any data in inputs
    const hasData = Array.from(inputs).some(input => input.value && input.value.trim() !== '');
    console.log('📊 Form has data:', hasData);
    
    return { totalInputs: inputs.length, hasData };
};

// Step 4: Network monitoring
window.debugNetworkActivity = function() {
    console.log('\n🌐 NETWORK MONITORING SETUP');
    
    // Override fetch to monitor API calls
    const originalFetch = window.fetch;
    let apiCallCount = 0;
    
    window.fetch = function(...args) {
        apiCallCount++;
        console.log(`🔗 API Call ${apiCallCount}:`, args[0]);
        
        return originalFetch.apply(this, args)
            .then(response => {
                console.log(`✅ API Response ${apiCallCount}:`, {
                    url: args[0],
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                });
                return response;
            })
            .catch(error => {
                console.error(`❌ API Error ${apiCallCount}:`, {
                    url: args[0],
                    error: error.message
                });
                throw error;
            });
    };
    
    console.log('✅ Network monitoring activated');
};

// Step 5: Check for enhanced tenant system
window.debugTenantSystem = function() {
    console.log('\n🏢 TENANT SYSTEM DEBUG');
    
    // Check localStorage for tenant data
    try {
        const tenantData = localStorage.getItem('tenant') || localStorage.getItem('tenantId') || localStorage.getItem('currentTenant');
        console.log('📦 LocalStorage tenant data:', tenantData);
        
        // Check all localStorage keys
        const lsKeys = Object.keys(localStorage);
        console.log('🔑 All localStorage keys:', lsKeys);
        
        // Look for tenant-related keys
        const tenantKeys = lsKeys.filter(key => 
            key.toLowerCase().includes('tenant') || 
            key.toLowerCase().includes('user') ||
            key.toLowerCase().includes('auth')
        );
        console.log('🏢 Tenant-related keys:', tenantKeys);
        
        tenantKeys.forEach(key => {
            console.log(`  ${key}:`, localStorage.getItem(key));
        });
        
    } catch (error) {
        console.error('❌ Error checking tenant system:', error);
    }
};

// Step 6: All-in-one diagnostic
window.runFullDiagnostic = function() {
    console.log('\n🧪 RUNNING FULL DIAGNOSTIC...');
    console.log('================================================');
    
    debugFormState();
    debugTenantSystem();
    debugNetworkActivity();
    
    console.log('\n📋 READY FOR TESTING');
    console.log('1. Check form state: debugFormState()');
    console.log('2. Try manual save: debugMarksSave()');
    console.log('3. Network monitoring is now active');
    console.log('4. Click Save Changes button and watch console');
};

// Auto-run diagnostic
setTimeout(() => {
    runFullDiagnostic();
    
    console.log('\n🎯 TESTING INSTRUCTIONS:');
    console.log('1. Make sure marks are entered in the form');
    console.log('2. Type: debugFormState() to check form data');
    console.log('3. Type: debugMarksSave() to trigger save manually');
    console.log('4. Or click the Save Changes button and watch console');
    console.log('5. Check Network tab for any API requests');
    
}, 1000);

console.log('\n✅ DEBUGGING SCRIPT LOADED');
console.log('🔧 Available functions:');
console.log('  - debugFormState() - Check form data');
console.log('  - debugMarksSave() - Manual save test');
console.log('  - debugTenantSystem() - Check tenant context');
console.log('  - runFullDiagnostic() - Run all checks');

// Monitor clicks on any button
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        const button = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
        console.log('\n🖱️ BUTTON CLICKED:', button.textContent.trim());
        console.log('⏰ Click timestamp:', new Date().toISOString());
        
        if (button.textContent.includes('Save')) {
            console.log('🎯 SAVE BUTTON DETECTED - Monitoring for save process...');
        }
    }
}, true);
