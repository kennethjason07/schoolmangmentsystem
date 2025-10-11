// Test script to verify the delete button fix in web version
// Run this in the browser console after loading the Recent Payments tab

console.log("🧪 Testing Web Delete Button Fix");

// Function to test if delete buttons are properly rendered
function testDeleteButtonsRendering() {
  console.log("\n=== Testing Delete Button Rendering ===");
  
  // Look for Pressable elements with delete functionality (web-specific)
  const pressableDeleteButtons = Array.from(document.querySelectorAll('[role="button"]')).filter(el => {
    const label = el.getAttribute('aria-label') || el.getAttribute('accessibilityLabel');
    return label && label.includes('Delete payment');
  });
  
  // Look for any trash icons
  const trashIcons = Array.from(document.querySelectorAll('*')).filter(el => {
    const content = el.textContent || '';
    const name = el.getAttribute('name') || '';
    return content.includes('trash') || name === 'trash';
  });
  
  console.log("🎯 Pressable delete buttons found:", pressableDeleteButtons.length);
  console.log("🗑️ Trash icons found:", trashIcons.length);
  
  if (pressableDeleteButtons.length > 0) {
    console.log("✅ Delete buttons are properly rendered");
    
    // Test if buttons are clickable
    pressableDeleteButtons.forEach((btn, index) => {
      const style = window.getComputedStyle(btn);
      console.log(`Button ${index + 1}:`, {
        visible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
        cursor: style.cursor,
        zIndex: style.zIndex,
        position: style.position
      });
    });
    
    return true;
  } else {
    console.log("❌ No delete buttons found");
    return false;
  }
}

// Function to test debug information
function testDebugInfo() {
  console.log("\n=== Testing Debug Information ===");
  
  const debugElements = Array.from(document.querySelectorAll('*')).filter(el => 
    el.textContent && el.textContent.includes('Loaded:') && el.textContent.includes('payments')
  );
  
  if (debugElements.length > 0) {
    console.log("✅ Debug info found:", debugElements[0].textContent);
    return true;
  } else {
    console.log("❌ Debug info not found - might not be on web platform");
    return false;
  }
}

// Function to test if payments are loaded
function testPaymentsData() {
  console.log("\n=== Testing Payments Data ===");
  
  const paymentElements = Array.from(document.querySelectorAll('*')).filter(el => 
    el.textContent && (
      el.textContent.includes('₹') ||
      el.textContent.includes('Unknown Student') ||
      el.textContent.includes('Unknown Fee')
    )
  );
  
  console.log("💳 Payment-related elements found:", paymentElements.length);
  
  if (paymentElements.length > 0) {
    console.log("✅ Payments data is loaded");
    return true;
  } else {
    console.log("⚠️ No payments data found - check if Recent Payments tab is active");
    return false;
  }
}

// Function to simulate a delete button click
function simulateDeleteClick() {
  console.log("\n=== Simulating Delete Button Click ===");
  
  const deleteButtons = Array.from(document.querySelectorAll('[role="button"]')).filter(el => {
    const label = el.getAttribute('aria-label') || el.getAttribute('accessibilityLabel');
    return label && label.includes('Delete payment');
  });
  
  if (deleteButtons.length > 0) {
    const firstButton = deleteButtons[0];
    console.log("🖱️ Clicking first delete button...");
    
    // Create and dispatch a click event
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    firstButton.dispatchEvent(clickEvent);
    console.log("✅ Click event dispatched");
    
    // Check for confirmation dialog
    setTimeout(() => {
      if (document.querySelector('[role="dialog"]') || window.confirm.toString().includes('[native code]')) {
        console.log("✅ Confirmation dialog should appear");
      } else {
        console.log("⚠️ No confirmation dialog detected");
      }
    }, 100);
    
    return true;
  } else {
    console.log("❌ No delete buttons available to test");
    return false;
  }
}

// Function to check console logs for delete functionality
function checkDeleteLogs() {
  console.log("\n=== Checking Console Logs ===");
  console.log("👀 Watch for these logs when clicking delete buttons:");
  console.log("- '🗑️ Delete button clicked for payment: [ID]'");
  console.log("- '🚀 handleDeletePayment called with: [object]'");
  console.log("- '🖱️ Hovering over delete button' (on hover)");
  console.log("- Database operations logs");
}

// Main test function
function runDeleteButtonTests() {
  console.log("🧪 Starting Delete Button Fix Tests...\n");
  
  const results = {
    buttonsRendered: testDeleteButtonsRendering(),
    debugInfoVisible: testDebugInfo(),
    paymentsLoaded: testPaymentsData(),
  };
  
  console.log("\n=== Test Results Summary ===");
  console.log("Buttons Rendered:", results.buttonsRendered ? "✅ PASS" : "❌ FAIL");
  console.log("Debug Info Visible:", results.debugInfoVisible ? "✅ PASS" : "❌ FAIL");
  console.log("Payments Loaded:", results.paymentsLoaded ? "✅ PASS" : "❌ FAIL");
  
  checkDeleteLogs();
  
  console.log("\n=== Interactive Tests ===");
  console.log("🖱️ Try hovering over a delete button - you should see hover logs");
  console.log("🖱️ Try clicking a delete button - you should see click logs");
  
  // Offer to simulate a click
  if (results.buttonsRendered) {
    console.log("\n💡 Run simulateDeleteClick() to test a delete button click");
  }
  
  return results;
}

// Run tests automatically
runDeleteButtonTests();

// Export functions for manual testing
window.testDeleteButtons = {
  runAll: runDeleteButtonTests,
  simulate: simulateDeleteClick,
  renderTest: testDeleteButtonsRendering,
  debugTest: testDebugInfo,
  dataTest: testPaymentsData
};

console.log("🛠️ Test functions available as window.testDeleteButtons");