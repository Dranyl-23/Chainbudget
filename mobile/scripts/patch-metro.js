const fs = require('fs');
const path = require('path');

const nodeModulesDir = path.resolve(__dirname, '..', 'node_modules');
const metroDir = path.join(nodeModulesDir, 'metro');

// 1. Remove 'exports' from all metro package.json files for universal CommonJS resolution in Node 25
if (fs.existsSync(nodeModulesDir)) {
  const dirs = fs.readdirSync(nodeModulesDir);
  for (const dir of dirs) {
    if (dir.startsWith('metro')) {
      const pkgPath = path.join(nodeModulesDir, dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.exports) {
            delete pkg.exports;
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
            console.log('Removed exports from:', dir);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}

// 2. Create physical private/lib/TerminalReporter proxy so metro-config requires resolve without exports field
if (fs.existsSync(metroDir)) {
  const privateLibDir = path.join(metroDir, 'private', 'lib');
  fs.mkdirSync(privateLibDir, { recursive: true });
  const terminalReporterProxy = path.join(privateLibDir, 'TerminalReporter.js');
  fs.writeFileSync(
    terminalReporterProxy,
    "module.exports = require('../../src/lib/TerminalReporter');\n",
    'utf8'
  );
  console.log('Created TerminalReporter proxy in metro/private/lib');
}

console.log('✨ All Metro modules patched successfully for Node 25!');
