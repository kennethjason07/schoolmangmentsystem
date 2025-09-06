// IMPORTANT: Polyfills must be imported first!
import { Platform } from 'react-native';

// Use optimized polyfills for web, standard for mobile
if (Platform.OS === 'web') {
  // Web environment - use optimized polyfills
  require('./polyfills.web');
} else {
  // Mobile environment - use standard polyfills
  require('./polyfills');
}

import { registerRootComponent } from 'expo';
// Use optimized App for better performance
import App from './App.optimized';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
