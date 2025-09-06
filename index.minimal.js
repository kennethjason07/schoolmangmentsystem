// Ultra-minimal index for fastest web performance
import { Platform } from 'react-native';

// Use ultra-minimal polyfills for web
if (Platform.OS === 'web') {
  console.log('🌐 Using ultra-minimal web configuration');
  require('./polyfills.minimal');
} else {
  console.log('📱 Using standard mobile configuration');
  require('./polyfills');
}

import { registerRootComponent } from 'expo';
import App from './App.minimal';

console.log('🚀 Registering ultra-minimal app...');
registerRootComponent(App);
