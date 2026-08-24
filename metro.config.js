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

// Audio lives in Cloudflare R2 + on-device cache, never in the JS bundle.
const audioBlock = /[\\/]assets[\\/]audio[\\/].*\.mp3$/;
const previousBlockList = config.resolver.blockList;
const previousList = !previousBlockList
  ? []
  : Array.isArray(previousBlockList)
    ? previousBlockList
    : [previousBlockList];
config.resolver.blockList = [...previousList, audioBlock];

module.exports = config;
