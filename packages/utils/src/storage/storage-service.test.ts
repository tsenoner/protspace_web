import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildStorageKey,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from './storage-service';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

// Replace global localStorage with mock
vi.stubGlobal('localStorage', localStorageMock);

describe('buildStorageKey', () => {
  it('should build key with component and datasetHash', () => {
    const key = buildStorageKey('legend', 'abc12345');
    expect(key).toBe('protspace:legend:abc12345');
  });

  it('should build key with component, datasetHash, and context', () => {
    const key = buildStorageKey('legend', 'abc12345', 'Taxonomy');
    expect(key).toBe('protspace:legend:abc12345:Taxonomy');
  });

  it('should handle empty context', () => {
    const key = buildStorageKey('legend', 'abc12345', '');
    // Empty string is falsy, so context should not be added
    expect(key).toBe('protspace:legend:abc12345');
  });

  it('should handle undefined context', () => {
    const key = buildStorageKey('legend', 'abc12345', undefined);
    expect(key).toBe('protspace:legend:abc12345');
  });

  it('should handle special characters in context', () => {
    const key = buildStorageKey('legend', 'abc12345', 'Feature:With:Colons');
    expect(key).toBe('protspace:legend:abc12345:Feature:With:Colons');
  });

  it('should handle different component names', () => {
    expect(buildStorageKey('scatterplot', 'hash1')).toBe('protspace:scatterplot:hash1');
    expect(buildStorageKey('control-bar', 'hash2')).toBe('protspace:control-bar:hash2');
  });
});

describe('getStorageItem', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should return default value when key does not exist', () => {
    const defaultValue = { foo: 'bar' };
    const result = getStorageItem('nonexistent', defaultValue);
    expect(result).toEqual(defaultValue);
  });

  it('should return parsed value when key exists', () => {
    const storedValue = { name: 'test', count: 42 };
    localStorageMock.setItem('testKey', JSON.stringify(storedValue));

    const result = getStorageItem('testKey', { name: 'defaultValue', count: 0 });
    expect(result).toEqual(storedValue);
  });

  it('should return default value on JSON parse error', () => {
    localStorageMock.setItem('badJson', 'not valid json{');

    const defaultValue = { valid: true };
    const result = getStorageItem('badJson', defaultValue);
    expect(result).toEqual(defaultValue);
  });

  it('should handle primitive types', () => {
    localStorageMock.setItem('numberKey', '42');
    localStorageMock.setItem('stringKey', '"hello"');
    localStorageMock.setItem('boolKey', 'true');
    localStorageMock.setItem('nullKey', 'null');

    expect(getStorageItem('numberKey', 0)).toBe(42);
    expect(getStorageItem('stringKey', '')).toBe('hello');
    expect(getStorageItem('boolKey', false)).toBe(true);
    expect(getStorageItem('nullKey', 'default')).toBe(null);
  });

  it('should handle arrays', () => {
    const storedArray = [1, 2, 3, 'four'];
    localStorageMock.setItem('arrayKey', JSON.stringify(storedArray));

    const result = getStorageItem('arrayKey', []);
    expect(result).toEqual(storedArray);
  });

  it('should handle nested objects', () => {
    const nestedObj = {
      level1: {
        level2: {
          value: 'deep',
        },
      },
    };
    localStorageMock.setItem('nestedKey', JSON.stringify(nestedObj));

    const result = getStorageItem('nestedKey', {});
    expect(result).toEqual(nestedObj);
  });

  it('should return default value when localStorage throws', () => {
    const originalGetItem = localStorageMock.getItem;
    localStorageMock.getItem = vi.fn(() => {
      throw new Error('Storage error');
    });

    const defaultValue = { fallback: true };
    const result = getStorageItem('anyKey', defaultValue);
    expect(result).toEqual(defaultValue);

    localStorageMock.getItem = originalGetItem;
  });
});

describe('setStorageItem', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should store value and return true', () => {
    const value = { name: 'test', count: 42 };
    const result = setStorageItem('myKey', value);

    expect(result).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('myKey', JSON.stringify(value));
  });

  it('should store primitive types', () => {
    expect(setStorageItem('numKey', 123)).toBe(true);
    expect(setStorageItem('strKey', 'hello')).toBe(true);
    expect(setStorageItem('boolKey', true)).toBe(true);
    expect(setStorageItem('nullKey', null)).toBe(true);

    expect(localStorageMock.setItem).toHaveBeenCalledWith('numKey', '123');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('strKey', '"hello"');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('boolKey', 'true');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('nullKey', 'null');
  });

  it('should store arrays', () => {
    const arr = [1, 2, 3];
    const result = setStorageItem('arrKey', arr);

    expect(result).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('arrKey', '[1,2,3]');
  });

  it('should return false when localStorage throws', () => {
    const originalSetItem = localStorageMock.setItem;
    localStorageMock.setItem = vi.fn(() => {
      throw new Error('Quota exceeded');
    });

    const result = setStorageItem('anyKey', { data: 'value' });
    expect(result).toBe(false);

    localStorageMock.setItem = originalSetItem;
  });

  it('should overwrite existing values', () => {
    setStorageItem('overwriteKey', { original: true });
    setStorageItem('overwriteKey', { updated: true });

    const stored = localStorageMock.getItem('overwriteKey');
    expect(JSON.parse(stored!)).toEqual({ updated: true });
  });
});

describe('removeStorageItem', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should remove item and return true', () => {
    localStorageMock.setItem('toRemove', '"value"');

    const result = removeStorageItem('toRemove');

    expect(result).toBe(true);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('toRemove');
  });

  it('should return true even when key does not exist', () => {
    const result = removeStorageItem('nonexistent');

    expect(result).toBe(true);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('nonexistent');
  });

  it('should return false when localStorage throws', () => {
    const originalRemoveItem = localStorageMock.removeItem;
    localStorageMock.removeItem = vi.fn(() => {
      throw new Error('Storage error');
    });

    const result = removeStorageItem('anyKey');
    expect(result).toBe(false);

    localStorageMock.removeItem = originalRemoveItem;
  });
});

describe('integration: get/set/remove workflow', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should store and retrieve complex settings object', () => {
    const settings = {
      maxVisibleValues: 10,
      includeOthers: true,
      hiddenValues: ['null', 'Other'],
      zOrderMapping: { Bacteria: 0, Archaea: 1, Eukaryota: 2 },
    };

    const key = buildStorageKey('legend', 'dataset123', 'Taxonomy');

    const setResult = setStorageItem(key, settings);
    expect(setResult).toBe(true);

    const retrieved = getStorageItem(key, {
      maxVisibleValues: 5,
      includeOthers: false,
      hiddenValues: [],
      zOrderMapping: {},
    });
    expect(retrieved).toEqual(settings);

    const removeResult = removeStorageItem(key);
    expect(removeResult).toBe(true);

    const afterRemove = getStorageItem(key, {
      maxVisibleValues: 5,
      includeOthers: false,
      hiddenValues: [],
      zOrderMapping: {},
    });
    expect(afterRemove).toEqual({
      maxVisibleValues: 5,
      includeOthers: false,
      hiddenValues: [],
      zOrderMapping: {},
    });
  });
});
