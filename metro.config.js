const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable dynamic import support for Supabase and other libraries
config.transformer.unstable_allowRequireContext = true;
config.transformer.asyncRequireModulePath = require.resolve(
  'metro-runtime/src/modules/asyncRequire'
);

// Add resolver configuration for Node.js polyfills
config.resolver.alias = {
  stream: 'readable-stream',
  buffer: '@craftzdog/react-native-buffer',
  'buffer/': '@craftzdog/react-native-buffer',
  '@expo/metro-config/build/async-require': require.resolve('metro-runtime/src/modules/asyncRequire'),
};

// Add platforms in correct order (web first for optimization)
config.resolver.platforms = ['web', 'ios', 'android', 'native'];

// Web-specific optimizations
if (process.env.EXPO_PLATFORM === 'web') {
  // Enable more aggressive minification for web
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      mangle: {
        keep_fnames: false, // Mangle function names for smaller bundle
      },
      output: {
        ascii_only: true, // ASCII only for better compression
        quote_keys: false, // Don't quote object keys when not necessary
        wrap_iife: false, // Don't wrap immediately invoked function expressions
      },
      sourceMap: false, // Disable source maps for production builds
    },
  };

  // Enable tree shaking and dead code elimination
  config.transformer.getTransformOptions = async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true, // Inline requires for better bundling
    },
  });
}

// Enable persistent caching for faster subsequent builds
config.cacheVersion = '1.0';

// Asset optimization for web
if (process.env.EXPO_PLATFORM === 'web') {
  config.resolver.assetExts = config.resolver.assetExts.filter(ext => 
    ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(ext)
  );
  
  // Add image optimization
  config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles'];
}

module.exports = config;
