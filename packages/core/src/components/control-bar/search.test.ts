import { describe, it, expect } from 'vitest';

/**
 * Filter protein IDs based on search query
 * (Extracted logic from component for testing)
 */
export function filterProteinIds(
  availableIds: string[],
  query: string,
  selectedIds: string[] = [],
): string[] {
  const q = query.trim().toLowerCase();
  const selectedSet = new Set(selectedIds);

  if (!q) {
    // Return all available (not selected) if no query
    return availableIds.filter((id) => !selectedSet.has(id));
  }

  // Filter by startsWith match, excluding already selected
  return availableIds.filter((id) => !selectedSet.has(id) && id.toLowerCase().startsWith(q));
}

/**
 * Validate and normalize a protein ID against available IDs
 */
export function validateProteinId(
  id: string,
  availableIds: string[],
): { valid: boolean; normalizedId: string | null } {
  if (!id) {
    return { valid: false, normalizedId: null };
  }

  // Exact match
  if (availableIds.includes(id)) {
    return { valid: true, normalizedId: id };
  }

  // Case-insensitive match
  const exact = availableIds.find((p) => p.toLowerCase() === id.toLowerCase());
  if (exact) {
    return { valid: true, normalizedId: exact };
  }

  return { valid: false, normalizedId: null };
}

/**
 * Parse pasted text into protein IDs
 */
