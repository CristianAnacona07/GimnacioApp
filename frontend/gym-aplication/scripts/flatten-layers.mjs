import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import postcss from 'postcss';
import cascadeLayers from '@csstools/postcss-cascade-layers';

const distDir = 'dist/frontend/browser';

let files;
try {
  files = readdirSync(distDir).filter(f => f.endsWith('.css'));
} catch {
  console.error('dist not found — run ng build first');
  process.exit(1);
}

for (const file of files) {
  const filePath = join(distDir, file);
  const css = readFileSync(filePath, 'utf8');
  const result = await postcss([cascadeLayers()]).process(css, { from: filePath });
  writeFileSync(filePath, result.css);
  console.log(`✓ Layers flattened: ${file}`);
}
