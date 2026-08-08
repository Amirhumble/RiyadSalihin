const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolve the @/ alias to the src/ directory.
// babel-preset-expo does not read jsconfig/tsconfig paths —
// aliases must be wired at the Metro resolver level.
const SRC_ROOT = path.resolve(__dirname, 'src');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    const filePath = path.join(SRC_ROOT, moduleName.slice(2));
    return context.resolveRequest(context, filePath, platform);
  }
  // Fall through to the default resolver for everything else.
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
