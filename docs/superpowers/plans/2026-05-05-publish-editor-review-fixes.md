# Publish Editor Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address every Critical, Important, Minor, and test-coverage finding from the `/review` of PR #232 (`feat/publish-editor`) so the publish editor is correct, hardened against malformed/adversarial input, and properly tested.

**Architecture:** All fixes land in the existing publish-editor modules — no new architecture. Each task is one focused fix, written test-first. Each task ends with a small, atomic commit.

**Tech Stack:** TypeScript, Lit 3.3 web components, Vitest + jsdom, Playwright (e2e), pnpm monorepo. Run `pnpm precommit` before any commit.

**Source repo:** `/Users/tsenoner/Documents/projects/protspace-suite/protspace_web`. Active branch is `feat/publish-editor` — confirm with the user whether to commit there or branch off (e.g. `fix/publish-editor-review`) before starting Task 1.

**Discipline:** TDD, DRY, YAGNI, frequent commits. The test-first contract: every behavior change starts with a failing test. Pure refactors (no behavior change) skip the failing-test step but must still verify the existing suite stays green.

---

## File Structure

Existing files modified — no new files created. Each task lists exact paths and line ranges.

| File                                                                      | Tasks         |
| ------------------------------------------------------------------------- | ------------- |
| `packages/utils/src/png/phys-chunk.ts`                                    | 1             |
| `packages/utils/src/png/phys-chunk.test.ts`                               | 1             |
| `packages/core/src/components/publish/publish-state-validator.ts`         | 2             |
| `packages/core/src/components/publish/publish-state-validator.test.ts`    | 2             |
| `packages/utils/src/parquet/settings-validation.ts`                       | 3             |
| `packages/utils/src/parquet/settings-validation.test.ts`                  | 3             |
| `packages/core/src/components/publish/publish-modal.ts`                   | 4, 5, 6, 7, 8 |
| `packages/core/src/components/publish/publish-modal.test.ts`              | 4, 6, 7, 16   |
| `packages/core/src/components/publish/publish-modal-helpers.ts`           | 8             |
| `packages/core/src/components/publish/publish-modal-helpers.test.ts`      | 8             |
| `packages/core/src/components/publish/publish-compositor.ts`              | 9, 10, 11     |
| `packages/core/src/components/publish/publish-compositor.test.ts`         | 9, 10, 11     |
| `app/src/explore/export-handler.ts`                                       | 8, 12         |
| `packages/utils/src/visualization/export-utils.test.ts`                   | 13            |
| `app/tests/figure-editor.spec.ts`                                         | 14            |
| `packages/core/src/components/publish/publish-overlay-controller.test.ts` | 15            |

---

## Task 1: Harden `pngWithDpi` — signature check, length bounds, cross-validated CRC

**Why this matters:** Today `pngWithDpi` will inject a `pHYs` chunk into anything ≥33 bytes — including a JPEG or random bytes — and silently emit a corrupt blob. A maliciously-crafted chunk-length field can drive `cursor + total > buf.length`, pushing a bogus range into `ranges` and producing garbage output. Adversarial input is unlikely in the live export path (PNG comes from `canvas.toBlob`) but the function is exported for general use, so the contract should hold. The CRC test currently asserts a single magic constant — a wrong polynomial would still pass.

**Files:**

- Modify: `packages/utils/src/png/phys-chunk.ts:71-102`
- Modify: `packages/utils/src/png/phys-chunk.test.ts:149-159` (replace tautological CRC check)

- [ ] **Step 1.1: Write failing tests for the new guards**

Append these tests to `packages/utils/src/png/phys-chunk.test.ts` _inside_ the existing `describe('pngWithDpi', ...)`:

```ts
it('returns the input unchanged when the PNG signature is missing', async () => {
  const notAPng = new Uint8Array(64).fill(0xab);
  const blob = new Blob([notAPng], { type: 'image/png' });
  const out = await pngWithDpi(blob, 300);
  // Same bytes back — no pHYs injected.
  const buf = new Uint8Array(await out.arrayBuffer());
  expect(buf.length).toBe(notAPng.length);
  expect(buf[0]).toBe(0xab);
});

it('returns the input unchanged when a chunk length runs past the buffer', async () => {
  // Take a valid 1×1 PNG, corrupt the IDAT length to a huge value.
  const corrupt = new Uint8Array(ONE_BY_ONE_PNG);
  // IDAT length sits at signature(8) + IHDR(25) = 33.
  corrupt[33] = 0xff;
  corrupt[34] = 0xff;
  corrupt[35] = 0xff;
  corrupt[36] = 0xff;
  const out = await pngWithDpi(new Blob([corrupt], { type: 'image/png' }), 300);
  const outBuf = new Uint8Array(await out.arrayBuffer());
  expect(outBuf.length).toBe(corrupt.length);
});

it('CRC32 matches an independent reference implementation', async () => {
  // Reference: standard CRC-32 (IEEE 802.3, polynomial 0xEDB88320).
  // Computed inline so the test isn't relying on the same code under test.
  const refCrc32 = (data: Uint8Array): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let k = 0; k < 8; k++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  // Build the type+data the production code computes CRC over for 300 DPI.
  const ppm = Math.round(300 * 39.3700787401575); // 11811
  const typeAndData = new Uint8Array(13);
  typeAndData.set([0x70, 0x48, 0x59, 0x73], 0); // 'pHYs'
  typeAndData[4] = (ppm >>> 24) & 0xff;
  typeAndData[5] = (ppm >>> 16) & 0xff;
  typeAndData[6] = (ppm >>> 8) & 0xff;
  typeAndData[7] = ppm & 0xff;
  typeAndData[8] = (ppm >>> 24) & 0xff;
  typeAndData[9] = (ppm >>> 16) & 0xff;
  typeAndData[10] = (ppm >>> 8) & 0xff;
  typeAndData[11] = ppm & 0xff;
  typeAndData[12] = 1; // unit = metres
  const expectedCrc = refCrc32(typeAndData);

  const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
  const out = await pngWithDpi(blob, 300);
  const buf = new Uint8Array(await out.arrayBuffer());
  const phys = findChunk(buf, 'pHYs')!;
  const crcOffset = phys.dataOffset + 9;
  expect(readUint32(buf, crcOffset)).toBe(expectedCrc);
});
```

Then **delete** the existing tautological CRC test at `phys-chunk.test.ts:149-159` (the one that asserts the magic `0x78a53f76`) — the new test above replaces it with a cross-validated assertion.

- [ ] **Step 1.2: Run the tests, verify the two new guard tests fail and the cross-validated CRC test passes**

```bash
pnpm --filter @protspace/utils test src/png/phys-chunk.test.ts -- --run
```

Expected: 2 failures (signature check, length-bounds check). The cross-validated CRC test should pass — it's a stricter version of the deleted one and the existing implementation already produces the right CRC.

- [ ] **Step 1.3: Add the signature and length guards in `phys-chunk.ts`**

In `packages/utils/src/png/phys-chunk.ts`, replace the body of `pngWithDpi` between lines 72 and 102. Specifically:

Add a signature constant near the top of the file (under the existing constants at line 15-16):

```ts
const PNG_SIGNATURE: ReadonlyArray<number> = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
```

In `pngWithDpi`, after `const buf = new Uint8Array(ab);` (currently line 73) replace the early-return guards and chunk loop with:

