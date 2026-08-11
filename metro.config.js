const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Wire @/ → src/ (babel-preset-expo does not read jsconfig paths)
const SRC_ROOT = path.resolve(__dirname, 'src');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    const filePath = path.join(SRC_ROOT, moduleName.slice(2));
    return context.resolveRequest(context, filePath, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
