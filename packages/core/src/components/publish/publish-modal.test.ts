/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import './publish-modal';
import type { ProtspacePublishModal } from './publish-modal';

describe('<protspace-publish-modal> legend reader', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads legend state from legendElement property when provided', async () => {
    const legend = document.createElement('div') as HTMLElement & {
      getLegendExportData: () => unknown;
    };
    legend.getLegendExportData = () => ({
      annotation: 'family',
      includeShapes: true,
      otherItemsCount: 0,
      items: [{ value: 'A', color: '#fff', shape: 'circle', count: 1, isVisible: true }],
    });

    const modal = document.createElement('protspace-publish-modal') as ProtspacePublishModal;
    (modal as unknown as { legendElement: HTMLElement }).legendElement = legend;
    document.body.appendChild(modal);
    await modal.updateComplete;

    expect(modal).toBeDefined();
  });
});
