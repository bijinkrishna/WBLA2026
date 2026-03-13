#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const versionPath = path.join(__dirname, '..', 'VERSION');
const pkgPath = path.join(__dirname, '..', 'package.json');

const version = fs.readFileSync(versionPath, 'utf8').trim();
const parts = version.split('.').map(Number);
parts[2] = (parts[2] || 0) + 1;
const newVersion = parts.join('.');

fs.writeFileSync(versionPath, newVersion + '\n');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`Bumped version: ${version} → ${newVersion}`);