```ts
if (buf.length < PNG_SIGNATURE_LENGTH) return blob;
for (let i = 0; i < PNG_SIGNATURE_LENGTH; i++) {
  if (buf[i] !== PNG_SIGNATURE[i]) {
    console.warn('pngWithDpi: input is not a PNG (signature mismatch); returning unchanged');
    return blob;
  }
}

// IHDR is always the first chunk, fixed-size: 4 length + 4 type + 13 data + 4 crc = 25 bytes.
const ihdrEnd = PNG_SIGNATURE_LENGTH + 25;
if (ihdrEnd > buf.length) return blob;

const ranges: Array<[number, number]> = [[0, ihdrEnd]];

let cursor = ihdrEnd;
let malformed = false;
while (cursor < buf.length) {
  if (cursor + 8 > buf.length) {
    ranges.push([cursor, buf.length]);
    break;
  }
  const length = readUint32(buf, cursor);
  const total = 12 + length;
  if (cursor + total > buf.length) {
    malformed = true;
    break;
  }
  const tag = String.fromCharCode(
    buf[cursor + 4],
    buf[cursor + 5],
    buf[cursor + 6],
    buf[cursor + 7],
  );
  if (tag !== 'pHYs') {
    ranges.push([cursor, cursor + total]);
  }
  cursor += total;
}
if (malformed) {
  console.warn('pngWithDpi: chunk length runs past end of buffer; returning unchanged');
  return blob;
}
```

- [ ] **Step 1.4: Run the tests, verify everything is green**

```bash
pnpm --filter @protspace/utils test src/png/phys-chunk.test.ts -- --run
```

Expected: all tests pass.

- [ ] **Step 1.5: Run the wider precommit suite**

```bash
pnpm precommit
```

Expected: clean (no formatting/lint/typecheck/test failures).

- [ ] **Step 1.6: Commit**

```bash
git add packages/utils/src/png/phys-chunk.ts packages/utils/src/png/phys-chunk.test.ts
git commit -m "fix(utils): harden pngWithDpi against non-PNG and malformed input"
```

---

## Task 2: Tighten `sanitizeNormRect` and cap label-text length

**Why this matters:** `sanitizeNormRect` accepts `x + w` up to `1.001` to absorb float round-trip noise but stores the value verbatim, so a slightly out-of-bounds rect (e.g. `x=0.5, w=0.5009`) leaks past the validator and the compositor draws past the plot rect. Separately, `label.text` is unconstrained — a crafted bundle could persist megabyte-long strings into localStorage; `savePublishState` then silently catches the resulting `QuotaExceededError`. We also have no prototype-pollution / deep-payload tests for the validator boundary.

**Files:**

- Modify: `packages/core/src/components/publish/publish-state-validator.ts:73-98`
- Modify: `packages/core/src/components/publish/publish-state-validator.test.ts` (append new test cases)

- [ ] **Step 2.1: Write failing tests**

Append these to `packages/core/src/components/publish/publish-state-validator.test.ts` inside the existing top-level `describe('sanitizePublishState', ...)`:

```ts
it('clamps NormRect width when x + w slightly exceeds 1', () => {
  const out = sanitizePublishState({
    insets: [
      {
        sourceRect: { x: 0.5, y: 0.5, w: 0.5009, h: 0.4 },
        targetRect: { x: 0, y: 0, w: 0.2, h: 0.2 },
        border: 0,
        connector: 'none',
      },
    ],
  });
  expect(out.insets).toHaveLength(1);
  expect(out.insets[0].sourceRect.x + out.insets[0].sourceRect.w).toBeLessThanOrEqual(1);
});

it('rejects NormRect when x + w exceeds the slack tolerance', () => {
  const out = sanitizePublishState({
    insets: [
      {
        sourceRect: { x: 0.5, y: 0, w: 0.6, h: 0.2 },
        targetRect: { x: 0, y: 0, w: 0.2, h: 0.2 },
        border: 0,
        connector: 'none',
      },
    ],
  });
  expect(out.insets).toHaveLength(0);
});

it('caps label text length to MAX_LABEL_TEXT_LENGTH', () => {
  const huge = 'a'.repeat(10_000);
  const out = sanitizePublishState({
    overlays: [{ type: 'label', x: 0.1, y: 0.1, text: huge, fontSize: 14, color: '#000' }],
  });
  expect(out.overlays).toHaveLength(1);
  const label = out.overlays[0] as { text: string };
  // Cap is 256 chars (matches the const exported from the module).
  expect(label.text.length).toBe(256);
});

it('does not mutate Object.prototype when given a __proto__ payload', () => {
  const originalToString = Object.prototype.toString;
  sanitizePublishState(JSON.parse('{"__proto__": {"isAdmin": true}, "overlays": []}'));
  expect((Object.prototype as unknown as { isAdmin?: boolean }).isAdmin).toBeUndefined();
  expect(Object.prototype.toString).toBe(originalToString);
});

it('survives deeply nested junk values without throwing', () => {
  let nested: unknown = 'leaf';
  for (let i = 0; i < 200; i++) nested = { wrap: nested };
  expect(() =>
    sanitizePublishState({ overlays: [nested], insets: [{ sourceRect: nested }] }),
  ).not.toThrow();
});
```

- [ ] **Step 2.2: Run the tests, verify the four behavioral tests fail**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-state-validator.test.ts -- --run
```

Expected: 3 failures (slack-clamp, label cap, the prototype-pollution and deep-nesting tests will likely already pass — if they pass, leave them as regression coverage and proceed).

- [ ] **Step 2.3: Apply the implementation changes**

In `packages/core/src/components/publish/publish-state-validator.ts`, near the top under the existing `MAX_CANVAS_PIXEL_DIM` constant (~line 32-37), add:

```ts
/** Max length for label text. Anything longer is truncated to keep state
 *  size bounded (a crafted bundle could otherwise blow localStorage quota). */
export const MAX_LABEL_TEXT_LENGTH = 256;
```

Then update `sanitizeNormRect` (currently lines 91-98). Replace the slack guard with a clamp:

```ts
function sanitizeNormRect(raw: unknown): NormRect | null {
  if (!isObject(raw)) return null;
  if (!inUnit(raw.x) || !inUnit(raw.y)) return null;
  if (!isFiniteNumber(raw.w) || !isFiniteNumber(raw.h)) return null;
  if (raw.w <= 0 || raw.h <= 0) return null;
  // Reject only when clearly out of range; clamp small float-overrun in width/height
  // so the compositor never draws past the plot rect.
  const SLACK = 0.001;
  if (raw.x + raw.w > 1 + SLACK || raw.y + raw.h > 1 + SLACK) return null;
  return {
    x: raw.x,
    y: raw.y,
    w: Math.min(raw.w, 1 - raw.x),
    h: Math.min(raw.h, 1 - raw.y),
  };
}
```

In `sanitizeOverlay`, the `'label'` branch (currently lines 73-87), truncate `text`:

```ts
if (type === 'label') {
  if (!inUnit(raw.x) || !inUnit(raw.y)) return null;
  if (!isString(raw.text)) return null;
  if (!isFiniteNumber(raw.fontSize) || raw.fontSize <= 0) return null;
  if (!isString(raw.color)) return null;
  return {
    type: 'label',
    x: raw.x,
    y: raw.y,
    text: raw.text.slice(0, MAX_LABEL_TEXT_LENGTH),
    fontSize: raw.fontSize,
    rotation: isFiniteNumber(raw.rotation) ? raw.rotation : 0,
    color: raw.color,
  };
}
```

- [ ] **Step 2.4: Run the tests, verify all green**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-state-validator.test.ts -- --run
```

- [ ] **Step 2.5: Commit**

```bash
git add packages/core/src/components/publish/publish-state-validator.ts packages/core/src/components/publish/publish-state-validator.test.ts
git commit -m "fix(publish): clamp NormRect overrun and cap label text length"
```

---

## Task 3: Sanitize `publishState` at the parquet ingest boundary

**Why this matters:** `normalizeBundleSettings` returns `bundleSettings.publishState` as a raw `Record<string, unknown>` — sanitization happens later when the modal opens. Any code that reads `bundleSettings.publishState` between bundle ingest and modal open is treating untrusted data as trusted. Fixing this makes the guarantee structural rather than incidental.

**Files:**

- Modify: `packages/utils/src/parquet/settings-validation.ts:297-335`
- Modify: `packages/utils/src/parquet/settings-validation.test.ts` (append a test)

