const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.js')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(__dirname);
let errors = 0;
files.forEach(file => {
  try {
    execSync(`node -c "${file}"`, { stdio: 'ignore' });
  } catch (err) {
    console.error('Syntax error in:', file);
    errors++;
  }
});

if (errors === 0) {
  console.log('✅ All files passed syntax check.');
} else {
  console.log(`❌ Found ${errors} syntax errors.`);
  process.exit(1);
}
