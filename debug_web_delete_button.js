// Debug script for web delete button issue in recent payments
// Run this in the browser console to help diagnose the problem

console.log("🔍 Starting Delete Button Debug for Web Version");

// Function to check if recent payments tab is active
function checkRecentPaymentsTab() {
  const recentTab = document.querySelector('[data-testid="recent-tab"]') || 
                   Array.from(document.querySelectorAll('*')).find(el => 
                     el.textContent && el.textContent.includes('Recent Payments'));
  
  console.log("📋 Recent Payments Tab:", recentTab ? "Found" : "Not Found");
  return recentTab;
}

// Function to check for payment items
function checkPaymentItems() {
  const paymentItems = Array.from(document.querySelectorAll('*')).filter(el => 
    el.style && (
      el.style.backgroundColor === 'rgb(255, 255, 255)' || 
      el.className && el.className.includes('paymentItem')
    )
  );
  
  console.log("💳 Payment Items found:", paymentItems.length);
  return paymentItems;
}

// Function to check for delete buttons
function checkDeleteButtons() {
  const deleteButtons = [];
  
  // Check for Ionicons trash icons
  const trashIcons = Array.from(document.querySelectorAll('*')).filter(el => 
    el.textContent && el.textContent.includes('trash') ||
    el.getAttribute && el.getAttribute('name') === 'trash'
  );
  
  // Check for TouchableOpacity elements with delete functionality
  const deleteElements = Array.from(document.querySelectorAll('*')).filter(el => 
    el.getAttribute && (
      el.getAttribute('accessibilityLabel') === 'Delete payment' ||
      el.getAttribute('aria-label') === 'Delete payment'
    )
  );
  
  console.log("🗑️ Trash Icons found:", trashIcons.length);
  console.log("🎯 Delete Elements found:", deleteElements.length);
  
  return { trashIcons, deleteElements };
}

// Function to check styles that might hide the buttons
function checkDeleteButtonStyles() {
  const suspiciousElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    return (
      (style.display === 'none') ||
      (style.visibility === 'hidden') ||
      (style.opacity === '0') ||
      (style.position === 'absolute' && (
        parseInt(style.left) < -1000 || 
        parseInt(style.top) < -1000
      ))
    );
  });
  
  console.log("👻 Hidden Elements that might be delete buttons:", 
    suspiciousElements.filter(el => 
      el.textContent && el.textContent.includes('trash') ||
      el.getAttribute && el.getAttribute('name') === 'trash'
    ).length
  );
}

// Function to check for console errors
function checkConsoleErrors() {
  console.log("🚨 Check browser console for any JavaScript errors");
  console.log("❗ Look for errors related to:");
  console.log("   - handleDeletePayment");
  console.log("   - tenantDatabase");
  console.log("   - React rendering");
  console.log("   - TouchableOpacity");
}

// Function to check if recent payments data is loaded
function checkPaymentsData() {
  // Look for payment amounts or student names that would indicate data is loaded
  const paymentData = Array.from(document.querySelectorAll('*')).filter(el => 
    el.textContent && (
      el.textContent.includes('₹') ||
      el.textContent.match(/\d+\.\d{2}/) ||
      el.textContent.includes('Payment')
    )
  );
  
  console.log("💰 Payment data elements found:", paymentData.length);
  if (paymentData.length > 0) {
    console.log("📊 Sample payment data:", paymentData.slice(0, 3).map(el => el.textContent));
  }
}

// Main debug function
function debugDeleteButton() {
  console.log("\n=== WEB DELETE BUTTON DIAGNOSTIC REPORT ===");
  
  checkRecentPaymentsTab();
  checkPaymentItems();
  checkDeleteButtons();
  checkDeleteButtonStyles();
  checkPaymentsData();
  checkConsoleErrors();
  
  console.log("\n=== RECOMMENDATIONS ===");
  console.log("1. Check if you're in the 'Recent Payments' tab");
  console.log("2. Ensure payment data is loaded (refresh if needed)");
  console.log("3. Look for any console errors");
  console.log("4. Check if buttons are hidden by CSS");
  console.log("5. Try right-clicking on payment items to inspect elements");
  
  console.log("\n=== NEXT STEPS ===");
  console.log("If buttons are missing, the issue might be:");
  console.log("- Data not loaded properly");
  console.log("- Rendering condition not met");
  console.log("- CSS hiding the buttons");
  console.log("- JavaScript error preventing render");
}

// Auto-run the diagnostic
debugDeleteButton();

// Export for manual use
window.debugDeleteButton = debugDeleteButton;
console.log("🛠️ Debug function available as window.debugDeleteButton()");