> **Important:** `sanitizePublishState` lives in `@protspace/core`, but `settings-validation.ts` is in `@protspace/utils`. We **don't** want utils → core dependency. Instead, accept an injectable sanitizer.

- [ ] **Step 3.1: Write failing test**

Append to `packages/utils/src/parquet/settings-validation.test.ts`:

```ts
it('runs the optional publishState sanitizer when provided', () => {
  const calls: unknown[] = [];
  const fakeSanitizer = (input: unknown) => {
    calls.push(input);
    return { sanitized: true };
  };
  const obj = {
    legendSettings: {},
    exportOptions: {},
    publishState: { fromBundle: true },
  };
  const result = normalizeBundleSettings(obj, { sanitizePublishState: fakeSanitizer });
  expect(calls).toEqual([{ fromBundle: true }]);
  expect(result?.publishState).toEqual({ sanitized: true });
});

it('passes publishState through unchanged when no sanitizer is provided (back-compat)', () => {
  const obj = {
    legendSettings: {},
    exportOptions: {},
    publishState: { raw: 1 },
  };
  const result = normalizeBundleSettings(obj);
  expect(result?.publishState).toEqual({ raw: 1 });
});
```

- [ ] **Step 3.2: Run, verify the new test fails**

```bash
pnpm --filter @protspace/utils test src/parquet/settings-validation.test.ts -- --run
```

Expected: 1 failure (the test that injects a sanitizer).

- [ ] **Step 3.3: Add the optional sanitizer parameter**

In `packages/utils/src/parquet/settings-validation.ts`, change the signature of `normalizeBundleSettings` (currently line 297) to:

```ts
export interface NormalizeBundleSettingsOptions {
  /** Optional sanitizer applied to `publishState` before it leaves the boundary.
   *  Injected because `@protspace/utils` cannot depend on `@protspace/core`. */
  sanitizePublishState?: (input: unknown) => unknown;
}

export function normalizeBundleSettings(
  obj: unknown,
  options: NormalizeBundleSettingsOptions = {},
): BundleSettings | null {
```

Inside the function, every `publishState: obj.publishState` (or equivalent) becomes:

```ts
publishState:
  options.sanitizePublishState && obj.publishState !== undefined
    ? (options.sanitizePublishState(obj.publishState) as Record<string, unknown>)
    : (obj.publishState as Record<string, unknown> | undefined),
```

Apply this in **both** branches that produce `publishState` — the `isNormalizedBundleSettings` branch (line 302) and the fallback branch (line 320-329).

- [ ] **Step 3.4: Wire the sanitizer at the call site(s)**

`sanitizePublishState` is already re-exported from `packages/core/src/components/publish/index.ts:14` (verified) — no re-export needed.

Find every caller of `normalizeBundleSettings`:

```bash
grep -rn 'normalizeBundleSettings' app/src packages/core/src packages/utils/src
```

For each call inside `app/src/` or `packages/core/src/` that ingests bundle data destined for the publish modal, pass the sanitizer:

```ts
import { sanitizePublishState } from '@protspace/core';
// …
const settings = normalizeBundleSettings(rawSettings, { sanitizePublishState });
```

