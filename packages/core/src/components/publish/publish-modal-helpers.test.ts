import { describe, it, expect } from 'vitest';
import {
  getActivePresetConstraints,
  computeWidthUpdate,
  computeHeightUpdate,
  computeDpiUpdate,
  computePresetApplication,
  shouldShowFingerprintWarning,
} from './publish-modal-helpers';
import { createDefaultPublishState, type PublishState } from './publish-state';

function makeState(overrides: Partial<PublishState> = {}): PublishState {
  return { ...createDefaultPublishState(), ...overrides };
}

describe('publish-modal-helpers', () => {
  describe('getActivePresetConstraints', () => {
    it('returns mm constraints for a mm-based preset', () => {
      const state = makeState({ preset: 'nature-1col' });
      const result = getActivePresetConstraints(state);
      expect(result).not.toBeNull();
      expect(result!.widthMm).toBe(89);
      expect(result!.maxHeightMm).toBe(247);
    });

    it('returns null for a px-based preset', () => {
      const state = makeState({ preset: 'slide-16-9' });
      const result = getActivePresetConstraints(state);
      expect(result).toBeNull();
    });

    it('returns null for custom preset', () => {
      const state = makeState({ preset: 'custom' });
      const result = getActivePresetConstraints(state);
      expect(result).toBeNull();
    });

    it('returns null for unknown preset', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = makeState({ preset: 'nonexistent' as any });
      const result = getActivePresetConstraints(state);
      expect(result).toBeNull();
    });
  });

  describe('computeWidthUpdate', () => {
    it('adjusts DPI for constrained preset', () => {
      const state = makeState({ preset: 'nature-1col', widthPx: 1051, dpi: 300 });
      const patch = computeWidthUpdate(state, 2000);
      expect(patch.widthPx).toBe(2000);
      expect(patch.dpi).toBeDefined();
      expect(patch.dpi).toBeCloseTo(571, 0);
      expect(patch.preset).toBeUndefined();
    });

    it('switches to custom for unconstrained preset', () => {
      const state = makeState({ preset: 'flexible', widthPx: 2048 });
      const patch = computeWidthUpdate(state, 3000);
      expect(patch.widthPx).toBe(3000);
      expect(patch.preset).toBe('custom');
    });

    it('clamps height when constrained preset has maxHeightMm', () => {
      const state = makeState({ preset: 'nature-1col', widthPx: 1051, heightPx: 6000, dpi: 300 });
      const patch = computeWidthUpdate(state, 2000);
      expect(patch.heightPx).toBeDefined();
      expect(patch.heightPx!).toBeLessThan(6000);
    });
  });

  describe('computeHeightUpdate', () => {
    it('returns height directly for unconstrained preset', () => {
      const state = makeState({ preset: 'flexible', heightPx: 1024 });
      const patch = computeHeightUpdate(state, 2000);
      expect(patch.heightPx).toBe(2000);
    });

    it('clamps to maxHeightMm for constrained preset', () => {
      const state = makeState({ preset: 'nature-1col', dpi: 300, heightPx: 1000 });
      const patch = computeHeightUpdate(state, 5000);
      expect(patch.heightPx).toBeLessThanOrEqual(2917);
    });

    it('does not clamp when within limits', () => {
      const state = makeState({ preset: 'nature-1col', dpi: 300, heightPx: 1000 });
      const patch = computeHeightUpdate(state, 1500);
      expect(patch.heightPx).toBe(1500);
    });
  });

  describe('computeDpiUpdate', () => {
    it('recalculates px dimensions for constrained preset', () => {
      const state = makeState({ preset: 'nature-1col', dpi: 300, widthPx: 1051 });
      const patch = computeDpiUpdate(state, 600);
      expect(patch.dpi).toBe(600);
      expect(patch.widthPx).toBe(2102);
    });

    it('switches to custom for unconstrained preset', () => {
      const state = makeState({ preset: 'flexible', dpi: 300 });
      const patch = computeDpiUpdate(state, 150);
      expect(patch.dpi).toBe(150);
      expect(patch.preset).toBe('custom');
    });

    it('clamps height for constrained preset with maxHeightMm', () => {
      const state = makeState({ preset: 'nature-1col', dpi: 300, heightPx: 5000 });
      const patch = computeDpiUpdate(state, 600);
      expect(patch.heightPx).toBeDefined();
      expect(patch.heightPx!).toBeLessThanOrEqual(5835);
    });
  });

  describe('computePresetApplication', () => {
    it('resolves a mm-based preset to pixel dimensions', () => {
      const patch = computePresetApplication('nature-1col');
      expect(patch).not.toBeNull();
      expect(patch!.preset).toBe('nature-1col');
      expect(patch!.widthPx).toBe(1051);
      expect(patch!.dpi).toBe(300);
    });

    it('resolves a px-based preset', () => {
      const patch = computePresetApplication('slide-16-9');
      expect(patch).not.toBeNull();
      expect(patch!.preset).toBe('slide-16-9');
      expect(patch!.widthPx).toBeDefined();
      expect(patch!.dpi).toBeDefined();
    });

    it('returns null for unknown preset', () => {
      const patch = computePresetApplication('nonexistent');
      expect(patch).toBeNull();
    });
  });

  describe('shouldShowFingerprintWarning', () => {
    it('returns false when no saved fingerprint', () => {
      expect(
        shouldShowFingerprintWarning(undefined, { projection: 'UMAP', dimensionality: 2 }),
      ).toBe(false);
    });

    it('returns false when fingerprints match', () => {
      const fp = { projection: 'UMAP', dimensionality: 2 };
      expect(shouldShowFingerprintWarning(fp, { projection: 'UMAP', dimensionality: 2 })).toBe(
        false,
      );
    });

    it('returns true when projection differs', () => {
      const saved = { projection: 'UMAP', dimensionality: 2 };
      const current = { projection: 'PCA', dimensionality: 2 };
      expect(shouldShowFingerprintWarning(saved, current)).toBe(true);
    });

    it('returns true when dimensionality differs', () => {
      const saved = { projection: 'UMAP', dimensionality: 2 };
      const current = { projection: 'UMAP', dimensionality: 3 };
      expect(shouldShowFingerprintWarning(saved, current)).toBe(true);
    });

    it('returns false when current projection is null', () => {
      const saved = { projection: 'UMAP', dimensionality: 2 };
      expect(shouldShowFingerprintWarning(saved, null)).toBe(false);
    });
  });
});
