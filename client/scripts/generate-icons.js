#!/usr/bin/env node
/**
 * Run this script once to generate PNG icons from the SVG:
 *   cd client && node scripts/generate-icons.js
 *
 * Requires: npm install sharp --save-dev  (in client directory)
 * Or use an online converter: https://convertio.co/svg-png/
 */

const fs   = require('fs');
const path = require('path');

async function generate() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('sharp not installed. To generate PNG icons:');
    console.log('  cd client && npm install sharp --save-dev');
    console.log('  node scripts/generate-icons.js');
    console.log('');
    console.log('Or convert public/icons/icon.svg to PNG manually at:');
    console.log('  https://convertio.co/svg-png/');
    console.log('  Save as: public/icons/icon-192.png (192×192)');
    console.log('            public/icons/icon-512.png (512×512)');
    return;
  }

  const svgPath = path.join(__dirname, '../public/icons/icon.svg');
  const svg     = fs.readFileSync(svgPath);

  for (const size of [192, 512]) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, `../public/icons/icon-${size}.png`));
    console.log(`✅ Generated icon-${size}.png`);
  }
  console.log('Done!');
}

generate().catch(console.error);
