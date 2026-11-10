// Loads the browser scripts into node for testing.
const fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
for (const f of ['data.js', 'core.js', 'editor.js', 'forge.js', 'stats.js', 'presets.js', 'legit.js']) {
  const p = path.join(__dirname, '..', 'js', f);
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
}
module.exports = global.BL3;