Internal-utility callers (e.g. tests, plumbing that doesn't surface publishState to user code) can keep the no-arg form.

- [ ] **Step 3.5: Run the wider test suite**

```bash
pnpm precommit
```

Expected: green.

- [ ] **Step 3.6: Commit**

```bash
git add packages/utils/src/parquet/settings-validation.ts packages/utils/src/parquet/settings-validation.test.ts packages/core/src/components/publish/index.ts app/src/explore
git commit -m "fix(utils): sanitize publishState at parquet ingest boundary"
```

---

## Task 4: Plot-cache key must include background color

**Why this matters:** `_plotCacheKey` is `${plotRect.w}x${plotRect.h}`. Toggling `state.background` between `'white'` and `'transparent'` reuses the previously cached canvas — meaning a transparent export can serve up the prior white-bg render.

**Files:**

- Modify: `packages/core/src/components/publish/publish-modal.ts:369-377`
- Modify: `packages/core/src/components/publish/publish-modal.test.ts` (add a test)

- [ ] **Step 4.1: Write a failing test**

Append to `packages/core/src/components/publish/publish-modal.test.ts` inside the appropriate `describe`:

```ts
it('invalidates the plot cache when background toggles white ↔ transparent', async () => {
  // Construct the modal with a fake plotElement that records each capture call.
  const captures: Array<{ bg: string }> = [];
  const fakePlotEl = {
    captureAtResolution: (w: number, h: number, opts: { backgroundColor?: string }) => {
      captures.push({ bg: opts.backgroundColor ?? '' });
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    },
  } as unknown as HTMLElement;

  const modal = document.createElement('protspace-publish-modal') as HTMLElement & {
    plotElement: HTMLElement;
    _state: { background: 'white' | 'transparent' };
    requestUpdate: () => void;
    updateComplete: Promise<unknown>;
  };
  modal.plotElement = fakePlotEl;
  document.body.appendChild(modal);
  await modal.updateComplete;

  // Force a redraw on white bg.
  modal._state = { ...modal._state, background: 'white' };
  modal.requestUpdate();
  await modal.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));

  // Toggle to transparent — the cache must invalidate.
  modal._state = { ...modal._state, background: 'transparent' };
  modal.requestUpdate();
  await modal.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));

  expect(captures.some((c) => c.bg === '#ffffff')).toBe(true);
  expect(captures.some((c) => c.bg === 'rgba(0,0,0,0)')).toBe(true);
  modal.remove();
});
```

- [ ] **Step 4.2: Run, verify failure**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-modal.test.ts -- --run
```

- [ ] **Step 4.3: Include `bgColor` in the cache key**

In `packages/core/src/components/publish/publish-modal.ts:369`, change:

```ts
const cacheKey = `${plotRect.w}x${plotRect.h}`;
```

to:

```ts
const cacheKey = `${plotRect.w}x${plotRect.h}|${bgColor}`;
```

- [ ] **Step 4.4: Run, verify green**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-modal.test.ts -- --run
```

- [ ] **Step 4.5: Commit**

```bash
git add packages/core/src/components/publish/publish-modal.ts packages/core/src/components/publish/publish-modal.test.ts
git commit -m "fix(publish): include background color in plot cache key"
```

---

## Task 5: Bypass inset render fast-path during export

**Why this matters:** `_handleExport` calls `_captureInsetRenders`, which has an 80 ms fast-path that returns the previously-rendered (preview-resolution) canvas. If the user clicks Export while inset state churns, the export silently downgrades to a stretched preview-size render at full export resolution.

**Files:**

- Modify: `packages/core/src/components/publish/publish-modal.ts:521-585, 707-744`

- [ ] **Step 5.1: Write a failing test**

Append to `publish-modal.test.ts`:

```ts
it('inset render skips fast-path when invoked from export', async () => {
  const captures: Array<{ w: number; h: number; forExport: boolean }> = [];
  const fakePlotEl = {
    captureAtResolution: (w: number, h: number) => {
      captures.push({ w, h, forExport: false });
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    },
    getDataExtent: () => ({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 }),
    getRenderInfo: () => ({ marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0 }),
  } as unknown as HTMLElement;

  const modal = document.createElement('protspace-publish-modal') as HTMLElement & {
    plotElement: HTMLElement;
    _state: Record<string, unknown>;
    _lastInsetRenderAt: number;
    _captureInsetRenders: (
      plotEl: unknown,
      state: unknown,
      plotRect: { w: number; h: number },
      bgColor: string,
      opts?: { forExport?: boolean },
    ) => Array<HTMLCanvasElement | null>;
  };
  modal.plotElement = fakePlotEl;
  document.body.appendChild(modal);
  // Mark "just rendered" so the 80ms fast-path is active.
  modal._lastInsetRenderAt = performance.now();
  modal._state = {
    insets: [
      {
        sourceRect: { x: 0, y: 0, w: 0.5, h: 0.5 },
        targetRect: { x: 0.5, y: 0.5, w: 0.4, h: 0.4 },
        border: 0,
        connector: 'none',
      },
    ],
  };
  // Reset captures from any initial render.
  captures.length = 0;

  modal._captureInsetRenders(fakePlotEl, modal._state, { w: 1000, h: 600 }, '#ffffff', {
    forExport: true,
  });

  // forExport must trigger a fresh render despite fast-path window.
  expect(captures.length).toBeGreaterThan(0);
  modal.remove();
});
```

- [ ] **Step 5.2: Run, verify failure**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-modal.test.ts -- --run
```

- [ ] **Step 5.3: Add the `opts` parameter to `_captureInsetRenders`**

In `publish-modal.ts:521`, change the signature:

```ts
private _captureInsetRenders(
  plotEl: CaptureablePlotElement,
  state: PublishState,
  plotRect: { w: number; h: number },
  bgColor: string,
  opts: { forExport?: boolean } = {},
): Array<HTMLCanvasElement | null> {
```

In the function body, find the line (currently around line 563):

```ts
const fastPath = now - this._lastInsetRenderAt < 80;
```

Change it to:

```ts
const fastPath = !opts.forExport && now - this._lastInsetRenderAt < 80;
```

- [ ] **Step 5.4: Pass `forExport: true` from `_handleExport`**

At `publish-modal.ts:724`, change:

```ts
const insetRenders = this._captureInsetRenders(plotEl, s, plotRect, bgColor);
```

to:

```ts
const insetRenders = this._captureInsetRenders(plotEl, s, plotRect, bgColor, { forExport: true });
```

- [ ] **Step 5.5: Run, verify green**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-modal.test.ts -- --run
```

- [ ] **Step 5.6: Commit**

```bash
git add packages/core/src/components/publish/publish-modal.ts packages/core/src/components/publish/publish-modal.test.ts
git commit -m "fix(publish): bypass inset render fast-path during export"
```

---

## Task 6: Guard `_applyStateAndRebuild` against post-disconnect resolution

**Why this matters:** `_applyStateAndRebuild` schedules `_setupOverlay` via `this.updateComplete.then(...)`. If the modal is closed before `updateComplete` resolves, the listener is re-attached after `disconnectedCallback` ran, leaking event handlers with no cleanup path.

**Files:**

- Modify: `packages/core/src/components/publish/publish-modal.ts:147-206, 774-784`
- Modify: `packages/core/src/components/publish/publish-modal.test.ts`

- [ ] **Step 6.1: Write a failing test**

Append to `publish-modal.test.ts`:

```ts
it('does not call _setupOverlay after disconnect during _applyStateAndRebuild', async () => {
  const modal = document.createElement('protspace-publish-modal') as HTMLElement & {
    _setupOverlay: () => void;
    _applyStateAndRebuild: (s: unknown) => void;
    _state: Record<string, unknown>;
    plotElement: HTMLElement;
  };
  modal.plotElement = document.createElement('div');
  document.body.appendChild(modal);
  let setupCalls = 0;
  const orig = modal._setupOverlay.bind(modal);
  modal._setupOverlay = () => {
    setupCalls++;
    orig();
  };

  // Trigger the rebuild and immediately disconnect.
  modal._applyStateAndRebuild({ ...modal._state });
  modal.remove();

  // Wait two microtask ticks for any pending `updateComplete.then(...)` to drain.
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => requestAnimationFrame(r));

  expect(setupCalls).toBe(0);
});
```

- [ ] **Step 6.2: Run, verify failure**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-modal.test.ts -- --run
```

- [ ] **Step 6.3: Add a `_disposed` flag and gate the `.then` callback**

In `publish-modal.ts`, add a private field near other private fields (around line 175-179):

```ts
private _disposed = false;
```

In `connectedCallback` (line 181), add at the top:

```ts
this._disposed = false;
```

In `disconnectedCallback` (line 199), add as the first line inside the body:

```ts
this._disposed = true;
```

In `_applyStateAndRebuild` (line 783), change:

```ts
this.updateComplete.then(() => this._setupOverlay());
```

to:

```ts
this.updateComplete.then(() => {
  if (this._disposed) return;
  this._setupOverlay();
});
```

- [ ] **Step 6.4: Run, verify green**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-modal.test.ts -- --run
```

- [ ] **Step 6.5: Commit**

```bash
git add packages/core/src/components/publish/publish-modal.ts packages/core/src/components/publish/publish-modal.test.ts
git commit -m "fix(publish): guard _setupOverlay against post-disconnect resolution"
```

---

## Task 7: Preset application updates `sizeMode`

**Why this matters:** `_applyPreset` writes `widthPx`/`heightPx`/`dpi`/`resample` but leaves `sizeMode` at its previous value. The `widthLocked` UI logic in `_renderDimensionsSection` then treats the preset as if the UI mode hadn't changed.

**Files:**

- Modify: `packages/core/src/components/publish/publish-modal.ts:481-507`
- Modify: `packages/core/src/components/publish/publish-modal.test.ts`

- [ ] **Step 7.1: Write a failing test**

Append to `publish-modal.test.ts`:

```ts
it('switches sizeMode to flexible when applying a custom-aspect preset', async () => {
  const modal = document.createElement('protspace-publish-modal') as HTMLElement & {
    _state: { sizeMode: string; preset: string };
    _applyPreset: (id: string) => void;
  };
  document.body.appendChild(modal);
  modal._state = { ...modal._state, sizeMode: '2-column' };
  modal._applyPreset('nature-1col'); // any 1-column preset id from JOURNAL_PRESETS
  expect(modal._state.sizeMode).toBe('1-column');
  modal.remove();
});
```

> If the preset id `'nature-1col'` isn't valid, look up a real id by reading `packages/core/src/components/publish/journal-presets.ts` first and substitute the correct id (e.g. for any preset whose `widthMm === 89`).

- [ ] **Step 7.2: Run, verify failure**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-modal.test.ts -- --run
```

- [ ] **Step 7.3: Update `_applyPreset` to derive `sizeMode` from the preset's `widthMm`**

In `publish-modal.ts:481-507`, replace the `_applyPreset` body to also patch `sizeMode`:

```ts
private _applyPreset(presetId: PresetId) {
  const patch = computePresetApplication(presetId);
  if (!patch) return;
  const wasResampleOff = !this._state.resample;
  const aspect = this._state.widthPx > 0 ? this._state.heightPx / this._state.widthPx : 1;
  let heightPx = Math.max(1, Math.round(patch.widthPx * aspect));
  const preset = getPreset(presetId);
  if (preset?.maxHeightMm !== undefined) {
    const maxPx = mmToPx(preset.maxHeightMm, preset.dpi);
    heightPx = Math.min(heightPx, maxPx);
  }
  // Match the preset's mm width to the corresponding sizeMode so the UI's
  // width-locked logic stays consistent with the dimensions being applied.
  let sizeMode = this._state.sizeMode;
  if (preset?.widthMm === SIZE_MODE_WIDTH_MM['1-column']) sizeMode = '1-column';
  else if (preset?.widthMm === SIZE_MODE_WIDTH_MM['2-column']) sizeMode = '2-column';
  else if (preset?.widthMm === undefined) sizeMode = 'flexible';
  this._state = {
    ...this._state,
    ...patch,
    heightPx,
    sizeMode,
  };
  this._plotCacheKey = '';
  this._showResampleNote = wasResampleOff;
}
```

Add the import of `SIZE_MODE_WIDTH_MM` at the top of the file alongside the existing `dimension-utils` imports.

- [ ] **Step 7.4: Run, verify green**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-modal.test.ts -- --run
```

- [ ] **Step 7.5: Commit**

```bash
git add packages/core/src/components/publish/publish-modal.ts packages/core/src/components/publish/publish-modal.test.ts
git commit -m "fix(publish): align sizeMode with applied preset"
```

---

## Task 8: DRY `25.4` and remove stale planning comments

**Why this matters:** The PR description claimed "DRY: deduplicate mmToPx/pxToMm" but several call sites still inline `25.4`. The repo's CLAUDE.md says "no comments unless necessary"; the multi-line planning notes in `publish-modal.ts:165-179` describing the inset fast-path strategy are design-time artifacts, not code-context.

**Files (refactor — no behavior change):**

- Modify: `packages/core/src/components/publish/publish-modal-helpers.ts:67, 103`
- Modify: `app/src/explore/export-handler.ts:126-127`
- Modify: `packages/core/src/components/publish/publish-modal.ts:165-179`

- [ ] **Step 8.1: Verify the existing test suite passes (baseline)**

```bash
pnpm --filter @protspace/core test src/components/publish -- --run
pnpm --filter app test -- --run
```

Note any current failures so we don't conflate them with the refactor.

- [ ] **Step 8.2: Replace inline `25.4` in `publish-modal-helpers.ts`**

At line 67, change:

```ts
const dpi = Math.max(1, Math.round((state.widthPx * 25.4) / widthMm));
```

to:

```ts
const dpi = Math.max(1, adjustDpiForWidthMm(state.widthPx, widthMm));
```

At line 103, change:

```ts
const dpi = Math.max(1, Math.round((state.heightPx * 25.4) / heightMm));
```

to:

```ts
const dpi = Math.max(1, adjustDpiForWidthMm(state.heightPx, heightMm));
```

(`adjustDpiForWidthMm` already does `Math.round((px * 25.4) / mm)` and is exported from `dimension-utils.ts:42-44`. Add it to the existing `import` from `./dimension-utils` at line 13.)

- [ ] **Step 8.3: Replace inline `25.4` in `export-handler.ts`**

At `app/src/explore/export-handler.ts:126-127`, change:

```ts
const widthMm = (canvas.width * 25.4) / state.dpi;
const heightMm = (canvas.height * 25.4) / state.dpi;
```

to:

```ts
const widthMm = pxToMm(canvas.width, state.dpi);
const heightMm = pxToMm(canvas.height, state.dpi);
```

`pxToMm` is already re-exported from `packages/core/src/components/publish/index.ts:16` (verified). Add `import { pxToMm } from '@protspace/core';` to `export-handler.ts`.

- [ ] **Step 8.4: Remove the stale planning comments in `publish-modal.ts:165-179`**

The block currently reads:

```ts
/** Per-inset geometric capture cache. Keyed by sourceRect + target dims +
 *  plotRect dims + dot scale + bgColor — renders at the target rect's
 *  exact pixel dims so dot pixel sizes map 1:1 to display. */
private _insetRenderCache = new Map<string, HTMLCanvasElement>();
/** Last WebGL-rendered canvas per inset index. Used as a stretchable
 *  fallback during high-frequency state updates (drag-resize) to skip
 *  the ~15–30 ms WebGL context setup + shader compile per frame. The
 *  compositor's drawImage stretches it to the live target rect — minor
 *  blur during drag, replaced by a fresh render once activity settles. */
private _lastInsetCanvases: Array<HTMLCanvasElement | null> = [];
private _lastInsetRenderAt = 0;
/** When fastPath skipped a render, fire a follow-up rAF tick after the
 *  user stops moving so we replace the stretched cache with a fresh,
 *  full-resolution render. */
private _settleTimer: ReturnType<typeof setTimeout> | null = null;
```

Replace with one-line annotations only where the _why_ is non-obvious:

```ts
private _insetRenderCache = new Map<string, HTMLCanvasElement>();
/** Stretchable fallback during drag — saves ~15–30 ms WebGL setup per frame. */
private _lastInsetCanvases: Array<HTMLCanvasElement | null> = [];
private _lastInsetRenderAt = 0;
private _settleTimer: ReturnType<typeof setTimeout> | null = null;
```

- [ ] **Step 8.5: Run precommit**

```bash
pnpm precommit
```

Expected: green. (No behavior change — same arithmetic.)

- [ ] **Step 8.6: Commit**

```bash
git add packages/core/src/components/publish/publish-modal-helpers.ts packages/core/src/components/publish/publish-modal.ts app/src/explore/export-handler.ts packages/core/src/components/publish/index.ts
git commit -m "refactor(publish): DRY 25.4 conversions, prune stale comments"
```

---

## Task 9: Remove dead `colYOffsets` first pass in legend layout

**Why this matters:** `publish-compositor.ts:233-243` initialises `colYOffsets` with the conditional `lineCounts[i - columns >= 0 ? i : i]` (always `lineCounts[i]` — no-op) and then immediately overwrites the values with the second pass at lines 246-256. The first pass is dead code that misleads readers.

**Files (pure refactor):**

- Modify: `packages/core/src/components/publish/publish-compositor.ts:232-256`

- [ ] **Step 9.1: Verify the compositor tests pass (baseline)**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-compositor.test.ts -- --run
```

- [ ] **Step 9.2: Delete the dead first pass**

Replace lines 232-256 with just the second (correct) pass:

```ts
// Compute cumulative Y offsets per column from each item's actual height.
const colYOffsets: number[][] = Array.from({ length: columns }, () => []);
for (let col = 0; col < columns; col++) {
  let y = 0;
  for (let row = 0; row < itemsPerCol; row++) {
    const i = col * itemsPerCol + row;
    if (i >= renderItems.length) break;
    colYOffsets[col][row] = y;
    const lines = lineCounts[i];
    const thisItemH = Math.max(itemHeight, lines * lineHeight + itemPadding * 2);
    y += thisItemH;
  }
}
```

- [ ] **Step 9.3: Run the compositor tests**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-compositor.test.ts -- --run
```

Expected: still green (the first pass produced wrong numbers anyway, so its removal cannot regress visible behavior).

- [ ] **Step 9.4: Run precommit**

```bash
pnpm precommit
```

- [ ] **Step 9.5: Commit**

```bash
git add packages/core/src/components/publish/publish-compositor.ts
git commit -m "refactor(publish): remove dead first pass in legend Y-offset computation"
```

---

## Task 10: HiDPI-aware fallback in `capturePlotCanvas`

**Why this matters:** When `captureAtResolution` is unavailable, the fallback at `publish-compositor.ts:67-77` does `ctx.drawImage(existing, 0, 0, opts.width, opts.height)` — but `existing.width` / `existing.height` are physical pixels and `opts.width` / `opts.height` are CSS pixels. On Retina (DPR=2) the source's native size is twice the CSS rect, but `drawImage` here scales it to the output rect, halving effective resolution.

The fix: use the source canvas's natural pixel size as the source rect rather than relying on the implicit "full source → full destination" form.

**Files:**

- Modify: `packages/core/src/components/publish/publish-compositor.ts:50-86`
- Modify: `packages/core/src/components/publish/publish-compositor.test.ts`

- [ ] **Step 10.1: Write a failing test**

Append to `publish-compositor.test.ts`:

```ts
it('fallback uses the source canvas at full pixel size (no DPR halving)', () => {
  // Simulate a HiDPI-rendered live canvas: the live canvas is 800×600 physical
  // pixels but visually represents a 400×300 CSS rect.
  const existing = document.createElement('canvas');
  existing.width = 800;
  existing.height = 600;
  // Fill with a pattern that lets us detect downscale-then-upscale.
  const liveCtx = existing.getContext('2d')!;
  liveCtx.fillStyle = '#ff00ff';
  liveCtx.fillRect(0, 0, 800, 600);

  // Plot element exposes only the live canvas (no captureAtResolution).
  const plotEl = document.createElement('div');
  plotEl.appendChild(existing);

  const out = capturePlotCanvas(plotEl as HTMLElement, {
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
  });
  expect(out.width).toBe(800);
  expect(out.height).toBe(600);
  // Sample a pixel — should be magenta from the source, not blended.
  const sample = out.getContext('2d')!.getImageData(400, 300, 1, 1).data;
  expect(sample[0]).toBe(0xff);
  expect(sample[1]).toBe(0x00);
  expect(sample[2]).toBe(0xff);
});
```

- [ ] **Step 10.2: Run, verify it fails**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-compositor.test.ts -- --run
```

(In the current code, the test should still pass for this specific case because `existing.width === opts.width`. Add an additional case where the source canvas is 2× the requested width:)

```ts
it('fallback samples the full source rect when source is HiDPI (2× CSS width)', () => {
  const existing = document.createElement('canvas');
  existing.width = 1600;
  existing.height = 1200;
  const liveCtx = existing.getContext('2d')!;
  // Top-left quadrant red; everything else green. Visible only if drawImage
  // sees the *whole* source rect, not just (0,0,opts.width,opts.height).
  liveCtx.fillStyle = '#00ff00';
  liveCtx.fillRect(0, 0, 1600, 1200);
  liveCtx.fillStyle = '#ff0000';
  liveCtx.fillRect(0, 0, 800, 600);
  const plotEl = document.createElement('div');
  plotEl.appendChild(existing);

  const out = capturePlotCanvas(plotEl as HTMLElement, {
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
  });
  // The bottom-right of `out` should sample the green region of the
  // (full) source canvas — only true when the fallback explicitly passes
  // the source's full pixel rect.
  const sample = out.getContext('2d')!.getImageData(700, 500, 1, 1).data;
  expect(sample[0]).toBe(0x00);
  expect(sample[1]).toBe(0xff);
  expect(sample[2]).toBe(0x00);
});
```

- [ ] **Step 10.3: Apply the fix**

In `packages/core/src/components/publish/publish-compositor.ts:67-77`, replace:

```ts
const existing = plotEl.querySelector('canvas') as HTMLCanvasElement | null;
if (existing) {
  const out = document.createElement('canvas');
  out.width = opts.width;
  out.height = opts.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, opts.width, opts.height);
  ctx.drawImage(existing, 0, 0, opts.width, opts.height);
  return out;
}
```

with:

```ts
const existing = plotEl.querySelector('canvas') as HTMLCanvasElement | null;
if (existing) {
  const out = document.createElement('canvas');
  out.width = opts.width;
  out.height = opts.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(0, 0, opts.width, opts.height);
  // Use the full source pixel rect explicitly so HiDPI live canvases
  // (where existing.width > opts.width) aren't silently halved.
  ctx.drawImage(existing, 0, 0, existing.width, existing.height, 0, 0, opts.width, opts.height);
  return out;
}
```

- [ ] **Step 10.4: Run, verify green**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-compositor.test.ts -- --run
```

- [ ] **Step 10.5: Commit**

```bash
git add packages/core/src/components/publish/publish-compositor.ts packages/core/src/components/publish/publish-compositor.test.ts
git commit -m "fix(publish): preserve HiDPI source resolution in capture fallback"
```

---

## Task 11: Null-check + area cap on `composeFigure` output canvas

**Why this matters:** `composeFigure` does `outCanvas.getContext('2d')!` (line 804). The non-null assertion will throw on canvas-allocation failure. The validator caps each axis at 8192 px, but doesn't cap area — 8192² = 67 Mpx is allowed. We should fail soft (no-op draw) rather than crash.

**Files:**

- Modify: `packages/core/src/components/publish/publish-compositor.ts:802-813`
- Modify: `packages/core/src/components/publish/publish-compositor.test.ts`

- [ ] **Step 11.1: Write a failing test**

Append to `publish-compositor.test.ts`:

```ts
it('composeFigure does not throw when getContext returns null', () => {
  const out = document.createElement('canvas');
  out.width = 100;
  out.height = 100;
  // Force getContext to return null.
  const orig = out.getContext;
  (out as unknown as { getContext: typeof out.getContext }).getContext = () => null;
  expect(() =>
    composeFigure(out, {
      state: createDefaultPublishState(),
      plotCanvas: document.createElement('canvas'),
      legendItems: [],
      legendTitle: '',
    }),
  ).not.toThrow();
  // Restore.
  (out as unknown as { getContext: typeof out.getContext }).getContext = orig;
});
```

(Import `createDefaultPublishState` from `./publish-state` if not already.)

- [ ] **Step 11.2: Run, verify failure**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-compositor.test.ts -- --run
```

- [ ] **Step 11.3: Replace the non-null assertion**

In `publish-compositor.ts:802-813`, change the head of `composeFigure`:

```ts
export function composeFigure(outCanvas: HTMLCanvasElement, opts: CompositeOptions): void {
  const { state, plotCanvas, legendItems, legendTitle } = opts;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) {
    console.warn('composeFigure: 2D context unavailable; skipping render');
    return;
  }
  const W = outCanvas.width;
  const H = outCanvas.height;
```

- [ ] **Step 11.4: Run, verify green**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-compositor.test.ts -- --run
```

- [ ] **Step 11.5: Commit**

```bash
git add packages/core/src/components/publish/publish-compositor.ts packages/core/src/components/publish/publish-compositor.test.ts
git commit -m "fix(publish): handle null 2D context in composeFigure"
```

---

## Task 12: Don't close the modal on export failure

**Why this matters:** `app/src/explore/export-handler.ts:149` runs `modal.remove()` unconditionally after the `try/catch`. State _is_ persisted at line 121 before the export, so no work is lost — but the user is silently kicked out of the editor and has to reopen + re-orient. Better: keep the modal open on failure so they can retry.

**Files:**

- Modify: `app/src/explore/export-handler.ts:120-150`

- [ ] **Step 12.1: Verification approach**

This change is a small structural refactor — moving `modal.remove()` from after the `try/catch` into the success branch only. The cleanest verification is **manual browser** plus the added e2e in Task 14 covering the success path. No unit test added here:

- The success path is covered by the new export e2e in Task 14 (modal disappears after successful download).
- The failure path is verified manually in Step 12.3.

If a regression-test harness is desired later, add a vitest spec at `app/src/explore/export-handler.test.ts` that constructs a stub modal, dispatches `publish-export` with a canvas whose `toBlob` rejects, and asserts the stub is still attached to the document. That's optional — flag it in the commit message rather than adding it now (YAGNI).

- [ ] **Step 12.2: Apply the fix**

In `app/src/explore/export-handler.ts:120-150`, restructure so `modal.remove()` only runs on success:

```ts
try {
  const fname = generateFilename(state.format);
  if (state.format === 'pdf') {
    const widthMm = pxToMm(canvas.width, state.dpi);
    const heightMm = pxToMm(canvas.height, state.dpi);
    await exportCanvasAsPdf(canvas, { widthMm, heightMm, filename: fname });
  } else {
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob produced no blob'))),
        'image/png',
      );
    });
    const withDpi = await pngWithDpi(blob, state.dpi);
    const url = URL.createObjectURL(withDpi);
    try {
      downloadFile(url, fname);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  notify.success(getExportSuccessNotification(fname));
  modal.remove();
} catch (err) {
  console.error('Publish export failed:', err);
  notify.error(getExportFailureNotification(err));
  // Leave the modal open so the user can retry without losing context.
}
```

(`pxToMm` import is added in Task 8 — if Task 8 hasn't landed yet, do that first or inline `(canvas.width * 25.4) / state.dpi` until it lands.)

- [ ] **Step 12.3: Manual browser verification**

Per `feedback_browser_verification.md`: verify in a real browser that a forced export failure leaves the modal open and the success path still removes it.

```bash
pnpm dev
# In the browser: open the Figure Editor, click Export.
# Then in the browser console, hook console.error and force a failure
# by editing localStorage to corrupt the bundle, or temporarily monkeypatch
# `pngWithDpi` to throw. Confirm the modal stays mounted on failure.
```

Document what was verified in the commit message.

- [ ] **Step 12.4: Run precommit**

```bash
pnpm precommit
```

- [ ] **Step 12.5: Commit**

```bash
git add app/src/explore/export-handler.ts app/tests/figure-editor.spec.ts
git commit -m "fix(publish): keep editor open when export fails"
```

---

## Task 13: Replace tautological tests in `export-utils.test.ts`

**Why this matters:** Three test suites at `:114-156`, `:247-267`, `:296-338` test JavaScript identity (`undefined ?? true`) or hardcoded local consts that are never imported from the module. They inflate the test count without catching any real regression.

**Files:**

- Modify: `packages/utils/src/visualization/export-utils.test.ts:114-156, 247-267, 296-338`

**Confirmed up front (verified):** `export-utils.ts` does not export `MAX_CANVAS_DIMENSION`, `MAX_CANVAS_AREA`, `SAFE_DIMENSION_MARGIN`, or `getOptionsWithDefaults`. Public exports are `ProtSpaceExporter`, `createExporter`, `exportUtils`, `exportCanvasAsPdf`, and the type interfaces. So the right fix is **delete** the three tautological suites — they cannot be replaced with meaningful assertions against the public surface.

- [ ] **Step 13.1: Delete `describe('Export dimension calculations', …)` at lines 114-156**

Remove the whole `describe('Export dimension calculations', ...)` block. The math it asserts is implementation detail of `ProtSpaceExporter` private methods — there is no public hook to exercise it without re-implementing the formula in the test, which is what the current tests do.

- [ ] **Step 13.2: Delete `describe('getOptionsWithDefaults includeLegend behavior', …)` at lines 247-267**

The three tests inside (`should default includeLegend to true when not specified`, `should respect explicit false`, `should respect explicit true`) are pure JavaScript-operator identity checks (`undefined ?? true === true`). Delete the entire `describe` block.

- [ ] **Step 13.3: Delete `describe('Export constants', …)` at lines 296-338**

Hardcoded local constants asserted against themselves. Delete the entire `describe` block.

- [ ] **Step 13.4: Verify the remaining tests still cover real behavior**

After the deletions, confirm the `describe('ProtSpaceExporter.validateCanvasDimensions', ...)` and `describe('Export filename generation', ...)` blocks remain — those test real exported behavior and stay.

- [ ] **Step 13.5: Run the test file**

```bash
pnpm --filter @protspace/utils test src/visualization/export-utils.test.ts -- --run
```

Expected: green, with fewer (but more meaningful) tests.

- [ ] **Step 13.6: Commit**

```bash
git add packages/utils/src/visualization/export-utils.test.ts
git commit -m "test(utils): drop tautological export-utils suites"
```

---

## Task 14: End-to-end: verify the export actually downloads

**Why this matters:** `app/tests/figure-editor.spec.ts` covers inset rendering but never clicks "Export". The PR's headline feature has no E2E smoke test.

**Files:**

- Modify: `app/tests/figure-editor.spec.ts`

- [ ] **Step 14.1: Add a new Playwright test that clicks Export and waits for the download**

Append to `app/tests/figure-editor.spec.ts`:

```ts
test('exports a PNG with embedded DPI metadata', async ({ page }) => {
  await waitForExploreDataLoad(page);
  await dismissTourIfPresent(page);
  await openFigureEditor(page);

  // Set a small dimension to keep the test fast.
  await page.evaluate(() => {
    const m = document.querySelector('protspace-publish-modal') as
      | (HTMLElement & {
          _state: Record<string, unknown>;
          requestUpdate: () => void;
          _plotCacheKey: string;
        })
      | null;
    if (!m) throw new Error('publish modal not mounted');
    m._state = { ...(m._state as Record<string, unknown>), widthPx: 800, heightPx: 600, dpi: 150 };
    m._plotCacheKey = '';
    m.requestUpdate();
  });
  await page.waitForTimeout(300);

  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  // Click whichever button dispatches `publish-export`.
  await page.evaluate(() => {
    const m = document.querySelector('protspace-publish-modal') as HTMLElement | null;
    const btn = m?.shadowRoot?.querySelector(
      'button[data-action="export"], button.export, button[name="export"]',
    ) as HTMLButtonElement | null;
    if (btn) {
      btn.click();
    } else {
      // Fallback: dispatch the event the handler listens for.
      (m as HTMLElement)?.dispatchEvent(
        new CustomEvent('publish-export', {
          detail: {
            canvas: (() => {
              const c = document.createElement('canvas');
              c.width = 800;
              c.height = 600;
              return c;
            })(),
            state: { format: 'png', dpi: 150 },
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  });

  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  // Read the file back and verify the pHYs chunk is present and reflects 150 DPI.
  const fs = await import('node:fs');
  const buf = fs.readFileSync(path!);
  // Look for 'pHYs' tag bytes in the first ~200 bytes.
  const tag = Buffer.from('pHYs', 'ascii');
  expect(buf.indexOf(tag)).toBeGreaterThan(-1);
  // Pixels-per-metre at 150 DPI = round(150 * 39.3700787) = 5906.
  const physOffset = buf.indexOf(tag);
  const ppm =
    (buf[physOffset + 4] << 24) |
    (buf[physOffset + 5] << 16) |
    (buf[physOffset + 6] << 8) |
    buf[physOffset + 7];
  expect(ppm >>> 0).toBe(5906);
});
```

- [ ] **Step 14.2: Run the e2e**

```bash
pnpm --filter app test:e2e --grep 'exports a PNG'
```

Adjust selectors if the export button uses a different attribute. Confirm the assertion against the live UI.

- [ ] **Step 14.3: Commit**

```bash
git add app/tests/figure-editor.spec.ts
git commit -m "test(publish): cover export-to-PNG end-to-end with DPI metadata check"
```

---

## Task 15: Hit-test rotated and zero-size overlays

**Why this matters:** `publish-overlay-controller.test.ts:295-404` covers axis-aligned hit-testing only. A rotated ellipse uses different geometry; a zero-size overlay (e.g. a degenerate drag that slipped past the creation guard) shouldn't be selectable.

**Files:**

- Modify: `packages/core/src/components/publish/publish-overlay-controller.test.ts`

- [ ] **Step 15.1: Add tests for rotation and zero-size**

Append to `publish-overlay-controller.test.ts` inside the existing `describe('select mode — hit testing and selection', …)` (mirrors the `createCallbacks`/`pointerEvent` harness already in the file):

```ts
it('hit-tests a rotated ellipse using its rotated frame, not the AABB', () => {
  // Elongated ellipse rotated 90°: visually rx=0.05 (vertical), ry=0.20 (horizontal).
  // A click at canvas (700, 250) — which would be inside the *unrotated* AABB
  // (bounded by cx ± 0.05·1000 = 450..550 horizontally) — sits on the rotated
  // major axis, so it must hit.
  const ellipse: Overlay = {
    type: 'circle',
    cx: 0.5,
    cy: 0.5,
    rx: 0.05, // 50px wide before rotation
    ry: 0.2, // 200px tall before rotation
    rotation: Math.PI / 2, // rotate 90° → effectively wide and short
    color: '#000',
    strokeWidth: 2,
  };
  callbacks.getOverlays.mockReturnValue([ellipse]);
  controller.tool = 'select';

  // After rotation, the ellipse stretches horizontally to ±200px around cx (300..700)
  // and vertically only ±25px around cy (225..275). Click at (680, 250) — well
  // inside the rotated ellipse, but outside the unrotated AABB.
  canvas.dispatchEvent(pointerEvent('pointerdown', 680, 250));
  canvas.dispatchEvent(pointerEvent('pointerup', 680, 250));

  expect(callbacks.onSelectionChanged).toHaveBeenCalledWith('overlay', 0);
});

it('does not hit-test a click far from a rotated ellipse', () => {
  const ellipse: Overlay = {
    type: 'circle',
    cx: 0.5,
    cy: 0.5,
    rx: 0.05,
    ry: 0.2,
    rotation: Math.PI / 2,
    color: '#000',
    strokeWidth: 2,
  };
  callbacks.getOverlays.mockReturnValue([ellipse]);
  controller.tool = 'select';

  // (500, 100) — far above the rotated ellipse's vertical reach (±25px around cy=250).
  canvas.dispatchEvent(pointerEvent('pointerdown', 500, 100));
  canvas.dispatchEvent(pointerEvent('pointerup', 500, 100));

  expect(callbacks.onSelectionChanged).toHaveBeenCalledWith(null, -1);
});

it('does not select a zero-size circle even when clicking its centre', () => {
  const degenerate: Overlay = {
    type: 'circle',
    cx: 0.5,
    cy: 0.5,
    rx: 0,
    ry: 0,
    rotation: 0,
    color: '#000',
    strokeWidth: 2,
  };
  callbacks.getOverlays.mockReturnValue([degenerate]);
  controller.tool = 'select';

  canvas.dispatchEvent(pointerEvent('pointerdown', 500, 250));
  canvas.dispatchEvent(pointerEvent('pointerup', 500, 250));

  expect(callbacks.onSelectionChanged).toHaveBeenCalledWith(null, -1);
});
```

The `controller`, `canvas`, and `callbacks` symbols are already declared in the suite's outer `describe` block (see lines 96-99 of the existing file). The `pointerEvent` helper is defined at line 85. No new harness needed.

- [ ] **Step 15.2: Run the tests, verify failure where the implementation under-tests rotation**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-overlay-controller.test.ts -- --run
```

Two outcomes are acceptable:

- **The tests fail** → the controller has a real hit-testing bug for rotated overlays. Fix it in `publish-overlay-controller.ts` (find the hit-test helper that takes the click point and overlay, transform the click into the overlay's rotated frame before the ellipse test). Add the implementation in this task.
- **The tests pass on first run** → great, leave them as regression coverage and note this in the commit.

- [ ] **Step 15.3: Commit**

```bash
git add packages/core/src/components/publish/publish-overlay-controller.test.ts packages/core/src/components/publish/publish-overlay-controller.ts
git commit -m "test(publish): cover rotated and zero-size overlay hit-testing"
```

---

## Task 16: Assert the fingerprint stale-warn renders in the modal DOM

**Why this matters:** `shouldShowFingerprintWarning` is unit-tested in `publish-modal-helpers.test.ts:266-296`, but `publish-modal.test.ts` never asserts that the warn UI element actually renders when the helper returns `true`. A regression that drops the conditional from the template would go uncaught.

**Files:**

- Modify: `packages/core/src/components/publish/publish-modal.test.ts`

- [ ] **Step 16.1: Add a test**

Append to `publish-modal.test.ts`:

```ts
it('renders the fingerprint stale warning when saved fingerprint mismatches current', async () => {
  const modal = document.createElement('protspace-publish-modal') as HTMLElement & {
    savedPublishState: Record<string, unknown>;
    currentProjection: { projection: string; dimensionality: number };
    updateComplete: Promise<unknown>;
  };
  modal.savedPublishState = {
    viewFingerprint: { projection: 'umap', dimensionality: 2 },
    overlays: [{ type: 'label', x: 0.5, y: 0.5, text: 'test', fontSize: 14, color: '#000' }],
  };
  modal.currentProjection = { projection: 'pca', dimensionality: 2 };
  document.body.appendChild(modal);
  await modal.updateComplete;
  // Selector chosen to match whatever the modal's stale-warn element uses.
  // Inspect publish-modal.ts render() for the actual class/data-attr — likely
  // .publish-fingerprint-warning or [data-warning="fingerprint"].
  const warn = modal.shadowRoot?.querySelector('.publish-warning');
  expect(warn).not.toBeNull();
  modal.remove();
});

it('does not render the fingerprint warning when fingerprints match', async () => {
  const modal = document.createElement('protspace-publish-modal') as HTMLElement & {
    savedPublishState: Record<string, unknown>;
    currentProjection: { projection: string; dimensionality: number };
    updateComplete: Promise<unknown>;
  };
  modal.savedPublishState = {
    viewFingerprint: { projection: 'umap', dimensionality: 2 },
    overlays: [],
  };
  modal.currentProjection = { projection: 'umap', dimensionality: 2 };
  document.body.appendChild(modal);
  await modal.updateComplete;
  const warn = modal.shadowRoot?.querySelector('.publish-warning');
  expect(warn).toBeNull();
  modal.remove();
});
```

The `.publish-warning` selector is unique to the fingerprint warning template in `publish-modal.ts:829` (verified — `_showResampleNote` uses a separate template at line 1136 with a different class).

- [ ] **Step 16.2: Run, verify both tests pass (or fail for a real reason)**

```bash
pnpm --filter @protspace/core test src/components/publish/publish-modal.test.ts -- --run
```

If the stale-warn DOM element isn't present despite `_showFingerprintWarning` being `true`, that's a real bug — fix the template in `publish-modal.ts` and re-run.

- [ ] **Step 16.3: Commit**

```bash
git add packages/core/src/components/publish/publish-modal.test.ts packages/core/src/components/publish/publish-modal.ts
git commit -m "test(publish): assert fingerprint warning renders when state is stale"
```

---

## Final verification

After all 16 tasks:

- [ ] **Run the full precommit suite**

```bash
pnpm precommit
```

- [ ] **Manual browser verification** (per the user's `feedback_browser_verification.md`)

```bash
pnpm dev
```

In the browser, exercise:

1. Open Figure Editor → toggle background white ↔ transparent → export at 600 DPI. Confirm the exported PNG matches the selected background (Task 4).
2. Open Figure Editor with insets → drag an inset → immediately click Export. Confirm the exported insets are at full resolution, not stretched preview-quality (Task 5).
3. Open Figure Editor → close immediately while an animation is mid-flight. Confirm no console errors about detached canvas operations (Task 6).
4. Open Figure Editor → apply a journal preset → confirm the size-mode UI matches the applied preset width (Task 7).
5. Force an export failure (corrupt localStorage state, monkeypatch `pngWithDpi`) → confirm the modal stays open and the user can retry (Task 12).

- [ ] **PR description update**

Edit PR #232's description to summarize the followup fixes (or open a new PR fix/publish-editor-review-fixes per user's PR-style memory: short, no test plan, no Claude footer).

---

## Appendix: Issue → Task mapping

| Review finding                                      | Severity  | Task |
| --------------------------------------------------- | --------- | ---- |
| Plot-cache key omits bg color                       | Critical  | 4    |
| Inset fast-path leaks preview-res into export       | Critical  | 5    |
| Race in `_applyStateAndRebuild` after disconnect    | Critical  | 6    |
| PNG signature not validated                         | Important | 1    |
| PNG length bounds not checked                       | Important | 1    |
| DRY 25.4 not honored                                | Important | 8    |
| Dead first pass in `colYOffsets`                    | Important | 9    |
| `sanitizeNormRect` slack tolerance leaks past [0,1] | Important | 2    |
| Preset application leaves `sizeMode` stale          | Important | 7    |
| Modal closes on export failure                      | Important | 12   |
| Unbounded label `text` length → quota DoS           | Important | 2    |
| HiDPI fallback halves resolution                    | Important | 10   |
| Non-null assertion on `getContext('2d')`            | Important | 11   |
| Stale planning comments                             | Minor     | 8    |
| `pngWithDpi` silent on malformed input              | Minor     | 1    |
| `publishState` untrusted at parquet boundary        | Minor     | 3    |
| No E2E export click                                 | Test gap  | 14   |
| Tautological tests in export-utils                  | Test gap  | 13   |
| CRC test is single-source                           | Test gap  | 1    |
| No prototype-pollution tests                        | Test gap  | 2    |
| No rotated/zero-size hit-test cases                 | Test gap  | 15   |
| Fingerprint stale-warn DOM not asserted             | Test gap  | 16   |
