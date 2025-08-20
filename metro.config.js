const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add polyfills for Node.js modules
config.resolver.alias = {
  ...config.resolver.alias,
  crypto: 'react-native-crypto',
  stream: 'readable-stream',
  buffer: '@craftzdog/react-native-buffer',
};

// Ensure Node.js modules are resolved
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'buffer') {
    return {
      filePath: require.resolve('@craftzdog/react-native-buffer'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Add polyfills to the resolver
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Handle Node.js modules
config.resolver.nodeModulesPaths = [
  ...config.resolver.nodeModulesPaths,
  'node_modules',
];

module.exports = config;
