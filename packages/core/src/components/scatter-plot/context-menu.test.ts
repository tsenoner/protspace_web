// packages/core/src/components/scatter-plot/context-menu.test.ts
import { describe, it, expect } from 'vitest';
import type { ContextMenuAction } from './annotation-types';
import { resolveMenuItems } from './context-menu';

describe('context-menu', () => {
  describe('resolveMenuItems', () => {
    it('returns point actions when a point is hit', () => {
      const items = resolveMenuItems({
        proteinId: 'P0DM09',
        hasAccession: true,
        dataCoords: [10, 20],
      });
      const types = items.map((i) => i.action.type);
      expect(types).toContain('indicate');
      expect(types).toContain('select');
      expect(types).toContain('copy-id');
      expect(types).toContain('view-uniprot');
    });

    it('disables view-uniprot when no accession', () => {
      const items = resolveMenuItems({
        proteinId: 'custom_001',
        hasAccession: false,
        dataCoords: [10, 20],
      });
      const uniprotItem = items.find((i) => i.action.type === 'view-uniprot');
      expect(uniprotItem?.disabled).toBe(true);
    });

    it('returns empty-space actions when no point is hit', () => {
      const items = resolveMenuItems(null);
      const types = items.map((i) => i.action.type);
      expect(types).toContain('add-inset');
      expect(types).not.toContain('indicate');
      expect(types).not.toContain('select');
    });
  });
});
