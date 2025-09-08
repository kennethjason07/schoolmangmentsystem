// Web-optimized polyfills - use synchronous loading to avoid 404 issues
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from '@craftzdog/react-native-buffer';
import process from 'process';
import { encode, decode } from 'base-64';

// Set up global polyfills synchronously
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

if (typeof global.process === 'undefined') {
  global.process = process;
}

if (typeof global.btoa === 'undefined') {
  global.btoa = encode;
}

if (typeof global.atob === 'undefined') {
  global.atob = decode;
}

console.log('✅ Optimized polyfills loaded');
