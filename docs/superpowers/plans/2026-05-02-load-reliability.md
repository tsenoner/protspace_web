# Load Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `sprot_50.parquetbundle` (573k proteins) load reliably in Chrome, and stop the crash-loop where a failed load auto-retries forever on every page reload.

**Architecture:** Two PRs shipped sequentially. PR-1 adds a `lastLoadStatus` field to OPFS metadata and gates auto-load behind it (recovery banner on `'pending'`/`'error'`). PR-2 cuts the dominant memory cost by switching strictly single-valued categorical columns from `number[][]` to `Int32Array`, drops a per-row spread merge, replaces `generateColors`/`generateShapes` with a pair-aware generator, and fixes a null-selection materialization bug.

**Tech Stack:** TypeScript, Lit web components, pnpm + Turbo monorepo, Vitest unit tests, Playwright browser tests, hyparquet, OPFS (Origin Private File System).

**Spec:** `docs/superpowers/specs/2026-05-02-load-reliability-design.md`

**Phase 3 (separate work):** [#239](https://github.com/tsenoner/protspace_web/issues/239) — Worker-based decode + lazy column materialization.

## Status (post-implementation, 2026-05-02)

| PR / Task                                                                             | Commit                   | Status                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| PR-1 ([#240](https://github.com/tsenoner/protspace_web/pull/240)) merged at `2297acf` | —                        | ✅ shipped                                                                                  |
| Task 1 — OPFS schema v2 + status APIs                                                 | `291b52b` + `fc502a3`    | ✅                                                                                          |
| Task 2 — status writes from dataset-controller                                        | `4c39f57`                | ✅                                                                                          |
| Task 3 — gate auto-load on status                                                     | `5c07fb5`                | ✅                                                                                          |
| Task 4 — recovery banner component                                                    | `31ca428`                | ✅                                                                                          |
| Task 5 — wire banner into runtime                                                     | `fa9158f`                | ✅                                                                                          |
| Task 6 — Playwright spec (recovery flow)                                              | `e272bbb`                | ✅                                                                                          |
| Task 7-10 — `AnnotationData` union + `Int32Array` storage                             | `5ff983d` + `72d62bc`    | ✅ on branch `fix/load-reliability-phase-2`                                                 |
| Task 11 — drop projection × annotation spread merge                                   | `55ced7d`                | ✅                                                                                          |
| Task 12 — pair-aware color/shape generator                                            | `387fffc`                | ✅                                                                                          |
| Task 13 — fix null-selection materialization gate                                     | `8f13292`                | ✅                                                                                          |
| Task 14 — Playwright spec for sprot_50 load                                           | _stashed at `stash@{0}`_ | ⏸ deferred until Phase 2.5 lands (manual + Playwright sprot_50 still OOMs at render layer) |
| PR-2 (Phase 2)                                                                        | _not opened_             | ⏸ blocked on Phase 2.5                                                                     |

**Discovery during Task 14:** Phase 2's wins fix the conversion layer; sprot_50 still OOMs in `DataProcessor.processVisualizationData` (render layer). See spec §11 for details. **Phase 2.5** carves out the render-layer fix as a separate brainstorm + spec + plan. PR-2 will not open until Phase 2.5 commits land on `fix/load-reliability-phase-2`.

**To resume Task 14 (after Phase 2.5 ships):**

```bash
git stash pop   # restores .gitignore + playwright config + spec
cp /Users/tsenoner/Documents/projects/protspace-suite/protspace/data/other/sprot/sprot_50.parquetbundle \
   app/tests/fixtures/   # 45 MB, gitignored
pnpm test:e2e -- load-large-bundle
```

---

## Conventions for every task

Each task ships as one commit with the Angular-style message format (`feat(scope):` / `fix(scope):` / `refactor(scope):` / `test(scope):` / `chore(scope):`); see `.claude/CLAUDE.md`. Subject ≤ 72 chars.

Before any commit, run `pnpm precommit` (format + lint + type-check + tests). The pre-commit hook will block the commit if any of those fail. Do not bypass with `--no-verify`.

For each task, the loop is: **write the failing test → run it (expect fail) → implement → run again (expect pass) → run full test suite for that package → commit**. For pure refactors (no behavior change), tests come _with_ the change and must continue to pass.

Do not edit `.parquetbundle` fixture files. They are binary; treat as read-only.

PR-1 (Phase 1) and PR-2 (Phase 2) are separate branches off `main`. Do not interleave commits between them.

---

## File structure

### Files created

| Path                                                              | Phase | Responsibility                                                                                                    |
| ----------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `app/src/explore/recovery-banner.ts`                              | 1     | Sticky banner component with Try again / Load default / Clear actions, mounted from `runtime.ts`.                 |
| `app/tests/dataset-recovery.spec.ts`                              | 1     | Playwright spec: simulated `'pending'` / `'error'` OPFS state surfaces banner; success state auto-loads silently. |
| `packages/utils/src/visualization/annotation-data-access.ts`      | 2     | Accessors over the `Int32Array                                                                                    | number[][]` union (`getProteinAnnotationIndices`, `getProteinAnnotationCount`, `getFirstAnnotationIndex`). |
| `packages/utils/src/visualization/annotation-data-access.test.ts` | 2     | Unit tests for accessor invariants across both storage shapes.                                                    |
| `app/tests/load-large-bundle.spec.ts`                             | 2     | Playwright spec: load `sprot_50.parquetbundle`, assert non-empty legend + scatter renders, switch annotations.    |

### Files modified

| Path                                                                        | Phase | Reason                                                                                                                                                        |
| --------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/src/explore/opfs-dataset-store.ts`                                     | 1     | Bump `SCHEMA_VERSION` → 2; add `lastLoadStatus`/`lastError`/`failedAttempts` fields; add `markLastLoadStatus` + `readLastLoadStatus` APIs; v1 → v2 migration. |
| `app/src/explore/opfs-dataset-store.test.ts`                                | 1     | Cover new APIs + migration.                                                                                                                                   |
| `app/src/explore/dataset-controller.ts`                                     | 1     | `'pending'` mark on load start, `'success'` on `data-loaded`, `'error'` on `data-error`.                                                                      |
| `app/src/explore/persisted-dataset.ts`                                      | 1     | Branch `loadPersistedOrDefaultDataset` on status; expose `tryLoadPersistedAgain`.                                                                             |
| `app/src/explore/runtime.ts`                                                | 1     | Mount recovery banner.                                                                                                                                        |
| `app/src/explore/notifications.ts`                                          | 1     | Recovery banner copy strings.                                                                                                                                 |
| `packages/utils/src/types.ts`                                               | 2     | Introduce `AnnotationData = Int32Array \| (readonly number[])[]` and re-export.                                                                               |
| `packages/utils/src/index.ts`                                               | 2     | Re-export accessor module.                                                                                                                                    |
| `packages/core/src/components/data-loader/utils/conversion.ts`              | 2     | Track `maxValuesPerProtein`; emit `Int32Array` for strict single-valued columns; replace `generateColors`/`generateShapes` with `generateColorsAndShapes`.    |
| `packages/core/src/components/data-loader/utils/conversion-numeric.test.ts` | 2     | Cover dual-storage outputs.                                                                                                                                   |
| `packages/core/src/components/data-loader/utils/bundle.ts`                  | 2     | Drop per-row `{...projection, ...annotation}` spread; return `RowSource` shape.                                                                               |
| `packages/core/src/components/data-loader/utils/bundle.test.ts`             | 2     | Adjust expectations to new shape.                                                                                                                             |
| `packages/core/src/components/legend/legend-data-processor.ts`              | 2     | Read indices via accessor; use `colors[i % colors.length]` / `shapes[i % shapes.length]`.                                                                     |
| `packages/core/src/components/legend/legend.ts`                             | 2     | Accessor + modular indexing.                                                                                                                                  |
| `packages/core/src/components/scatter-plot/*` (color pipeline)              | 2     | Accessor + modular indexing on the per-point hot path.                                                                                                        |
| `packages/utils/src/visualization/export-utils.ts`                          | 2     | Accessor + modular indexing.                                                                                                                                  |
| `packages/utils/src/visualization/numeric-binning.ts`                       | 2     | Fix null-selection gate at line 779.                                                                                                                          |
| `packages/utils/src/visualization/numeric-binning.test.ts`                  | 2     | Add coverage for null-selection no-op.                                                                                                                        |

---

# PR-1: Phase 1 — Crash-loop guard

Branch off `main`: `git checkout -b fix/load-reliability-phase-1`.

### Task 1: Extend OPFS metadata schema + status APIs

**Files:**

- Modify: `app/src/explore/opfs-dataset-store.ts`
- Modify: `app/src/explore/opfs-dataset-store.test.ts`

The existing `StoredDatasetMetadata` (lines 6–13) is `schemaVersion=1` with `name / type / size / lastModified / storedAt`. We bump to `schemaVersion=2` and add `lastLoadStatus` + `lastError?` + `failedAttempts?`.

The existing test file at `app/src/explore/opfs-dataset-store.test.ts` uses an in-memory mock root directory (see lines 51, 144, 166 — read it before adding tests).

- [ ] **Step 1: Read the existing test scaffolding to mirror its style**

Run: `cat app/src/explore/opfs-dataset-store.test.ts | head -120`

Note the in-memory mock pattern (`createMockStorage()` / `getDirectoryHandle`) — reuse it.

- [ ] **Step 2: Write the failing tests for new APIs**

Append to `app/src/explore/opfs-dataset-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveLastImportedFile,
  loadLastImportedFile,
  clearLastImportedFile,
  markLastLoadStatus,
  readLastLoadStatus,
} from './opfs-dataset-store';

// (Reuse the existing mock storage setup at the top of the file.)

describe('lastLoadStatus APIs', () => {
  it('returns null when no metadata is present', async () => {
    expect(await readLastLoadStatus()).toBeNull();
  });

  it('writes pending after save and reads it back', async () => {
    const file = new File(['x'], 'a.parquetbundle');
    await saveLastImportedFile(file);
    await markLastLoadStatus('pending');
    expect(await readLastLoadStatus()).toEqual({
      status: 'pending',
      lastError: undefined,
      failedAttempts: 1,
    });
  });

  it('increments failedAttempts on repeated pending without success', async () => {
    const file = new File(['x'], 'a.parquetbundle');
    await saveLastImportedFile(file);
    await markLastLoadStatus('pending');
    await markLastLoadStatus('pending');
    await markLastLoadStatus('pending');
    expect((await readLastLoadStatus())?.failedAttempts).toBe(3);
  });

  it('resets failedAttempts to 0 on success', async () => {
    const file = new File(['x'], 'a.parquetbundle');
    await saveLastImportedFile(file);
    await markLastLoadStatus('pending');
    await markLastLoadStatus('pending');
    await markLastLoadStatus('success');
    expect(await readLastLoadStatus()).toEqual({
      status: 'success',
      lastError: undefined,
      failedAttempts: 0,
    });
  });

  it('records lastError when status is error', async () => {
    const file = new File(['x'], 'a.parquetbundle');
    await saveLastImportedFile(file);
    await markLastLoadStatus('error', { error: 'boom' });
    expect(await readLastLoadStatus()).toEqual({
      status: 'error',
      lastError: 'boom',
      failedAttempts: 1,
    });
  });

  it('migrates schemaVersion=1 metadata to success on read', async () => {
    // Write legacy v1 metadata directly (bypassing the new save path).
    const file = new File(['x'], 'a.parquetbundle');
    await saveLastImportedFile(file);
    // Force overwrite metadata.json with a v1 payload.
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('protspace-last-import');
    const handle = await dir.getFileHandle('metadata.json');
    const writable = await handle.createWritable();
    await writable.write(
      JSON.stringify({
        schemaVersion: 1,
        name: 'a.parquetbundle',
        type: '',
        size: 1,
        lastModified: 0,
        storedAt: '2025-01-01T00:00:00.000Z',
      }),
    );
    await writable.close();

    // First read should see status=success (silent migration).
    const status = await readLastLoadStatus();
    expect(status?.status).toBe('success');
    expect(status?.failedAttempts).toBe(0);
  });

  it('clears status when clearLastImportedFile is called', async () => {
    const file = new File(['x'], 'a.parquetbundle');
    await saveLastImportedFile(file);
    await markLastLoadStatus('pending');
    await clearLastImportedFile();
    expect(await readLastLoadStatus()).toBeNull();
  });
});
```

- [ ] **Step 3: Run the new tests to confirm they fail**

Run: `pnpm --filter @protspace/app test:ci -- opfs-dataset-store`
Expected: FAIL — `markLastLoadStatus` / `readLastLoadStatus` not exported.

- [ ] **Step 4: Implement the schema bump and APIs**

In `app/src/explore/opfs-dataset-store.ts`:

```ts
const STORE_DIRECTORY_NAME = 'protspace-last-import';
const DATA_FILENAME = 'dataset.bin';
const METADATA_FILENAME = 'metadata.json';
const SCHEMA_VERSION = 2;

export type LastLoadStatus = 'pending' | 'success' | 'error';

interface StoredDatasetMetadata {
  schemaVersion: number;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  storedAt: string;
  lastLoadStatus: LastLoadStatus;
  lastError?: string;
  failedAttempts: number;
}

function isValidMetadata(value: unknown): value is StoredDatasetMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  if (typeof m.name !== 'string') return false;
  if (typeof m.type !== 'string') return false;
  if (typeof m.size !== 'number') return false;
  if (typeof m.lastModified !== 'number') return false;
  if (typeof m.storedAt !== 'string') return false;
  // schemaVersion 1 is legacy and accepted (migrated on read).
  if (m.schemaVersion !== 1 && m.schemaVersion !== 2) return false;
  return true;
}

function migrateMetadata(raw: Record<string, unknown>): StoredDatasetMetadata {
  if (raw.schemaVersion === 2) {
    return {
      schemaVersion: 2,
      name: String(raw.name),
      type: String(raw.type),
      size: Number(raw.size),
      lastModified: Number(raw.lastModified),
      storedAt: String(raw.storedAt),
      lastLoadStatus:
        raw.lastLoadStatus === 'pending' ||
        raw.lastLoadStatus === 'success' ||
        raw.lastLoadStatus === 'error'
          ? raw.lastLoadStatus
          : 'success',
      lastError: typeof raw.lastError === 'string' ? raw.lastError : undefined,
      failedAttempts:
        typeof raw.failedAttempts === 'number' && raw.failedAttempts >= 0 ? raw.failedAttempts : 0,
    };
  }
  // v1 → v2: silent migration. Anyone with v1 metadata loaded successfully under prior versions.
  return {
    schemaVersion: 2,
    name: String(raw.name),
    type: String(raw.type),
    size: Number(raw.size),
    lastModified: Number(raw.lastModified),
    storedAt: String(raw.storedAt),
    lastLoadStatus: 'success',
    failedAttempts: 0,
  };
}

async function readMetadata(): Promise<StoredDatasetMetadata | null> {
  const directory = await getStoreDirectory(false);
  if (!directory) return null;

  let metadataText: string;
  try {
    const handle = await directory.getFileHandle(METADATA_FILENAME);
    metadataText = await (await handle.getFile()).text();
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(metadataText);
  } catch {
    await clearStoreDirectory();
    throw new StoredDatasetCorruptError('Stored dataset metadata could not be parsed.');
  }

  if (!isValidMetadata(parsed)) {
    await clearStoreDirectory();
    throw new StoredDatasetCorruptError('Stored dataset metadata is invalid.');
  }

  return migrateMetadata(parsed as Record<string, unknown>);
}

async function writeMetadata(
  directory: FileSystemDirectoryHandle,
  metadata: StoredDatasetMetadata,
) {
  await writeTextFile(directory, METADATA_FILENAME, JSON.stringify(metadata));
}

export async function saveLastImportedFile(file: File): Promise<void> {
  if (!isSupported()) throw buildSupportError();
  const directory = await getStoreDirectory(true);
  if (!directory) throw new Error('Unable to access the Origin Private File System.');

  const metadata: StoredDatasetMetadata = {
    schemaVersion: SCHEMA_VERSION,
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    storedAt: new Date().toISOString(),
    lastLoadStatus: 'pending',
    failedAttempts: 0,
  };

  try {
    await writeBlobFile(directory, DATA_FILENAME, file);
    await writeMetadata(directory, metadata);
  } catch (error) {
    await clearStoreDirectory();
    throw error instanceof Error ? error : new Error('Failed to save imported dataset.');
  }
}

export async function markLastLoadStatus(
  status: LastLoadStatus,
  options?: { error?: string },
): Promise<void> {
  const directory = await getStoreDirectory(false);
  if (!directory) return;

  let current: StoredDatasetMetadata | null = null;
  try {
    current = await readMetadata();
  } catch {
    return;
  }
  if (!current) return;

  const next: StoredDatasetMetadata = {
    ...current,
    lastLoadStatus: status,
    lastError: status === 'error' ? options?.error : undefined,
    failedAttempts:
      status === 'success'
        ? 0
        : status === 'pending' || status === 'error'
          ? current.failedAttempts + 1
          : current.failedAttempts,
  };

  await writeMetadata(directory, next);
}

export async function readLastLoadStatus(): Promise<{
  status: LastLoadStatus;
  lastError?: string;
  failedAttempts: number;
} | null> {
  const metadata = await readMetadata();
  if (!metadata) return null;
  return {
    status: metadata.lastLoadStatus,
    lastError: metadata.lastError,
    failedAttempts: metadata.failedAttempts,
  };
}
```

Update `loadLastImportedFile` to use `readMetadata()` (it currently inlines the parse — replace with the helper) so the v1 → v2 migration is centralized.

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `pnpm --filter @protspace/app test:ci -- opfs-dataset-store`
Expected: PASS — all new tests + existing 4 tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/explore/opfs-dataset-store.ts app/src/explore/opfs-dataset-store.test.ts
git commit -m "$(cat <<'EOF'
feat(opfs): add lastLoadStatus + failedAttempts to dataset metadata

Bump schema to v2 with lastLoadStatus / lastError / failedAttempts.
Adds markLastLoadStatus + readLastLoadStatus APIs. v1 metadata is
silently migrated to status=success on first read.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write 'pending' / 'success' / 'error' from dataset-controller

**Files:**

- Modify: `app/src/explore/dataset-controller.ts`

The existing `handleDataLoaded` writes the file to OPFS at line 117 (`saveLastImportedFile(file)`); `saveLastImportedFile` now also writes status='pending'. We need to mark `'success'` once the load is fully finalized, and mark `'error'` from `handleDataError`.

For OPFS auto-loads (kind=`'opfs'`) the file isn't re-saved (no call to `saveLastImportedFile`), so we must explicitly mark `'pending'` at load start. The existing `persisted-dataset.ts:loadPersistedOrDefaultDataset` is where that should happen — handled in Task 3.

- [ ] **Step 1: Add 'success' write to handleDataLoaded**

In `app/src/explore/dataset-controller.ts`, find `handleDataLoaded` (line 86). At the very end of the `try` block (after `viewController.applyLatestViewForDatasetLoad(data)`, line 156), add:

```ts
try {
  if (loadMeta.kind === 'user' || loadMeta.kind === 'opfs') {
    await markLastLoadStatus('success');
  }
} catch (error) {
  console.warn('Failed to update OPFS load status to success:', error);
}
```

Update the import at line 16:

```ts
import { markLastLoadStatus, saveLastImportedFile } from './opfs-dataset-store';
```

- [ ] **Step 2: Add 'error' write to handleDataError**

In the same file, find `handleDataError` (line 166). At the start of the function, add:

```ts
try {
  const message = customEvent.detail.message ?? 'Unknown load error';
  await markLastLoadStatus('error', { error: message });
} catch (error) {
  console.warn('Failed to update OPFS load status to error:', error);
}
```

Place this right after `console.error('❌ Data loading error:', customEvent.detail.message);`.

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/explore/dataset-controller.ts
git commit -m "$(cat <<'EOF'
feat(dataset): write OPFS lastLoadStatus on load success/error

handleDataLoaded marks success after view is applied (user/opfs loads
only). handleDataError marks error with the failure message.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Gate auto-load on status in persisted-dataset

**Files:**

- Modify: `app/src/explore/persisted-dataset.ts`

If `readLastLoadStatus()` returns `'pending'` or `'error'`, do NOT call `dataLoader.loadFromFile`. Instead, expose hooks that the runtime can use to surface the recovery banner. Mark `'pending'` only when actually starting an auto-load (Task 2 handles `'success'`/`'error'`; this task handles the start mark for opfs loads).

- [ ] **Step 1: Add a typed result describing what loadPersistedOrDefaultDataset did**

In `app/src/explore/persisted-dataset.ts`, change the controller to expose a result discriminator instead of resolving silently:

```ts
import type { DataLoader as ProtspaceDataLoader } from '@protspace/core';
import { notify } from '../lib/notify';
import {
  StoredDatasetCorruptError,
  clearLastImportedFile,
  loadLastImportedFile,
  markLastLoadStatus,
  readLastLoadStatus,
} from './opfs-dataset-store';
import { getCorruptedPersistedDatasetNotification } from './notifications';
import type { DatasetLoadKind } from './types';

export type PersistedLoadOutcome =
  | { kind: 'auto-loaded' }
  | { kind: 'default-loaded' }
  | {
      kind: 'recovery-required';
      file: File;
      lastError?: string;
      failedAttempts: number;
    };

interface PersistedDatasetOptions {
  dataLoader: ProtspaceDataLoader;
  defaultDatasetName: string;
  registerFileLoad(file: File, kind: DatasetLoadKind): void;
  setCurrentDatasetIsDemo(isDemo: boolean): void;
  setCurrentDatasetName(name: string): void;
}
```

- [ ] **Step 2: Refactor loadPersistedOrDefaultDataset to inspect status**

Replace the existing function body:

```ts
const loadPersistedFile = async (persistedFile: File): Promise<void> => {
  await markLastLoadStatus('pending');
  registerFileLoad(persistedFile, 'opfs');
  setCurrentDatasetName(persistedFile.name);
  setCurrentDatasetIsDemo(false);
  await dataLoader.loadFromFile(persistedFile, { source: 'auto' });
};

const loadPersistedOrDefaultDataset = async (): Promise<PersistedLoadOutcome> => {
  let persistedFile: File | null = null;
  try {
    persistedFile = await loadLastImportedFile();
  } catch (error) {
    console.error('Failed to restore persisted dataset:', error);
    if (error instanceof StoredDatasetCorruptError) {
      await recoverFromCorruptedPersistedDataset('in browser storage is corrupted');
      return { kind: 'default-loaded' };
    }
  }

  if (!persistedFile) {
    await loadDefaultDataset();
    return { kind: 'default-loaded' };
  }

  const status = await readLastLoadStatus();
  if (status?.status === 'pending' || status?.status === 'error') {
    console.log(
      `Persisted dataset has unresolved status (${status.status}). ` +
        'Showing recovery banner instead of auto-loading.',
    );
    setCurrentDatasetName(persistedFile.name);
    setCurrentDatasetIsDemo(false);
    return {
      kind: 'recovery-required',
      file: persistedFile,
      lastError: status.lastError,
      failedAttempts: status.failedAttempts,
    };
  }

  await loadPersistedFile(persistedFile);
  return { kind: 'auto-loaded' };
};

const tryLoadPersistedAgain = async (file: File): Promise<void> => {
  await loadPersistedFile(file);
};
```

Add `tryLoadPersistedAgain` to the returned controller object (line ~106):

```ts
return {
  clearCorruptedPersistedDataset,
  loadDefaultDataset,
  loadPersistedOrDefaultDataset,
  loadDefaultDatasetAndClearPersistedFile,
  recoverFromCorruptedPersistedDataset,
  tryLoadPersistedAgain,
};
```

- [ ] **Step 3: Update the dataset-controller export shape**

In `app/src/explore/dataset-controller.ts`, the controller currently re-exports `loadPersistedOrDefaultDataset`. The return type is now `Promise<PersistedLoadOutcome>` — propagate this. Find the `return { ... }` block at the bottom of the file and add `tryLoadPersistedAgain: persistedDatasetController.tryLoadPersistedAgain,` next to the existing exports.

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: PASS. If `PersistedLoadOutcome` is referenced from `runtime.ts` and not yet wired up, TypeScript will flag it — that's correct, the wiring is in Task 5.

- [ ] **Step 5: Commit**

```bash
git add app/src/explore/persisted-dataset.ts app/src/explore/dataset-controller.ts
git commit -m "$(cat <<'EOF'
feat(persisted-dataset): gate auto-load on lastLoadStatus

Returns PersistedLoadOutcome describing what happened. When status is
pending or error, returns recovery-required with the file metadata
instead of calling dataLoader.loadFromFile. Exposes tryLoadPersistedAgain
for the recovery banner.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Recovery banner component

**Files:**

- Create: `app/src/explore/recovery-banner.ts`
- Modify: `app/src/explore/notifications.ts`

A sticky banner with three actions. Implementation is plain DOM + Tailwind classes (no Lit) since the `app/` shell is React + plain DOM, not Lit. Read `app/src/explore/notifications.ts` first to mirror its style for typography/spacing.

- [ ] **Step 1: Add copy strings to notifications.ts**

Append to `app/src/explore/notifications.ts`:

```ts
export interface RecoveryBannerCopy {
  title: string;
  body: string;
  retryLabel: string;
  loadDefaultLabel: string;
  clearLabel: string;
}

export function getLoadRecoveryCopy(
  fileName: string,
  failedAttempts: number,
  lastError?: string,
): RecoveryBannerCopy {
  if (failedAttempts >= 3) {
    return {
      title: 'This dataset has failed to load multiple times',
      body:
        `"${fileName}" has not finished loading after ${failedAttempts} attempts.` +
        (lastError ? ` Last error: ${lastError}.` : '') +
        ' Consider clearing it or loading the default demo bundle.',
      retryLabel: 'Try again',
      loadDefaultLabel: 'Load default',
      clearLabel: 'Clear stored data',
    };
  }

  return {
    title: 'Previous dataset did not finish loading',
    body:
      `"${fileName}" was not fully loaded last time` +
      (lastError ? ` (${lastError})` : '') +
      '. You can retry, switch to the default demo, or clear the stored copy.',
    retryLabel: 'Try again',
    loadDefaultLabel: 'Load default',
    clearLabel: 'Clear stored data',
  };
}
```

- [ ] **Step 2: Implement the banner**

Create `app/src/explore/recovery-banner.ts`:

```ts
import { getLoadRecoveryCopy } from './notifications';

export interface RecoveryBannerHandlers {
  onRetry(): Promise<void> | void;
  onLoadDefault(): Promise<void> | void;
  onClear(): Promise<void> | void;
}

export interface ShowRecoveryBannerParams {
  fileName: string;
  failedAttempts: number;
  lastError?: string;
  handlers: RecoveryBannerHandlers;
  /** Mount target — defaults to document.body. */
  parent?: HTMLElement;
}

const BANNER_ID = 'protspace-recovery-banner';

export function dismissRecoveryBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}

export function showRecoveryBanner(params: ShowRecoveryBannerParams): void {
  dismissRecoveryBanner();

  const copy = getLoadRecoveryCopy(params.fileName, params.failedAttempts, params.lastError);
  const blocking = params.failedAttempts >= 3;

  const root = document.createElement('div');
  root.id = BANNER_ID;
  root.className =
    'fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[90%] ' +
    'rounded-lg border border-amber-400 bg-amber-50 text-amber-900 ' +
    'shadow-lg p-4 flex flex-col gap-3 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-700';
  root.setAttribute('role', 'alert');

  const title = document.createElement('div');
  title.className = 'font-semibold text-sm';
  title.textContent = copy.title;

  const body = document.createElement('div');
  body.className = 'text-sm';
  body.textContent = copy.body;

  const actions = document.createElement('div');
  actions.className = 'flex gap-2 justify-end pt-1';

  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className =
    'px-3 py-1 rounded text-sm font-medium ' +
    (blocking
      ? 'bg-amber-200 text-amber-700 cursor-not-allowed dark:bg-amber-900 dark:text-amber-400'
      : 'bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700');
  retryButton.textContent = copy.retryLabel;
  retryButton.disabled = blocking;
  retryButton.addEventListener('click', () => {
    void params.handlers.onRetry();
  });

  const defaultButton = document.createElement('button');
  defaultButton.type = 'button';
  defaultButton.className =
    'px-3 py-1 rounded text-sm font-medium border border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900';
  defaultButton.textContent = copy.loadDefaultLabel;
  defaultButton.addEventListener('click', () => {
    void params.handlers.onLoadDefault();
  });

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className =
    'px-3 py-1 rounded text-sm font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900';
  clearButton.textContent = copy.clearLabel;
  clearButton.addEventListener('click', () => {
    void params.handlers.onClear();
  });

  actions.append(retryButton, defaultButton, clearButton);
  root.append(title, body, actions);

  (params.parent ?? document.body).appendChild(root);
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/explore/recovery-banner.ts app/src/explore/notifications.ts
git commit -m "$(cat <<'EOF'
feat(explore): add recovery banner for unresolved persisted loads

Sticky banner with Try again / Load default / Clear actions. After
3 failed attempts the Try-again button is disabled.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire the recovery banner into runtime

**Files:**

- Modify: `app/src/explore/runtime.ts`

`runtime.ts` is the bootstrap. It calls `loadPersistedOrDefaultDataset()`. After Task 3 it now returns a `PersistedLoadOutcome` — branch on `kind: 'recovery-required'` and show the banner.

- [ ] **Step 1: Read the current runtime startup path**

Run: `grep -n "loadPersistedOrDefaultDataset\|import" app/src/explore/runtime.ts | head -30`

Identify the call site and the dataset-controller object that exposes `tryLoadPersistedAgain` and `loadDefaultDatasetAndClearPersistedFile`.

- [ ] **Step 2: Branch on the outcome**

In `app/src/explore/runtime.ts`, find the call to `loadPersistedOrDefaultDataset` and replace it with:

```ts
import { showRecoveryBanner, dismissRecoveryBanner } from './recovery-banner';
import { clearLastImportedFile } from './opfs-dataset-store';
// ...

const outcome = await datasetController.loadPersistedOrDefaultDataset();
if (outcome.kind === 'recovery-required') {
  showRecoveryBanner({
    fileName: outcome.file.name,
    failedAttempts: outcome.failedAttempts,
    lastError: outcome.lastError,
    handlers: {
      onRetry: async () => {
        dismissRecoveryBanner();
        await datasetController.tryLoadPersistedAgain(outcome.file);
      },
      onLoadDefault: async () => {
        dismissRecoveryBanner();
        await datasetController.loadDefaultDatasetAndClearPersistedFile();
      },
      onClear: async () => {
        dismissRecoveryBanner();
        await clearLastImportedFile();
        await datasetController.loadDefaultDatasetAndClearPersistedFile();
      },
    },
  });
}
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm type-check && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/explore/runtime.ts
git commit -m "$(cat <<'EOF'
feat(runtime): mount recovery banner on unresolved persisted load

Branches on PersistedLoadOutcome — when status is pending/error from
a prior tab crash, show the banner instead of auto-retrying.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Playwright spec — recovery flow

**Files:**

- Create: `app/tests/dataset-recovery.spec.ts`

Drive the recovery flow end-to-end by directly seeding OPFS with a `'pending'` state and asserting the banner appears.

- [ ] **Step 1: Read existing helpers and config**

Run: `cat app/tests/playwright.config.ts; echo '---'; cat app/tests/helpers/explore.ts | head -80`

- [ ] **Step 2: Write the spec**

Create `app/tests/dataset-recovery.spec.ts`:

```ts
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  dismissTourIfPresent,
  waitForExploreDataLoad,
  waitForExploreInteractionReady,
} from './helpers/explore';

const SPEC_DIR = path.dirname(new URL(import.meta.url).pathname);
const SMALL_FIXTURE = path.resolve(SPEC_DIR, '../public/data/5K.parquetbundle');

test.describe('dataset recovery banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissTourIfPresent(page);
  });

  test('shows banner when persisted dataset is in pending state', async ({ page }) => {
    // Seed OPFS directly: pending status + dataset blob.
    await page.evaluate(async (smallFile) => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('protspace-last-import', { create: true });

      const blob = await fetch(smallFile).then((r) => r.blob());
      const dataHandle = await dir.getFileHandle('dataset.bin', { create: true });
      const dataWritable = await dataHandle.createWritable();
      await dataWritable.write(blob);
      await dataWritable.close();

      const metaHandle = await dir.getFileHandle('metadata.json', { create: true });
      const metaWritable = await metaHandle.createWritable();
      await metaWritable.write(
        JSON.stringify({
          schemaVersion: 2,
          name: 'fake.parquetbundle',
          type: '',
          size: 1,
          lastModified: 0,
          storedAt: '2026-05-02T00:00:00.000Z',
          lastLoadStatus: 'pending',
          failedAttempts: 1,
        }),
      );
      await metaWritable.close();
    }, '/data/5K.parquetbundle');

    await page.reload();
    await dismissTourIfPresent(page);

    const banner = page.locator('#protspace-recovery-banner');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText('did not finish loading');
    await expect(banner.getByRole('button', { name: 'Try again' })).toBeEnabled();
    await expect(banner.getByRole('button', { name: 'Load default' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Clear stored data' })).toBeVisible();
  });

  test('does not show banner when persisted dataset is in success state', async ({ page }) => {
    // Seed OPFS with status=success.
    await page.evaluate(async (smallFile) => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('protspace-last-import', { create: true });

      const blob = await fetch(smallFile).then((r) => r.blob());
      const dataHandle = await dir.getFileHandle('dataset.bin', { create: true });
      const dataWritable = await dataHandle.createWritable();
      await dataWritable.write(blob);
      await dataWritable.close();

      const metaHandle = await dir.getFileHandle('metadata.json', { create: true });
      const metaWritable = await metaHandle.createWritable();
      await metaWritable.write(
        JSON.stringify({
          schemaVersion: 2,
          name: '5K.parquetbundle',
          type: '',
          size: 1,
          lastModified: 0,
          storedAt: '2026-05-02T00:00:00.000Z',
          lastLoadStatus: 'success',
          failedAttempts: 0,
        }),
      );
      await metaWritable.close();
    }, '/data/5K.parquetbundle');

    await page.reload();
    await dismissTourIfPresent(page);
    await waitForExploreDataLoad(page);
    await waitForExploreInteractionReady(page);

    await expect(page.locator('#protspace-recovery-banner')).toHaveCount(0);
  });

  test('upgrades message after 3 failed attempts', async ({ page }) => {
    await page.evaluate(async (smallFile) => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('protspace-last-import', { create: true });

      const blob = await fetch(smallFile).then((r) => r.blob());
      const dataHandle = await dir.getFileHandle('dataset.bin', { create: true });
      const dataWritable = await dataHandle.createWritable();
      await dataWritable.write(blob);
      await dataWritable.close();

      const metaHandle = await dir.getFileHandle('metadata.json', { create: true });
      const metaWritable = await metaHandle.createWritable();
      await metaWritable.write(
        JSON.stringify({
          schemaVersion: 2,
          name: 'persistent-fail.parquetbundle',
          type: '',
          size: 1,
          lastModified: 0,
          storedAt: '2026-05-02T00:00:00.000Z',
          lastLoadStatus: 'pending',
          failedAttempts: 3,
        }),
      );
      await metaWritable.close();
    }, '/data/5K.parquetbundle');

    await page.reload();
    await dismissTourIfPresent(page);

    const banner = page.locator('#protspace-recovery-banner');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText('failed to load multiple times');
    await expect(banner.getByRole('button', { name: 'Try again' })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run the Playwright spec**

Run: `pnpm test:e2e -- dataset-recovery`
Expected: 3 tests pass.

- [ ] **Step 4: Manual sanity check in the browser**

Run: `pnpm dev` (in another terminal), then:

1. Open `http://localhost:8080`.
2. Drop a small bundle (e.g., `5K.parquetbundle`); confirm it loads.
3. Reload — should auto-load silently.
4. In DevTools console:
   ```js
   const root = await navigator.storage.getDirectory();
   const dir = await root.getDirectoryHandle('protspace-last-import');
   const meta = await dir.getFileHandle('metadata.json');
   const text = await (await meta.getFile()).text();
   const parsed = JSON.parse(text);
   parsed.lastLoadStatus = 'pending';
   const w = await meta.createWritable();
   await w.write(JSON.stringify(parsed));
   await w.close();
   ```
5. Reload — recovery banner should appear.
6. Click **Try again** — load completes, banner dismisses, status flips to `'success'`.
7. Repeat seeding `'pending'`, click **Load default** — banner dismisses, default bundle loads, OPFS cleared.

- [ ] **Step 5: Commit**

```bash
git add app/tests/dataset-recovery.spec.ts
git commit -m "$(cat <<'EOF'
test(explore): playwright spec for crash-loop recovery banner

Seeds OPFS with pending/success/3-attempt states and asserts the
banner appears (or doesn't) and disables Try again after 3 fails.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Open PR-1**

```bash
git push -u origin fix/load-reliability-phase-1
gh pr create --title "fix(load): crash-loop guard via OPFS lastLoadStatus" --body "$(cat <<'EOF'
## Summary

- Adds `lastLoadStatus` + `failedAttempts` to OPFS dataset metadata (schema v2; v1 silently migrated).
- `dataset-controller` writes pending/success/error around each load.
- `persisted-dataset` returns a `PersistedLoadOutcome`; on pending/error the runtime mounts a recovery banner instead of auto-retrying.
- After 3 failed attempts, the banner upgrades and disables Try again.
- Playwright spec covers the recovery flow.

Implements Phase 1 of `docs/superpowers/specs/2026-05-02-load-reliability-design.md`.
EOF
)"
```

---

# PR-2: Phase 2 — Memory wins

After PR-1 merges, branch off `main`: `git checkout main && git pull && git checkout -b fix/load-reliability-phase-2`.

### Task 7: Add `AnnotationData` union type

**Files:**

- Modify: `packages/utils/src/types.ts`

The downstream tasks rely on this single union type.

- [ ] **Step 1: Read the current Annotation type**

Run: `grep -n "annotation_data\|AnnotationData\|number\[\]\[\]" packages/utils/src/types.ts | head -20`

Note where `annotation_data: Record<string, number[][]>` is declared on `VisualizationData`.

- [ ] **Step 2: Introduce `AnnotationData`**

In `packages/utils/src/types.ts`, add (placement: alongside other annotation types):

```ts
/**
 * Per-protein annotation indices.
 * - `Int32Array` storage: strictly single-valued column. `data[proteinIdx]` is the
 *   index, or `-1` when the protein has no value for this column.
 * - `(readonly number[])[]` storage: multi-valued column. `data[proteinIdx]` is
 *   the list of indices; an empty array means missing.
 */
export type AnnotationData = Int32Array | readonly (readonly number[])[];
```

Update `VisualizationData.annotation_data`:

```ts
annotation_data: Record<string, AnnotationData>;
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: many failures across consumers — that's the work of Tasks 9 & 10. Note them but do not fix yet — proceed to define the accessor first (Task 8) so consumers have something to call.

- [ ] **Step 4: Commit**

```bash
git add packages/utils/src/types.ts
git commit -m "$(cat <<'EOF'
refactor(utils): introduce AnnotationData union type

Allows annotation_data entries to be Int32Array (single-valued) or
readonly number[][] (multi-valued). Consumers updated in subsequent
commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **Note:** This commit will fail type-check if pre-commit runs `quality`. To stage atomically, you may need to commit Tasks 7+8+9+10 together as a single change. Recommended: stay on this branch but defer the actual commit until Task 10 finishes — keep the changes locally; do `git add -p` per task to stage incrementally; commit only at the end of Task 10. The plan reflects this with explicit "stage" / "commit" markers.

Revise: **stage** the change, do not commit yet:

```bash
git add packages/utils/src/types.ts
# NO commit. Continue to Task 8.
```

---

### Task 8: Accessor module

**Files:**

- Create: `packages/utils/src/visualization/annotation-data-access.ts`
- Create: `packages/utils/src/visualization/annotation-data-access.test.ts`
- Modify: `packages/utils/src/index.ts`

- [ ] **Step 1: Write the failing tests first**

Create `packages/utils/src/visualization/annotation-data-access.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getProteinAnnotationIndices,
  getProteinAnnotationCount,
  getFirstAnnotationIndex,
} from './annotation-data-access';

describe('annotation-data-access', () => {
  describe('Int32Array storage', () => {
    const data = Int32Array.from([0, 2, -1, 1]);

    it('returns single-element array for present indices', () => {
      expect(getProteinAnnotationIndices(data, 0)).toEqual([0]);
      expect(getProteinAnnotationIndices(data, 1)).toEqual([2]);
      expect(getProteinAnnotationIndices(data, 3)).toEqual([1]);
    });

    it('returns empty array for sentinel -1', () => {
      expect(getProteinAnnotationIndices(data, 2)).toEqual([]);
    });

    it('counts correctly', () => {
      expect(getProteinAnnotationCount(data, 0)).toBe(1);
      expect(getProteinAnnotationCount(data, 2)).toBe(0);
    });

    it('returns first index without allocation', () => {
      expect(getFirstAnnotationIndex(data, 0)).toBe(0);
      expect(getFirstAnnotationIndex(data, 1)).toBe(2);
      expect(getFirstAnnotationIndex(data, 2)).toBe(-1);
    });
  });

  describe('number[][] storage', () => {
    const data: readonly (readonly number[])[] = [[0, 5], [], [3]];

    it('returns the inner array verbatim', () => {
      expect(getProteinAnnotationIndices(data, 0)).toEqual([0, 5]);
      expect(getProteinAnnotationIndices(data, 1)).toEqual([]);
      expect(getProteinAnnotationIndices(data, 2)).toEqual([3]);
    });

    it('counts correctly', () => {
      expect(getProteinAnnotationCount(data, 0)).toBe(2);
      expect(getProteinAnnotationCount(data, 1)).toBe(0);
      expect(getProteinAnnotationCount(data, 2)).toBe(1);
    });

    it('returns first index or -1 for empty', () => {
      expect(getFirstAnnotationIndex(data, 0)).toBe(0);
      expect(getFirstAnnotationIndex(data, 1)).toBe(-1);
      expect(getFirstAnnotationIndex(data, 2)).toBe(3);
    });
  });

  describe('out-of-range proteinIdx', () => {
    it('returns empty for Int32Array', () => {
      const data = Int32Array.from([0]);
      expect(getProteinAnnotationIndices(data, 5)).toEqual([]);
      expect(getFirstAnnotationIndex(data, 5)).toBe(-1);
    });

    it('returns empty for number[][]', () => {
      const data: readonly (readonly number[])[] = [[0]];
      expect(getProteinAnnotationIndices(data, 5)).toEqual([]);
      expect(getFirstAnnotationIndex(data, 5)).toBe(-1);
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `pnpm --filter @protspace/utils test:ci -- annotation-data-access`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the accessors**

Create `packages/utils/src/visualization/annotation-data-access.ts`:

```ts
import type { AnnotationData } from '../types.js';

/**
 * Returns the list of category indices for a given protein.
 * - For Int32Array storage: a fresh single-element array (or `[]` if missing).
 * - For (readonly number[])[] storage: the inner array (do not mutate).
 *
 * Hot paths that need just the first index should call `getFirstAnnotationIndex`
 * to avoid allocating the wrapper array.
 */
export function getProteinAnnotationIndices(
  data: AnnotationData,
  proteinIdx: number,
): readonly number[] {
  if (data instanceof Int32Array) {
    if (proteinIdx < 0 || proteinIdx >= data.length) return [];
    const value = data[proteinIdx];
    return value < 0 ? [] : [value];
  }
  if (proteinIdx < 0 || proteinIdx >= data.length) return [];
  return data[proteinIdx];
}

export function getProteinAnnotationCount(data: AnnotationData, proteinIdx: number): number {
  if (data instanceof Int32Array) {
    if (proteinIdx < 0 || proteinIdx >= data.length) return 0;
    return data[proteinIdx] < 0 ? 0 : 1;
  }
  if (proteinIdx < 0 || proteinIdx >= data.length) return 0;
  return data[proteinIdx].length;
}

/**
 * Returns the first category index for a protein, or -1 if missing/none.
 * Allocation-free: prefer this on hot paths (per-point coloring, sorting).
 */
export function getFirstAnnotationIndex(data: AnnotationData, proteinIdx: number): number {
  if (data instanceof Int32Array) {
    if (proteinIdx < 0 || proteinIdx >= data.length) return -1;
    return data[proteinIdx];
  }
  if (proteinIdx < 0 || proteinIdx >= data.length) return -1;
  const list = data[proteinIdx];
  return list.length === 0 ? -1 : list[0];
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `pnpm --filter @protspace/utils test:ci -- annotation-data-access`
Expected: all 3 describe blocks pass.

- [ ] **Step 5: Re-export from utils index**

In `packages/utils/src/index.ts`, add:

```ts
export {
  getProteinAnnotationIndices,
  getProteinAnnotationCount,
  getFirstAnnotationIndex,
} from './visualization/annotation-data-access.js';
```

- [ ] **Step 6: Stage (do not commit yet)**

```bash
git add packages/utils/src/visualization/annotation-data-access.ts \
        packages/utils/src/visualization/annotation-data-access.test.ts \
        packages/utils/src/index.ts
```

---

### Task 9: Switch single-valued categorical columns to `Int32Array`

**Files:**

- Modify: `packages/core/src/components/data-loader/utils/conversion.ts`
- Modify: `packages/core/src/components/data-loader/utils/conversion-numeric.test.ts`

`extractAnnotationsOptimized` (`conversion.ts:850`) builds `annotationDataArray: number[][]` for every categorical column. Track `maxValuesPerProtein`. When it's exactly 1 across all rows, emit `Int32Array`.

- [ ] **Step 1: Add a failing test for Int32Array storage**

Append to `packages/core/src/components/data-loader/utils/conversion-numeric.test.ts` (or the categorical sibling — read the file first to find the right place):

```ts
import { convertParquetToVisualizationDataOptimized } from './conversion';

describe('annotation_data storage shape', () => {
  it('emits Int32Array for strictly single-valued categorical columns', async () => {
    const rows = [
      { protein_id: 'p1', kingdom: 'Bacillati' },
      { protein_id: 'p2', kingdom: 'Pseudomonadati' },
      { protein_id: 'p3', kingdom: '' /* missing */ },
      { protein_id: 'p4', kingdom: 'Bacillati' },
    ];
    const projectionsData = rows.map((r, i) => ({
      protein_id: r.protein_id,
      projection_name: '2D',
      x: i,
      y: i,
    }));
    const projectionsMetadata = [{ projection_name: '2D', dimensions: 2, info_json: '{}' }];

    const result = await convertParquetToVisualizationDataOptimized({
      rows: rows.map((r, i) => ({ ...r, ...projectionsData[i] })),
      projectionsMetadata,
    });

    expect(result.annotation_data.kingdom).toBeInstanceOf(Int32Array);
    const arr = result.annotation_data.kingdom as Int32Array;
    expect(arr.length).toBe(4);
    // p3 (empty kingdom) → -1; others map to their value indices ≥ 0.
    expect(arr[2]).toBe(-1);
    expect(arr[0]).toBeGreaterThanOrEqual(0);
  });

  it('keeps number[][] storage for multi-valued columns', async () => {
    const rows = [
      { protein_id: 'p1', pfam: 'PF01;PF02' },
      { protein_id: 'p2', pfam: 'PF03' },
    ];
    const projectionsData = rows.map((r, i) => ({
      protein_id: r.protein_id,
      projection_name: '2D',
      x: i,
      y: i,
    }));
    const projectionsMetadata = [{ projection_name: '2D', dimensions: 2, info_json: '{}' }];

    const result = await convertParquetToVisualizationDataOptimized({
      rows: rows.map((r, i) => ({ ...r, ...projectionsData[i] })),
      projectionsMetadata,
    });

    expect(result.annotation_data.pfam).not.toBeInstanceOf(Int32Array);
    expect(Array.isArray(result.annotation_data.pfam)).toBe(true);
    const arr = result.annotation_data.pfam as readonly (readonly number[])[];
    expect(arr[0].length).toBe(2);
    expect(arr[1].length).toBe(1);
  });
});
```

> **Note:** verify the actual `convertParquetToVisualizationDataOptimized` signature and adjust the call (the input may be a different shape — the existing test file shows the right invocation; mirror it).

- [ ] **Step 2: Run the failing tests**

Run: `pnpm --filter @protspace/core test:ci -- conversion-numeric`
Expected: FAIL — `annotation_data.kingdom` is `number[][]`, not `Int32Array`.

- [ ] **Step 3: Track `maxValuesPerProtein` in Pass 1**

In `packages/core/src/components/data-loader/utils/conversion.ts`, modify `extractAnnotationsOptimized`. Inside the per-column loop (around line 921), track the max per-protein count. Replace the existing Pass 1:

```ts
// === Pass 1: Collect unique values, frequency counts, detect scores/evidence,
//     and track maxValuesPerProtein for storage-shape decision. ===
const valueCountMap = new Map<string, number>();
let columnHasScores = false;
let columnHasEvidence = false;
let maxValuesPerProtein = 0;

for (let i = 0; i < rows.length; i += chunkSize) {
  const end = Math.min(i + chunkSize, rows.length);
  for (let r = i; r < end; r++) {
    const rawValues = splitCategoricalAnnotationValues(rows[r][annotationCol]);
    if (rawValues.length > maxValuesPerProtein) {
      maxValuesPerProtein = rawValues.length;
    }
    for (const raw of rawValues) {
      const parsed = parseAnnotationValue(raw);
      valueCountMap.set(parsed.label, (valueCountMap.get(parsed.label) || 0) + 1);
      if (parsed.scores.length > 0) columnHasScores = true;
      if (parsed.evidence) columnHasEvidence = true;
    }
  }
  await fastYield();
}
```

- [ ] **Step 4: Branch Pass 2 on storage shape**

Replace Pass 2 (around lines 946–987) with:

```ts
// === Pass 2: Build output arrays directly. Use Int32Array for strict single-valued
//     columns to avoid the per-protein number[] allocation cliff. ===
const useTypedStorage = maxValuesPerProtein === 1 && !columnHasScores && !columnHasEvidence;

const annotationDataTyped = useTypedStorage ? new Int32Array(numProteins).fill(-1) : null;
const annotationDataArray = useTypedStorage ? null : new Array<number[]>(numProteins);
const scoresArray = columnHasScores ? new Array<(number[] | null)[]>(numProteins) : null;
const evidenceArray = columnHasEvidence ? new Array<(string | null)[]>(numProteins) : null;

for (let i = 0; i < rows.length; i += chunkSize) {
  const end = Math.min(i + chunkSize, rows.length);
  for (let r = i; r < end; r++) {
    const row = rows[r];
    const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
    const idx = idToIndex.get(proteinId);
    if (idx === undefined) continue;

    const rawValues = splitCategoricalAnnotationValues(row[annotationCol]);
    if (rawValues.length === 0) continue;

    if (annotationDataTyped) {
      // Single-valued: write the one index directly into the typed array.
      const parsed = parseAnnotationValue(rawValues[0]);
      annotationDataTyped[idx] = valueToIndex.get(parsed.label) ?? -1;
    } else {
      const indices: number[] = [];
      const scores: (number[] | null)[] | null = scoresArray ? [] : null;
      const evidences: (string | null)[] | null = evidenceArray ? [] : null;

      for (const raw of rawValues) {
        const parsed = parseAnnotationValue(raw);
        indices.push(valueToIndex.get(parsed.label) ?? -1);
        if (scores) scores.push(parsed.scores.length > 0 ? parsed.scores : null);
        if (evidences) evidences.push(parsed.evidence);
      }

      annotationDataArray![idx] = indices;
      if (scoresArray && scores) scoresArray[idx] = scores;
      if (evidenceArray && evidences) evidenceArray[idx] = evidences;
    }
  }
  await fastYield();
}

// Fill empty slots for proteins not found in this column's rows
if (annotationDataArray) {
  for (let p = 0; p < numProteins; p++) {
    if (annotationDataArray[p] === undefined) {
      annotationDataArray[p] = [];
      if (scoresArray) scoresArray[p] = [];
      if (evidenceArray) evidenceArray[p] = [];
    }
  }
}
```

The `appendSyntheticNACategory` call (line 989) only works on the array form. Guard it:

```ts
if (annotationDataArray) {
  appendSyntheticNACategory(uniqueValues, colors, shapes, annotationDataArray);
} else if (annotationDataTyped) {
  // For Int32Array, missing slots are already -1 — append the NA category to uniqueValues
  // and re-map -1 to the new NA index.
  const naIndex = uniqueValues.length;
  uniqueValues.push(NA_VALUE);
  colors.push(NA_DEFAULT_COLOR);
  shapes.push('circle');
  for (let p = 0; p < annotationDataTyped.length; p++) {
    if (annotationDataTyped[p] < 0) {
      annotationDataTyped[p] = naIndex;
    }
  }
}

annotations[annotationCol] = createCategoricalAnnotation(uniqueValues, colors, shapes);
annotation_data[annotationCol] = annotationDataTyped ?? annotationDataArray!;
if (scoresArray) annotation_scores[annotationCol] = scoresArray;
if (evidenceArray) annotation_evidence[annotationCol] = evidenceArray;
```

Update the return type of `extractAnnotationsOptimized` (line 855) — `annotation_data: Record<string, AnnotationData>`.

Add the import at the top of `conversion.ts`:

```ts
import type { AnnotationData } from '@protspace/utils';
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm --filter @protspace/core test:ci -- conversion-numeric`
Expected: PASS for both new tests.

- [ ] **Step 6: Type-check**

Run: `pnpm type-check`
Expected: many failures in legend / scatter-plot / export — those are fixed in Task 10.

- [ ] **Step 7: Stage (do not commit)**

```bash
git add packages/core/src/components/data-loader/utils/conversion.ts \
        packages/core/src/components/data-loader/utils/conversion-numeric.test.ts
```

---

### Task 10: Update consumers to read via the accessor

**Files (audit and update each):**

- `packages/core/src/components/legend/legend-data-processor.ts`
- `packages/core/src/components/legend/legend.ts`
- `packages/core/src/components/scatter-plot/*` (color pipeline + filter helpers)
- `packages/utils/src/visualization/export-utils.ts`
- Any other module the type-check from Task 9 flagged.

This is the consumer audit. Each direct access of `annotation_data[col][proteinIdx]` must route through `getProteinAnnotationIndices` or `getFirstAnnotationIndex`.

- [ ] **Step 1: Find every direct consumer**

Run:

```bash
grep -rn "annotation_data\[" --include='*.ts' --include='*.tsx' packages app | grep -v node_modules | grep -v dist | grep -v '.test.ts'
```

Make a TODO list of each line.

- [ ] **Step 2: Update each consumer**

For each call site, two patterns:

**Pattern A — needs the full index list (e.g., legend frequency counting, multi-value tooltip):**

```ts
// before
const indices = data.annotation_data[col][proteinIdx];

// after
import { getProteinAnnotationIndices } from '@protspace/utils';
const indices = getProteinAnnotationIndices(data.annotation_data[col], proteinIdx);
```

**Pattern B — only needs the first index (e.g., per-point color, single-value sort):**

```ts
// before
const idx = data.annotation_data[col][proteinIdx][0] ?? -1;

// after
import { getFirstAnnotationIndex } from '@protspace/utils';
const idx = getFirstAnnotationIndex(data.annotation_data[col], proteinIdx);
```

Apply the right pattern at each site. Hot paths (per-point loops in scatter-plot) MUST use Pattern B.

- [ ] **Step 3: Type-check + run all unit tests**

Run: `pnpm type-check && pnpm test:ci`
Expected: all PASS. If any package's tests fail, fix the consumer in that package.

- [ ] **Step 4: Stage**

```bash
git add -u packages app
```

- [ ] **Step 5: Commit Tasks 7 + 8 + 9 + 10 atomically**

```bash
git commit -m "$(cat <<'EOF'
perf(data-loader): use Int32Array for single-valued categorical columns

Replaces the per-protein number[] allocation in extractAnnotationsOptimized
with Int32Array storage when maxValuesPerProtein === 1 (no scores or
evidence) — the common case. Adds AnnotationData union type and accessor
module (getProteinAnnotationIndices, getProteinAnnotationCount,
getFirstAnnotationIndex). Consumers updated to route through the accessor.

Cuts ~12 M tiny array allocations on sprot_50-scale datasets, which
was the dominant heap pressure causing renderer OOM.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Drop the spread-merge in `mergeProjectionsWithAnnotations`

**Files:**

- Modify: `packages/core/src/components/data-loader/utils/bundle.ts`
- Modify: `packages/core/src/components/data-loader/utils/bundle.test.ts`

The current `mergeProjectionsWithAnnotations` (lines 135–173) creates ~1.1M new objects via `{...projection, ...annotation}`. Replace with `RowSource` so consumers read both sides without the spread.

- [ ] **Step 1: Read current consumers of `BundleExtractionResult.rows`**

Run: `grep -rn "BundleExtractionResult\|extractRowsFromParquetBundle" --include='*.ts' packages app | grep -v node_modules | grep -v dist | grep -v '.test.ts'`

The consumer is `convertParquetToVisualizationDataOptimized` and possibly `data-loader.ts` itself. Read each consumer's row-access pattern.

- [ ] **Step 2: Adjust the failing tests in bundle.test.ts**

Read `packages/core/src/components/data-loader/utils/bundle.test.ts` and `bundle-roundtrip.test.ts`. Adjust assertions on `result.rows` to the new shape. The test invariant becomes: "every row from `projections` is reachable, paired correctly with its annotation row keyed by protein id."

- [ ] **Step 3: Refactor `extractRowsFromParquetBundle`**

In `packages/core/src/components/data-loader/utils/bundle.ts`:

```ts
export interface BundleExtractionResult {
  /** Projection rows with x/y/z/projection_name/identifier — annotation fields NOT spread in. */
  projections: Rows;
  /** Annotation rows keyed by protein id. */
  annotationsById: Map<string, GenericRow>;
  /** Column name in `projections` that carries the protein id. */
  projectionIdColumn: string;
  /** Column name in annotation rows that carries the protein id. */
  annotationIdColumn: string;
  projectionsMetadata: Rows;
  settings: BundleSettings | null;
}
```

Remove `mergeProjectionsWithAnnotations`. The new return is constructed directly:

```ts
const annotationIdColumn =
  findColumn(selectedAnnotationsData.length > 0 ? Object.keys(selectedAnnotationsData[0]) : [], [
    'protein_id',
    'identifier',
    'id',
    'uniprot',
    'entry',
  ]) ??
  (selectedAnnotationsData.length > 0 ? Object.keys(selectedAnnotationsData[0])[0] : 'protein_id');

const annotationsById = new Map<string, GenericRow>();
for (const annotation of selectedAnnotationsData) {
  const proteinId = annotation[annotationIdColumn];
  if (proteinId != null) annotationsById.set(String(proteinId), annotation);
}

const projectionIdColumn =
  findColumn(projectionsData.length > 0 ? Object.keys(projectionsData[0]) : [], [
    'identifier',
    'protein_id',
    'id',
    'uniprot',
    'entry',
  ]) ?? 'identifier';

validateMergedBundleRows(projectionsData);

return {
  projections: projectionsData,
  annotationsById,
  projectionIdColumn,
  annotationIdColumn,
  projectionsMetadata: projectionsMetadataData,
  settings,
};
```

- [ ] **Step 4: Update `convertParquetToVisualizationDataOptimized`**

The consumer in `conversion.ts` currently iterates `rows` (the merged shape). Update its signature to accept the new `BundleExtractionResult` and read annotations via `annotationsById.get(proteinId)`. The two passes over annotation columns now look up the annotation row by ID; the projection extraction stays as-is on `projections`.

- [ ] **Step 5: Run all tests**

Run: `pnpm test:ci`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/data-loader/utils/bundle.ts \
        packages/core/src/components/data-loader/utils/bundle.test.ts \
        packages/core/src/components/data-loader/utils/conversion.ts \
        packages/core/src/components/data-loader/utils/bundle-roundtrip.test.ts
git commit -m "$(cat <<'EOF'
perf(bundle): keep projections + annotations separate, drop spread merge

extractRowsFromParquetBundle returns annotationsById + projections
instead of materializing a per-row {...projection, ...annotation} merge.
Saves ~1.1M object allocations on sprot_50-scale datasets.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Pair-aware color/shape generator

**Files:**

- Modify: `packages/core/src/components/data-loader/utils/conversion.ts`
- Add tests in: `packages/core/src/components/data-loader/utils/conversion-numeric.test.ts` (or a sibling categorical test)

- [ ] **Step 1: Write failing tests**

Append:

```ts
import { generateColorsAndShapes } from './conversion';
// (export it from conversion.ts in this task)

describe('generateColorsAndShapes', () => {
  it('returns palette.length × shapeCount distinct (color, shape) pairs', () => {
    const { colors, shapes } = generateColorsAndShapes('kellys', 200);
    expect(colors).toHaveLength(126); // 21 × 6
    expect(shapes).toHaveLength(126);
    const pairs = new Set<string>();
    for (let i = 0; i < colors.length; i++) {
      pairs.add(`${colors[i]}|${shapes[i]}`);
    }
    expect(pairs.size).toBe(126);
  });

  it('caps at the requested count when below the LCM', () => {
    const { colors, shapes } = generateColorsAndShapes('kellys', 10);
    expect(colors).toHaveLength(10);
    expect(shapes).toHaveLength(10);
  });

  it('cycles after palette.length × shapeCount entries', () => {
    const { colors: c1, shapes: s1 } = generateColorsAndShapes('kellys', 1);
    const { colors: c127, shapes: s127 } = generateColorsAndShapes('kellys', 127);
    expect(c127[126]).toBe(c1[0]);
    expect(s127[126]).toBe(s1[0]);
  });

  it('falls back to kellys for unknown palette ids', () => {
    const { colors } = generateColorsAndShapes('not-a-real-palette', 5);
    expect(colors).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter @protspace/core test:ci -- conversion-numeric`
Expected: FAIL — `generateColorsAndShapes` not exported.

- [ ] **Step 3: Implement and replace `generateColors` / `generateShapes`**

In `packages/core/src/components/data-loader/utils/conversion.ts`, replace the existing `generateColors` (line 803) and `generateShapes` (line 825) with:

```ts
import { COLOR_SCHEMES } from '@protspace/utils';

const SUPPORTED_SHAPES = [
  'circle',
  'square',
  'diamond',
  'plus',
  'triangle-up',
  'triangle-down',
] as const;

export function generateColorsAndShapes(
  paletteId: string,
  count: number,
): { colors: string[]; shapes: string[] } {
  if (count <= 0) return { colors: [], shapes: [] };
  const palette =
    (COLOR_SCHEMES as Record<string, readonly string[]>)[paletteId] ?? COLOR_SCHEMES.kellys;
  const cap = Math.min(count, palette.length * SUPPORTED_SHAPES.length);
  const colors: string[] = new Array(cap);
  const shapes: string[] = new Array(cap);
  for (let i = 0; i < cap; i++) {
    colors[i] = palette[i % palette.length];
    shapes[i] = SUPPORTED_SHAPES[Math.floor(i / palette.length) % SUPPORTED_SHAPES.length];
  }
  return { colors, shapes };
}
```

Replace the call sites in `extractAnnotationsOptimized`:

```ts
// before:
// const colors = generateColors(uniqueValues.length);
// const shapes = generateShapes(uniqueValues.length);

// after:
const { colors, shapes } = generateColorsAndShapes('kellys', uniqueValues.length);
```

Delete the old `generateColors` and `generateShapes` functions and their callers.

- [ ] **Step 4: Update consumers to use modular indexing**

Run:

```bash
grep -rn "\.colors\[\|\.shapes\[" --include='*.ts' packages app | grep -v node_modules | grep -v dist | grep -v '.test.ts'
```

For each consumer that indexes by category index `idx`, replace `arr.colors[idx]` with `arr.colors[idx % arr.colors.length]` (and same for shapes). User-pinned overrides remain looked up by category value (not index) — leave those alone.

- [ ] **Step 5: Run tests**

Run: `pnpm test:ci`
Expected: PASS.

- [ ] **Step 6: Browser sanity**

Run: `pnpm dev`. Drop a small bundle. Pick a categorical annotation and verify the legend renders 30 distinct visual encodings (colors + shapes). No regression on the demo bundle.

- [ ] **Step 7: Commit**

```bash
git add -u packages app
git commit -m "$(cat <<'EOF'
refactor(visual-encoding): pair-aware color+shape generation

Replaces generateColors/generateShapes (independent cycles) with
generateColorsAndShapes that advances shape only after a full palette
cycle. Yields palette.length × shapeCount distinct (color, shape) pairs
(126 for Kelly's vs 42 reachable today). Consumers use modular indexing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Fix null-selection materialization gate

**Files:**

- Modify: `packages/utils/src/visualization/numeric-binning.ts`
- Modify: `packages/utils/src/visualization/numeric-binning.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/utils/src/visualization/numeric-binning.test.ts`:

```ts
describe('materializeVisualizationData null-selection gate', () => {
  it('does not materialize any numeric annotation when selection is null', () => {
    const data: VisualizationData = {
      protein_ids: ['p1', 'p2'],
      annotations: {
        a: { kind: 'numeric', numericType: 'float' },
        b: { kind: 'numeric', numericType: 'int' },
      } as VisualizationData['annotations'],
      annotation_data: {},
      numeric_annotation_data: {
        a: [1.0, 2.0],
        b: [3, 4],
      },
      projections: {} as VisualizationData['projections'],
      projections_metadata: [] as VisualizationData['projections_metadata'],
    };

    const out = materializeVisualizationData(data, {}, 10, null);

    // Both a and b remain numeric (un-materialized).
    expect(out.annotations.a.kind).toBe('numeric');
    expect(out.annotations.b.kind).toBe('numeric');
  });
});
```

> Adjust the `data` shape if the existing test file uses a helper builder; mirror the local pattern.

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @protspace/utils test:ci -- numeric-binning`
Expected: FAIL — both annotations get materialized into categorical (kind === 'categorical' with sourceKind === 'numeric').

- [ ] **Step 3: Fix the gate**

In `packages/utils/src/visualization/numeric-binning.ts:779`, change:

```ts
const shouldMaterialize = requestedAnnotations
  ? requestedAnnotations.has(annotationName)
  : !selectedNumericAnnotation || annotationName === selectedNumericAnnotation;
```

to:

```ts
const shouldMaterialize = requestedAnnotations
  ? requestedAnnotations.has(annotationName)
  : annotationName === selectedNumericAnnotation;
```

(`null` no longer matches anything.)

- [ ] **Step 4: Run the test + full suite**

Run: `pnpm test:ci`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/utils/src/visualization/numeric-binning.ts \
        packages/utils/src/visualization/numeric-binning.test.ts
git commit -m "$(cat <<'EOF'
fix(numeric-binning): null selection materializes nothing

Previously a null selectedNumericAnnotation matched every numeric
annotation, eagerly binning all of them on first render. Now it
materializes none — only the explicitly selected annotation is binned.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Playwright spec — large bundle load

**Files:**

- Create: `app/tests/load-large-bundle.spec.ts`

Verify the actual user-visible behavior we set out to fix.

- [ ] **Step 1: Confirm `sprot_50.parquetbundle` is reachable from the test harness**

The fixture lives outside `app/tests/fixtures/` (it's in `protspace/data/other/sprot/`). Copy it (or symlink) into `app/tests/fixtures/sprot_50.parquetbundle` for the test to pick it up:

```bash
cp /Users/tsenoner/Documents/projects/protspace-suite/protspace/data/other/sprot/sprot_50.parquetbundle \
   app/tests/fixtures/sprot_50.parquetbundle
```

Add `app/tests/fixtures/sprot_50.parquetbundle` to `.gitignore` since it's 45 MB:

```bash
echo "app/tests/fixtures/sprot_50.parquetbundle" >> .gitignore
```

(Skip the test in CI by default; gate it on an env var so contributors who don't have the fixture aren't blocked.)

- [ ] **Step 2: Write the spec**

Create `app/tests/load-large-bundle.spec.ts`:

```ts
import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { dismissTourIfPresent, waitForExploreDataLoad } from './helpers/explore';

const SPEC_DIR = path.dirname(new URL(import.meta.url).pathname);
const SPROT_FIXTURE = path.resolve(SPEC_DIR, 'fixtures/sprot_50.parquetbundle');

const fixtureAvailable = fs.existsSync(SPROT_FIXTURE);

test.describe('large bundle load (sprot_50, 573k proteins)', () => {
  test.skip(
    !fixtureAvailable,
    'Fixture sprot_50.parquetbundle not present; copy from protspace/data/other/sprot/.',
  );
  test.setTimeout(120_000);

  test('loads sprot_50 without OOM and renders the legend', async ({ page }) => {
    await page.goto('/');
    await dismissTourIfPresent(page);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SPROT_FIXTURE);

    await waitForExploreDataLoad(page, { timeout: 90_000 });

    const proteinCount = await page.evaluate(() => {
      const plot = document.querySelector('#myPlot') as {
        data?: { protein_ids?: string[] };
      } | null;
      return plot?.data?.protein_ids?.length ?? 0;
    });
    expect(proteinCount).toBe(573_649);

    const legend = page.locator('protspace-legend');
    await expect(legend).toBeVisible();

    // Switch the selected annotation across categorical (kingdom),
    // multi-valued (pfam), high-card (gene_name), and numeric (annotation_score).
    for (const annotation of ['kingdom', 'pfam', 'gene_name', 'annotation_score']) {
      await page.evaluate((name) => {
        const plot = document.querySelector('#myPlot') as any;
        if (plot) plot.selectedAnnotation = name;
      }, annotation);
      await page.waitForTimeout(500);
      await expect(legend).toBeVisible();
    }

    // No console errors during load.
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        throw new Error(`Console error: ${msg.text()}`);
      }
    });
  });
});
```

- [ ] **Step 3: Manual heap snapshot check**

Run `pnpm dev`. In Chrome:

1. Open `http://localhost:8080`.
2. Open DevTools → Memory tab.
3. Drop `sprot_50.parquetbundle` from the protspace data folder.
4. Wait for the legend to render.
5. Take a heap snapshot. Record retained size (target: < 500 MB).
6. Switch annotation to `pfam`, `gene_name`, `annotation_score` — each should render quickly without freezes.
7. Reload. Auto-load completes silently (Phase 1 status='success').

Document the heap-snapshot retained size in the PR description.

- [ ] **Step 4: Run the Playwright spec (locally; will skip in CI)**

Run: `pnpm test:e2e -- load-large-bundle`
Expected: 1 test passes (or skipped if fixture missing).

- [ ] **Step 5: Commit**

```bash
git add app/tests/load-large-bundle.spec.ts .gitignore
git commit -m "$(cat <<'EOF'
test(explore): playwright spec for large-bundle load

Loads sprot_50.parquetbundle (573k proteins), asserts protein count
and legend render across 4 annotation columns. Skipped when the
fixture is not present locally.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Open PR-2**

```bash
git push -u origin fix/load-reliability-phase-2
gh pr create --title "perf(load): memory wins for large bundles (Int32Array storage + pair-aware encoding)" --body "$(cat <<'EOF'
## Summary

- `Int32Array` storage for strictly single-valued categorical columns (the dominant heap saving on sprot_50).
- Drop the per-row `{...projection, ...annotation}` spread in `mergeProjectionsWithAnnotations`.
- Pair-aware `generateColorsAndShapes` — 126 distinct (color, shape) pairs for Kelly's vs 42 reachable today.
- Fix null-selection materialization gate in `numeric-binning.ts:779`.
- Playwright spec for sprot_50 load.
- Heap snapshot post-load: < 500 MB retained (was crashing >2–4 GB).

Implements Phase 2 of `docs/superpowers/specs/2026-05-02-load-reliability-design.md`.
EOF
)"
```

---

## Self-review

**Spec coverage**

| Spec section                           | Implemented in       |
| -------------------------------------- | -------------------- |
| §5.1 schema bump + APIs + migration    | Task 1               |
| §5.2 status writes around load         | Task 2               |
| §5.3 status-gated auto-load            | Task 3               |
| §5.4 recovery banner                   | Tasks 4 + 5          |
| §5.5 acceptance — Playwright + manual  | Task 6               |
| §6.1 `Int32Array` for single-valued    | Tasks 7 + 8 + 9 + 10 |
| §6.2 drop spread merge                 | Task 11              |
| §6.3 pair-aware color/shape generator  | Task 12              |
| §6.4 null-selection gate fix           | Task 13              |
| §6.6 Playwright + manual heap snapshot | Task 14              |

**Placeholder scan**

No TBDs. The "Note" boxes (Tasks 7, 9, 11, 13) explicitly call out that the spec author should adjust call signatures to match what they find in the actual file (the test setup helper invocation, etc.) — these are real instructions, not placeholders, but a worker should treat them as a "verify locally" gate.

**Type consistency**

- `AnnotationData = Int32Array | readonly (readonly number[])[]` — referenced consistently in Tasks 7, 8, 9, 10, 11.
- Accessor names `getProteinAnnotationIndices` / `getProteinAnnotationCount` / `getFirstAnnotationIndex` — same in Task 8 (definition), Task 10 (consumers).
- `markLastLoadStatus` / `readLastLoadStatus` — same in Tasks 1 (definition), 2 + 3 (consumers).
- `PersistedLoadOutcome` — same in Tasks 3 (definition), 5 (consumer).
- `generateColorsAndShapes` — same in Task 12.

**Scope check**

Two PRs, each independently shippable. Phase 1 fixes the unusable-on-reload UX symptom; Phase 2 fixes the underlying OOM. Phase 3 is its own issue.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-load-reliability.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