export function parsePastedText(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Process multiple protein IDs for bulk selection
 */
export function processBulkProteinIds(
  ids: string[],
  availableIds: string[],
  currentlySelectedIds: string[],
): string[] {
  const availableIdsSet = new Set(availableIds);
  const lowerCaseAvailableMap = new Map<string, string>();
  availableIds.forEach((id) => lowerCaseAvailableMap.set(id.toLowerCase(), id));

  const newValidIds = new Set<string>();

  for (const id of ids) {
    if (!id) continue;

    if (availableIdsSet.has(id)) {
      newValidIds.add(id);
    } else {
      const lowerId = id.toLowerCase();
      if (lowerCaseAvailableMap.has(lowerId)) {
        newValidIds.add(lowerCaseAvailableMap.get(lowerId)!);
      }
    }
  }

  const currentSelectedSet = new Set(currentlySelectedIds);
  return [...newValidIds].filter((id) => !currentSelectedSet.has(id));
}

describe('search', () => {
  describe('filterProteinIds', () => {
    const availableIds = ['P12345', 'P23456', 'P34567', 'Q12345', 'Q23456'];

    it('returns all available IDs when query is empty', () => {
      const result = filterProteinIds(availableIds, '');
      expect(result).toEqual(availableIds);
    });

    it('filters by prefix match (case insensitive)', () => {
      const result = filterProteinIds(availableIds, 'p');
      expect(result).toEqual(['P12345', 'P23456', 'P34567']);
    });

    it('filters with case insensitive query', () => {
      const result = filterProteinIds(availableIds, 'P12');
      expect(result).toEqual(['P12345']);
    });

    it('excludes already selected IDs from results', () => {
      const result = filterProteinIds(availableIds, 'p', ['P12345']);
      expect(result).toEqual(['P23456', 'P34567']);
    });

    it('returns empty array when no matches', () => {
      const result = filterProteinIds(availableIds, 'X');
      expect(result).toEqual([]);
    });

    it('handles exact prefix match', () => {
      const result = filterProteinIds(availableIds, 'Q23456');
      expect(result).toEqual(['Q23456']);
    });

    it('excludes selected IDs even with empty query', () => {
      const result = filterProteinIds(availableIds, '', ['P12345', 'Q12345']);
      expect(result).toEqual(['P23456', 'P34567', 'Q23456']);
    });

    it('trims whitespace from query', () => {
      const result = filterProteinIds(availableIds, '  P12  ');
      expect(result).toEqual(['P12345']);
    });

    it('handles empty available IDs', () => {
      const result = filterProteinIds([], 'P');
      expect(result).toEqual([]);
    });

    it('only matches start of string, not substring', () => {
      const ids = ['ABC123', 'XYZ123', 'ABC456'];
      const result = filterProteinIds(ids, '123');
      expect(result).toEqual([]);
    });
  });

  describe('validateProteinId', () => {
    const availableIds = ['P12345', 'Q23456', 'R34567'];

    it('validates exact match', () => {
      const result = validateProteinId('P12345', availableIds);
      expect(result.valid).toBe(true);
      expect(result.normalizedId).toBe('P12345');
    });

    it('validates case insensitive match', () => {
      const result = validateProteinId('p12345', availableIds);
      expect(result.valid).toBe(true);
      expect(result.normalizedId).toBe('P12345');
    });

    it('returns invalid for non-existent ID', () => {
      const result = validateProteinId('X99999', availableIds);
      expect(result.valid).toBe(false);
      expect(result.normalizedId).toBeNull();
    });

    it('returns invalid for empty string', () => {
      const result = validateProteinId('', availableIds);
      expect(result.valid).toBe(false);
      expect(result.normalizedId).toBeNull();
    });

    it('handles mixed case normalization', () => {
      const result = validateProteinId('Q23456', availableIds);
      expect(result.valid).toBe(true);
      expect(result.normalizedId).toBe('Q23456');
    });

    it('handles uppercase query for lowercase ID', () => {
      const ids = ['abc123'];
      const result = validateProteinId('ABC123', ids);
      expect(result.valid).toBe(true);
      expect(result.normalizedId).toBe('abc123');
    });

    it('returns invalid for partial match', () => {
      const result = validateProteinId('P123', availableIds);
      expect(result.valid).toBe(false);
      expect(result.normalizedId).toBeNull();
    });
  });

  describe('parsePastedText', () => {
    it('parses single ID', () => {
      const result = parsePastedText('P12345');
      expect(result).toEqual(['P12345']);
    });

    it('parses multiple IDs separated by spaces', () => {
      const result = parsePastedText('P12345 Q23456 R34567');
      expect(result).toEqual(['P12345', 'Q23456', 'R34567']);
    });

    it('parses IDs separated by newlines', () => {
      const result = parsePastedText('P12345\nQ23456\nR34567');
      expect(result).toEqual(['P12345', 'Q23456', 'R34567']);
    });

    it('parses IDs with mixed separators', () => {
      const result = parsePastedText('P12345\nQ23456 R34567\tX45678');
      expect(result).toEqual(['P12345', 'Q23456', 'R34567', 'X45678']);
    });

    it('trims leading and trailing whitespace', () => {
      const result = parsePastedText('  P12345  ');
      expect(result).toEqual(['P12345']);
    });

    it('handles multiple consecutive spaces', () => {
      const result = parsePastedText('P12345    Q23456');
      expect(result).toEqual(['P12345', 'Q23456']);
    });

    it('filters out empty strings', () => {
      const result = parsePastedText('P12345  \n  Q23456');
      expect(result).toEqual(['P12345', 'Q23456']);
    });

    it('returns empty array for empty string', () => {
      const result = parsePastedText('');
      expect(result).toEqual([]);
    });

    it('returns empty array for whitespace only', () => {
      const result = parsePastedText('   \n\t  ');
      expect(result).toEqual([]);
    });

    it('handles comma-separated IDs (treats comma as part of ID)', () => {
      const result = parsePastedText('P12345,Q23456');
      expect(result).toEqual(['P12345,Q23456']);
    });
  });

  describe('processBulkProteinIds', () => {
    const availableIds = ['P12345', 'Q23456', 'R34567', 'S45678'];

    it('returns valid IDs that exist in available list', () => {
      const ids = ['P12345', 'Q23456'];
      const result = processBulkProteinIds(ids, availableIds, []);
      expect(result).toEqual(['P12345', 'Q23456']);
    });

    it('normalizes case for valid IDs', () => {
      const ids = ['p12345', 'Q23456'];
      const result = processBulkProteinIds(ids, availableIds, []);
      expect(result).toEqual(['P12345', 'Q23456']);
    });

    it('filters out invalid IDs', () => {
      const ids = ['P12345', 'X99999', 'Q23456'];
      const result = processBulkProteinIds(ids, availableIds, []);
      expect(result).toEqual(['P12345', 'Q23456']);
    });

    it('excludes already selected IDs', () => {
      const ids = ['P12345', 'Q23456', 'R34567'];
      const result = processBulkProteinIds(ids, availableIds, ['P12345']);
      expect(result).toEqual(['Q23456', 'R34567']);
    });

    it('handles duplicate IDs in input (deduplicates)', () => {
      const ids = ['P12345', 'P12345', 'Q23456'];
      const result = processBulkProteinIds(ids, availableIds, []);
      expect(result).toEqual(['P12345', 'Q23456']);
    });

    it('handles empty input array', () => {
      const result = processBulkProteinIds([], availableIds, []);
      expect(result).toEqual([]);
    });

    it('handles all invalid IDs', () => {
      const ids = ['X99999', 'Y88888'];
      const result = processBulkProteinIds(ids, availableIds, []);
      expect(result).toEqual([]);
    });

    it('preserves order of valid IDs', () => {
      const ids = ['R34567', 'P12345', 'Q23456'];
      const result = processBulkProteinIds(ids, availableIds, []);
      expect(result).toEqual(['R34567', 'P12345', 'Q23456']);
    });

    it('handles mix of valid, invalid, and already selected IDs', () => {
      const ids = ['P12345', 'X99999', 'Q23456', 'R34567'];
      const result = processBulkProteinIds(ids, availableIds, ['Q23456']);
      expect(result).toEqual(['P12345', 'R34567']);
    });

    it('handles case insensitive matching with mixed case input', () => {
      const ids = ['p12345', 'Q23456', 'r34567'];
      const result = processBulkProteinIds(ids, availableIds, []);
      expect(result).toEqual(['P12345', 'Q23456', 'R34567']);
    });

    it('returns empty array when all IDs are already selected', () => {
      const ids = ['P12345', 'Q23456'];
      const result = processBulkProteinIds(ids, availableIds, ['P12345', 'Q23456']);
      expect(result).toEqual([]);
    });
  });
});
