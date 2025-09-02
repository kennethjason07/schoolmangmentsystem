// React Native polyfills for Node.js modules
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Buffer polyfill - this is the main one causing issues
import { Buffer } from '@craftzdog/react-native-buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Process polyfill
if (typeof global.process === 'undefined') {
  global.process = require('process');
}

// Base64 polyfills
if (typeof global.btoa === 'undefined') {
  global.btoa = require('base-64').encode;
}

if (typeof global.atob === 'undefined') {
  global.atob = require('base-64').decode;
}

console.log('✅ Polyfills loaded successfully');
