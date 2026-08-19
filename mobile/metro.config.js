const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable Package Exports for ethers v6 and socket.io compatibility
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native', 'default'];
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
