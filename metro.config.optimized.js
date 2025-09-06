const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for Node.js polyfills
config.resolver.alias = {
  stream: 'readable-stream',
  buffer: '@craftzdog/react-native-buffer',
  'buffer/': '@craftzdog/react-native-buffer',
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
config.cacheStores = [
  {
    store: require('metro-cache/src/stores/FileStore'),
    options: {
      cacheDirectory: require('path').join(__dirname, '.metro-cache'),
      maxSize: 500 * 1024 * 1024, // 500 MB cache
    },
  },
];

// Improve bundle splitting
config.serializer = {
  ...config.serializer,
  customSerializer: undefined, // Let metro handle serialization
  
  // Web-specific bundle splitting
  ...(process.env.EXPO_PLATFORM === 'web' && {
    // Create separate chunks for different parts of the app
    createModuleIdFactory: () => {
      const moduleIds = new Map();
      let nextId = 0;
      
      return (path) => {
        if (!moduleIds.has(path)) {
          moduleIds.set(path, nextId++);
        }
        return moduleIds.get(path);
      };
    },
    
    // Process modules for better optimization
    processModuleFilter: (modules) => {
      // Filter out unnecessary modules for initial load
      return modules.filter((module) => {
        const path = module.path;
        
        // Skip heavy dependencies on initial load
        if (path.includes('chart.js') || 
            path.includes('victory-native') ||
            path.includes('jspdf') ||
            path.includes('pdfmake')) {
          return false;
        }
        
        // Keep core dependencies
        return true;
      });
    },
  }),
};

// Asset optimization for web
if (process.env.EXPO_PLATFORM === 'web') {
  config.resolver.assetExts = config.resolver.assetExts.filter(ext => 
    ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(ext)
  );
  
  // Add image optimization
  config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles'];
}

module.exports = config;
