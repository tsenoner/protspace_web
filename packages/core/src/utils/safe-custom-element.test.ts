/**
 * Guards against the "name has already been used with this registry" error
 * we hit when the publish-modal lazy chunk re-runs Lit's @customElement on
 * a second open. Every Lit component in `src/components/` must import
 * `customElement` from this safe wrapper, not from `lit/decorators.js`,
 * so HMR and double-loaded chunks don't crash element registration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = resolve(HERE, '..', 'components');
const SAFE_IMPORT_RE = /from\s+['"][^'"]*\/utils\/safe-custom-element['"]/;

function walkSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSources(full, acc);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('safe-custom-element wrapper usage', () => {
  it('every @customElement-using component imports the safe wrapper', () => {
    const offenders: string[] = [];
    for (const file of walkSources(COMPONENTS_DIR)) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('@customElement(')) continue;
      if (!SAFE_IMPORT_RE.test(source)) {
        offenders.push(file.replace(COMPONENTS_DIR, 'components'));
      }
    }
    expect(
      offenders,
      `These files use @customElement but import customElement from lit/decorators directly. ` +
        `Switch them to '../../utils/safe-custom-element' so HMR and double-loaded chunks don't ` +
        `throw "name has already been used with this registry":\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
