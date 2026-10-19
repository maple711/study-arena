#!/usr/bin/env node
// Writes update.json for the self-updater: the version (from manifest.json) and every file a release ships.
//   node tools/build-release.js "short release notes"
// Run it from the plugin/repo root after changing files, then commit and push.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const list = (dir) => (fs.existsSync(path.join(ROOT, dir)) ? fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).sort().map((f) => `${dir}/${f}`) : []);
const files = ['manifest.json', 'main.js', 'styles.css', ...list('courses'), ...list('tools')].filter((f) => fs.existsSync(path.join(ROOT, f)));
const out = { version: manifest.version, notes: process.argv.slice(2).join(' ') || '', files };
fs.writeFileSync(path.join(ROOT, 'update.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`update.json: v${out.version}, ${files.length} files`);
