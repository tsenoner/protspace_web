import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['app/src', 'packages'];
const ALLOWED_TOAST_FILE = path.join('app', 'src', 'lib', 'notify.ts');
const SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORED_PATH_SEGMENTS = new Set(['node_modules', 'dist', 'build', '.turbo']);

type Violation = {
  file: string;
  message: string;
};

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (IGNORED_PATH_SEGMENTS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (!SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function formatViolation(file: string, message: string): Violation {
  return {
    file: path.relative(ROOT, file),
    message,
  };
}

async function collectViolations(file: string): Promise<Violation[]> {
  const source = await readFile(file, 'utf8');
  const relativePath = path.relative(ROOT, file);
  const violations: Violation[] = [];

  if (/\balert\s*\(/.test(source)) {
    violations.push(
      formatViolation(file, 'Use notify.ts or component-owned UI instead of alert().'),
    );
  }

  if (
    /\bshowNotification\b/.test(source) ||
    /\bcreateSelectionDisabledEvent\b/.test(source) ||
    /notification-utils/.test(source)
  ) {
    violations.push(
      formatViolation(file, 'Legacy notification helpers from @protspace/utils are not allowed.'),
    );
  }

  if (relativePath.startsWith(path.join('app', 'src')) && relativePath !== ALLOWED_TOAST_FILE) {
    if (/\btoast\./.test(source)) {
      violations.push(
        formatViolation(file, 'Route transient app notifications through app/src/lib/notify.ts.'),
      );
    }
  }

  return violations;
}

async function main() {
  const files = (
    await Promise.all(SCAN_ROOTS.map((scanRoot) => walk(path.join(ROOT, scanRoot))))
  ).flat();
  const violations = (await Promise.all(files.map((file) => collectViolations(file)))).flat();

  if (violations.length === 0) {
    console.log('Messaging guardrails passed.');
    return;
  }

  console.error('Messaging guardrail violations found:\n');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.message}`);
  }
  process.exit(1);
}

void main();
