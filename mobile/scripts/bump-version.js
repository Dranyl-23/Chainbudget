/**
 * bump-version.js
 *
 * Automated versioning script for ChainBudget Mobile.
 * Automatically updates:
 *  1. mobile/app.json (version, android.versionCode, ios.buildNumber)
 *  2. mobile/package.json (version)
 *
 * Usage:
 *  node scripts/bump-version.js [patch | minor | major]
 *  Default is 'patch'.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const appJsonPath = path.join(rootDir, 'app.json');
const packageJsonPath = path.join(rootDir, 'package.json');

// 1. Read files
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Current values
const currentVersion = appJson.expo.version || '1.0.0';
const currentVersionCode = appJson.expo.android?.versionCode || 1;
const currentBuildNumber = parseInt(appJson.expo.ios?.buildNumber || '1', 10);

// 2. Parse SemVer
const [major, minor, patch] = currentVersion.split('.').map(n => parseInt(n, 10));
const bumpType = (process.argv[2] || 'patch').toLowerCase();

let newMajor = major;
let newMinor = minor;
let newPatch = patch;

if (bumpType === 'major') {
  newMajor += 1;
  newMinor = 0;
  newPatch = 0;
} else if (bumpType === 'minor') {
  newMinor += 1;
  newPatch = 0;
} else {
  // patch (default)
  newPatch += 1;
}

const newVersion = `${newMajor}.${newMinor}.${newPatch}`;
const newVersionCode = currentVersionCode + 1;
const newBuildNumber = (currentBuildNumber + 1).toString();

console.log('════════════════════════════════════════════════════════════');
console.log('🚀  ChainBudget Mobile Version Increment');
console.log(`    Mode: ${bumpType.toUpperCase()}`);
console.log(`    Version:     ${currentVersion} ➔ ${newVersion}`);
console.log(`    VersionCode: ${currentVersionCode} ➔ ${newVersionCode}`);
console.log(`    BuildNumber: ${currentBuildNumber} ➔ ${newBuildNumber}`);
console.log('════════════════════════════════════════════════════════════');

// 3. Update app.json
appJson.expo.version = newVersion;
if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = newVersionCode;

if (!appJson.expo.ios) appJson.expo.ios = {};
appJson.expo.ios.buildNumber = newBuildNumber;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
console.log('✅ Updated app.json');

// 4. Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log('✅ Updated package.json');

console.log('✨ All configuration files synchronized dynamically!\n');
