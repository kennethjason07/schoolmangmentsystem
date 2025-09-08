// Ultra-minimal polyfills for web - absolute essentials only
console.log('🚀 Loading minimal polyfills...');

// Only essential polyfills for initial load
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Defer all other polyfills until after initial render
const deferredPolyfills = [];

// Queue polyfill loading functions
const queuePolyfill = (name, loadFn) => {
  deferredPolyfills.push({ name, loadFn });
};

// Essential base64 only if needed
if (typeof window !== 'undefined' && typeof btoa === 'undefined') {
  queuePolyfill('base64', async () => {
    const { encode, decode } = await import('base-64');
    global.btoa = encode;
    global.atob = decode;
  });
}

// Buffer only if crypto operations are needed
queuePolyfill('buffer', async () => {
  if (typeof global.Buffer === 'undefined') {
    const { Buffer } = await import('@craftzdog/react-native-buffer');
    global.Buffer = Buffer;
  }
});

// Process polyfill
queuePolyfill('process', async () => {
  if (typeof global.process === 'undefined') {
    const process = await import('process');
    global.process = process;
  }
});

// Load deferred polyfills after initial render
setTimeout(async () => {
  console.log('📦 Loading deferred polyfills...');
  const startTime = Date.now();
  
  try {
    await Promise.all(
      deferredPolyfills.map(({ name, loadFn }) => 
        loadFn().catch(err => 
          console.warn(`Failed to load ${name} polyfill:`, err)
        )
      )
    );
    
    const loadTime = Date.now() - startTime;
    console.log(`✅ Deferred polyfills loaded in ${loadTime}ms`);
  } catch (error) {
    console.warn('Some polyfills failed to load:', error);
  }
}, 100); // Load after initial render

console.log('✅ Minimal polyfills ready');
