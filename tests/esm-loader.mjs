import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const srcDir = `${path.sep}src${path.sep}`;

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.js')) {
    const filePath = fileURLToPath(url);
    if (filePath.includes(srcDir) && !filePath.includes(`${path.sep}node_modules${path.sep}`)) {
      return {
        format: 'module',
        source: readFileSync(filePath, 'utf8'),
        shortCircuit: true,
      };
    }
  }
  return nextLoad(url, context);
}
