const appJson = require('./app.json');

module.exports = () => {
  const expoConfig = appJson.expo || {};

  return {
    ...expoConfig,
    extra: {
      ...(expoConfig.extra || {}),
      geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    },
  };
};
