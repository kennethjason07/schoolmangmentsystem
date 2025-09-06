// Web-optimized polyfills - only load what's needed for web
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Only load heavy polyfills if actually needed
const loadBufferPolyfill = () => {
  if (typeof global.Buffer === 'undefined') {
    import('@craftzdog/react-native-buffer').then(({ Buffer }) => {
      global.Buffer = Buffer;
    });
  }
};

const loadProcessPolyfill = () => {
  if (typeof global.process === 'undefined') {
    import('process').then((process) => {
      global.process = process;
    });
  }
};

// Load base64 polyfills only if needed
const loadBase64Polyfills = () => {
  if (typeof global.btoa === 'undefined') {
    import('base-64').then(({ encode, decode }) => {
      global.btoa = encode;
      global.atob = decode;
    });
  }
};

// Web-specific: Load polyfills asynchronously
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // We're on web, load polyfills as needed
  loadBase64Polyfills();
  
  // Only load heavy polyfills if crypto operations are needed
  if (document.location && document.location.search.includes('crypto=true')) {
    loadBufferPolyfill();
    loadProcessPolyfill();
  }
} else {
  // Mobile: Load all polyfills immediately (existing behavior)
  import('@craftzdog/react-native-buffer').then(({ Buffer }) => {
    if (typeof global.Buffer === 'undefined') {
      global.Buffer = Buffer;
    }
  });
  
  if (typeof global.process === 'undefined') {
    import('process').then((process) => {
      global.process = process;
    });
  }
  
  loadBase64Polyfills();
}

console.log('✅ Optimized polyfills loaded');
