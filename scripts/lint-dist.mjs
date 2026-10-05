import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function walk(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) walk(path);
    else if (/groucho/i.test(readFileSync(path).toString('latin1')))
      throw Error(`Banned artist reference: ${path}`);
  }
}
walk('dist');
console.log('Built-copy audit: PASS.');
