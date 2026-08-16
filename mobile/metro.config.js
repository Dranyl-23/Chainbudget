const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable Package Exports for ethers v6 compatibility
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['require', 'import', 'react-native'];
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
