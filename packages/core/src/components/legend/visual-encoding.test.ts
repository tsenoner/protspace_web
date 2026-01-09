import { describe, it, expect, beforeEach } from 'vitest';
import { getVisualEncoding, SlotTracker, SPECIAL_SLOTS } from './visual-encoding';

describe('visual-encoding', () => {
  describe('getVisualEncoding', () => {
    it('returns special color for Others category', () => {
      const encoding = getVisualEncoding(0, true, 'Others');
      expect(encoding.color).toBe('#999999');
      expect(encoding.shape).toBe('circle');
    });

    it('returns special color for N/A category', () => {
      const encoding = getVisualEncoding(0, true, 'N/A');
      expect(encoding.color).toBe('#DDDDDD');
      expect(encoding.shape).toBe('circle');
    });

    it('returns fallback for negative slots', () => {
      const encoding = getVisualEncoding(-1, true);
      expect(encoding.color).toBe('#999999');
      expect(encoding.shape).toBe('circle');
    });

    it('cycles through colors for regular categories', () => {
      const encoding0 = getVisualEncoding(0, false);
      const encoding1 = getVisualEncoding(1, false);
      expect(encoding0.color).not.toBe(encoding1.color);
    });

    it('uses circle shape when shapes disabled', () => {
      const encoding = getVisualEncoding(0, false);
      expect(encoding.shape).toBe('circle');
    });

    it('cycles through all 6 shapes when enabled', () => {
      const shapes = new Set<string>();
      for (let i = 0; i < 6; i++) {
        shapes.add(getVisualEncoding(i, true).shape);
      }
      expect(shapes.size).toBe(6);
    });

    it('wraps around colors after palette exhausted', () => {
      const colors: string[] = [];
      for (let i = 0; i < 50; i++) {
        colors.push(getVisualEncoding(i, false).color);
      }
      const firstColor = colors[0];
      const repeatIndex = colors.findIndex((c, i) => i > 0 && c === firstColor);
      expect(repeatIndex).toBeGreaterThan(0);
    });

    it('wraps around shapes after 6', () => {
      const encoding0 = getVisualEncoding(0, true);
      const encoding6 = getVisualEncoding(6, true);
      expect(encoding0.shape).toBe(encoding6.shape);
    });
  });

  describe('SlotTracker', () => {
    let tracker: SlotTracker;

    beforeEach(() => {
      tracker = new SlotTracker();
    });

    describe('getSlot', () => {
      it('returns special slots for Others and N/A', () => {
        expect(tracker.getSlot('Others')).toBe(SPECIAL_SLOTS.OTHERS);
        expect(tracker.getSlot('N/A')).toBe(SPECIAL_SLOTS.NA);
      });

      it('assigns incrementing slots to new categories', () => {
        expect(tracker.getSlot('category1')).toBe(0);
        expect(tracker.getSlot('category2')).toBe(1);
        expect(tracker.getSlot('category3')).toBe(2);
      });

      it('returns same slot for same category', () => {
        const slot1 = tracker.getSlot('category1');
        const slot2 = tracker.getSlot('category1');
        expect(slot1).toBe(slot2);
      });

      it('reuses freed slots', () => {
        tracker.getSlot('category1'); // slot 0
        tracker.getSlot('category2'); // slot 1
        tracker.freeSlot('category1');
        expect(tracker.getSlot('category3')).toBe(0); // reuses slot 0
      });
    });

    describe('freeSlot', () => {
      it('does not free special categories', () => {
        tracker.freeSlot('Others');
        tracker.freeSlot('N/A');
        expect(tracker.getSlot('newCategory')).toBe(0);
      });

      it('maintains sorted order of freed slots', () => {
        tracker.getSlot('a'); // 0
        tracker.getSlot('b'); // 1
        tracker.getSlot('c'); // 2
        tracker.freeSlot('c'); // free 2
        tracker.freeSlot('a'); // free 0
        expect(tracker.getSlot('new1')).toBe(0);
        expect(tracker.getSlot('new2')).toBe(2);
      });
    });

    describe('reassignSlots', () => {
      it('assigns slots in order to visible categories', () => {
        tracker.reassignSlots(['cat1', 'cat2', 'cat3']);
        expect(tracker.getSlot('cat1')).toBe(0);
        expect(tracker.getSlot('cat2')).toBe(1);
        expect(tracker.getSlot('cat3')).toBe(2);
      });

      it('ignores special categories', () => {
        tracker.reassignSlots(['cat1', 'Others', 'N/A', 'Other']);
        expect(tracker.getSlot('cat1')).toBe(0);
        expect(tracker.getSlot('Others')).toBe(SPECIAL_SLOTS.OTHERS);
        expect(tracker.getSlot('N/A')).toBe(SPECIAL_SLOTS.NA);
      });
    });

    describe('reset', () => {
      it('clears all assigned slots', () => {
        tracker.getSlot('category1');
        tracker.getSlot('category2');
        tracker.reset();
        expect(tracker.isEmpty()).toBe(true);
        expect(tracker.getSlot('newCategory')).toBe(0);
      });
    });

    describe('isEmpty', () => {
      it('returns true for new tracker', () => {
        expect(tracker.isEmpty()).toBe(true);
      });

      it('returns false after assigning a slot', () => {
        tracker.getSlot('category1');
        expect(tracker.isEmpty()).toBe(false);
      });

      it('returns true when only special categories requested', () => {
        tracker.getSlot('Others');
        tracker.getSlot('N/A');
        expect(tracker.isEmpty()).toBe(true);
      });
    });
  });
});
