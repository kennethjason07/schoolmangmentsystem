// Expo dynamic config to inject Azure Face API credentials at build time
// Do NOT hardcode secrets here. Values are read from environment variables.
// Usage (PowerShell):
//   setx EXPO_PUBLIC_AZURE_FACE_ENDPOINT https://maximus.cognitiveservices.azure.com
//   # Secure prompt for key (recommended): see previous instructions
//   # Or set for current shell only (less secure):
//   #   $Env:EXPO_PUBLIC_AZURE_FACE_KEY = '...'
// Then restart Expo with cache clear: `npx expo start -c`

module.exports = () => {
  const appJson = require('./app.json');

  const endpoint = process.env.EXPO_PUBLIC_AZURE_FACE_ENDPOINT
    || process.env.REACT_APP_AZURE_FACE_ENDPOINT
    || (appJson.expo?.extra?.azureFaceEndpoint ?? null);

  const key = process.env.EXPO_PUBLIC_AZURE_FACE_KEY
    || process.env.REACT_APP_AZURE_FACE_KEY
    || (appJson.expo?.extra?.azureFaceKey ?? null);

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      extra: {
        ...(appJson.expo?.extra || {}),
        // Injected at build time; FaceRecognitionService reads via Constants.expoConfig.extra
        azureFaceEndpoint: endpoint || null,
        azureFaceKey: key || null,
      },
    },
  };
};
