#!/usr/bin/env node
/* global __dirname */
/**
 * Theming progress check (BUILD_CONTRACT → Theming). Lists every source file that still reads the
 * static LIGHT palette (`colors`, `heroTints`, `tileTints`, `shadows` from '@/theme', or the
 * static `boxShadows`), with a count of `colors.*` uses, so screen converters know what's left.
 *
 *   npm run theme:check            # report (exit 0)
 *   npm run theme:check -- --strict  # exit 1 if anything is left (CI / "done" gate)
 *
 * Tests are skipped (they may compare against the light palette on purpose).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const STATIC_NAMES = ['colors', 'heroTints', 'tileTints', 'shadows'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Named imports of a module specifier, across multi-line import statements. */
function importedNames(source, specifiers) {
  const names = new Set();
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source))) {
    if (!specifiers.includes(m[2])) continue;
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
      if (name) names.add(name);
    }
  }
  return names;
}

const rows = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(path.join(__dirname, '..'), file).split(path.sep).join('/');
  if (rel.startsWith('src/theme/')) continue; // the palette's own definitions
  const source = fs.readFileSync(file, 'utf8');
  const fromTheme = importedNames(source, ['@/theme']);
  const fromMotion = importedNames(source, ['@/components/motion', '@/components/motion/color', './color']);
  const statics = STATIC_NAMES.filter((n) => fromTheme.has(n));
  if (fromMotion.has('boxShadows') && !rel.startsWith('src/components/motion/')) statics.push('boxShadows');
  if (statics.length === 0) continue;
  const uses = (source.match(/\bcolors\.[a-zA-Z]+/g) || []).length;
  rows.push({ rel, statics, uses });
}

rows.sort((a, b) => b.uses - a.uses || a.rel.localeCompare(b.rel));
if (rows.length === 0) {
  console.log('Theme check: every file reads colours from the runtime theme.');
  process.exit(0);
}
const total = rows.reduce((n, r) => n + r.uses, 0);
console.log(`Theme check: ${rows.length} file(s) still on the static light palette (${total} colors.* uses).\n`);
for (const r of rows) console.log(`  ${String(r.uses).padStart(4)}  ${r.rel}  [${r.statics.join(', ')}]`);
console.log('\nConvert with the recipe in docs/BUILD_CONTRACT.md → Theming, then add the folder to THEMED_FILES in eslint.config.js.');
if (process.argv.includes('--strict')) process.exit(1);
