const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for Node.js polyfills
config.resolver.alias = {
  stream: 'readable-stream',
  buffer: '@craftzdog/react-native-buffer',
  'buffer/': '@craftzdog/react-native-buffer',
};

// Add global polyfills
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;
