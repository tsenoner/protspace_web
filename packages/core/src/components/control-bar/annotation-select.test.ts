import { describe, it, expect } from 'vitest';

/**
 * Annotation categories as defined in the component
 */
const ANNOTATION_CATEGORIES = {
  UniProt: [
    'annotation_score',
    'cc_subcellular_location',
    'fragment',
    'gene_name',
    'protein_existence',
    'protein_families',
    'reviewed',
    'xref_pdb',
  ],
  InterPro: ['cath', 'pfam', 'signal_peptide', 'superfamily'],
  Taxonomy: ['root', 'domain', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'],
} as const;

/**
 * Taxonomy order for sorting
 */
const TAXONOMY_ORDER = [
  'root',
  'domain',
  'kingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
] as const;

type CategoryName = 'UniProt' | 'InterPro' | 'Taxonomy' | 'Other';

interface GroupedAnnotation {
  category: CategoryName;
  annotations: string[];
}

/**
 * Categorize annotations according to the plan
 * (Extracted from component for testing)
 */
export function categorizeAnnotations(annotations: string[]): GroupedAnnotation[] {
  const categorized: Record<CategoryName, string[]> = {
    UniProt: [],
    InterPro: [],
    Taxonomy: [],
    Other: [],
  };

  for (const annotation of annotations) {
    let found = false;
    for (const [category, categoryAnnotations] of Object.entries(ANNOTATION_CATEGORIES)) {
      if ((categoryAnnotations as readonly string[]).includes(annotation)) {
        categorized[category as CategoryName].push(annotation);
        found = true;
        break;
      }
    }
    if (!found) {
      categorized.Other.push(annotation);
    }
  }

  // Sort annotations within each category
  categorized.UniProt.sort((a, b) => a.localeCompare(b));
  categorized.InterPro.sort((a, b) => a.localeCompare(b));
  categorized.Other.sort((a, b) => a.localeCompare(b));
  // Taxonomy uses predefined order
  categorized.Taxonomy.sort((a, b) => {
    const aIndex = TAXONOMY_ORDER.indexOf(a as (typeof TAXONOMY_ORDER)[number]);
    const bIndex = TAXONOMY_ORDER.indexOf(b as (typeof TAXONOMY_ORDER)[number]);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  // Build grouped array, sorting categories alphabetically (Other last)
  const groups: GroupedAnnotation[] = [];
  const categoryOrder: CategoryName[] = ['InterPro', 'Taxonomy', 'UniProt', 'Other'];
  for (const category of categoryOrder) {
    if (categorized[category].length > 0) {
      groups.push({ category, annotations: categorized[category] });
    }
  }

  return groups;
}

/**
 * Filter annotations based on search query
 */
export function filterGroupedAnnotations(
  grouped: GroupedAnnotation[],
  query: string,
): GroupedAnnotation[] {
  const queryLower = query.trim().toLowerCase();

  if (!queryLower) {
    return grouped;
  }

  // Filter each category's annotations
  return grouped
    .map((group) => ({
      ...group,
      annotations: group.annotations.filter((annotation) =>
        annotation.toLowerCase().includes(queryLower),
      ),
    }))
    .filter((group) => group.annotations.length > 0); // Remove empty categories
}

/**
 * Flatten grouped annotations into a single array for keyboard navigation
 */
export function flattenGroupedAnnotations(grouped: GroupedAnnotation[]): string[] {
  const flat: string[] = [];
  for (const group of grouped) {
    flat.push(...group.annotations);
  }
  return flat;
}

describe('annotation-select', () => {
  describe('categorizeAnnotations', () => {
    it('categorizes UniProt annotations correctly', () => {
      const annotations = ['gene_name', 'reviewed', 'protein_families'];
      const result = categorizeAnnotations(annotations);

      const uniprotGroup = result.find((g) => g.category === 'UniProt');
      expect(uniprotGroup).toBeDefined();
      expect(uniprotGroup?.annotations).toEqual(['gene_name', 'protein_families', 'reviewed']);
    });

    it('categorizes InterPro annotations correctly', () => {
      const annotations = ['pfam', 'cath', 'signal_peptide'];
      const result = categorizeAnnotations(annotations);

      const interproGroup = result.find((g) => g.category === 'InterPro');
      expect(interproGroup).toBeDefined();
      expect(interproGroup?.annotations).toEqual(['cath', 'pfam', 'signal_peptide']);
    });

    it('categorizes Taxonomy annotations in correct order', () => {
      const annotations = ['species', 'genus', 'kingdom', 'domain', 'phylum'];
      const result = categorizeAnnotations(annotations);

      const taxonomyGroup = result.find((g) => g.category === 'Taxonomy');
      expect(taxonomyGroup).toBeDefined();
      expect(taxonomyGroup?.annotations).toEqual([
        'domain',
        'kingdom',
        'phylum',
        'genus',
        'species',
      ]);
    });

    it('places unknown annotations in Other category', () => {
      const annotations = ['custom_field', 'another_unknown'];
      const result = categorizeAnnotations(annotations);

      const otherGroup = result.find((g) => g.category === 'Other');
      expect(otherGroup).toBeDefined();
      expect(otherGroup?.annotations).toEqual(['another_unknown', 'custom_field']);
    });

    it('sorts annotations alphabetically within each category', () => {
      const annotations = ['reviewed', 'gene_name', 'annotation_score'];
      const result = categorizeAnnotations(annotations);

      const uniprotGroup = result.find((g) => g.category === 'UniProt');
      expect(uniprotGroup?.annotations).toEqual(['annotation_score', 'gene_name', 'reviewed']);
    });

    it('returns categories in correct order: InterPro, Taxonomy, UniProt, Other', () => {
      const annotations = ['custom', 'species', 'pfam', 'gene_name'];
      const result = categorizeAnnotations(annotations);

      expect(result.map((g) => g.category)).toEqual(['InterPro', 'Taxonomy', 'UniProt', 'Other']);
    });

    it('handles mixed annotations from multiple categories', () => {
      const annotations = ['gene_name', 'pfam', 'species', 'custom_field'];
      const result = categorizeAnnotations(annotations);

      expect(result.length).toBe(4);
      expect(result.find((g) => g.category === 'UniProt')?.annotations).toEqual(['gene_name']);
      expect(result.find((g) => g.category === 'InterPro')?.annotations).toEqual(['pfam']);
      expect(result.find((g) => g.category === 'Taxonomy')?.annotations).toEqual(['species']);
      expect(result.find((g) => g.category === 'Other')?.annotations).toEqual(['custom_field']);
    });

    it('handles empty annotations array', () => {
      const result = categorizeAnnotations([]);
      expect(result).toEqual([]);
    });

    it('excludes empty categories from result', () => {
      const annotations = ['gene_name']; // Only UniProt
      const result = categorizeAnnotations(annotations);

      expect(result.length).toBe(1);
      expect(result[0].category).toBe('UniProt');
    });

    it('handles all taxonomy annotations in order', () => {
      const taxonomyAnnotations = [
        'species',
        'genus',
        'family',
        'order',
        'class',
        'phylum',
        'kingdom',
        'domain',
        'root',
      ];
      const result = categorizeAnnotations(taxonomyAnnotations);

      const taxonomyGroup = result.find((g) => g.category === 'Taxonomy');
      expect(taxonomyGroup?.annotations).toEqual([
        'root',
        'domain',
        'kingdom',
        'phylum',
        'class',
        'order',
        'family',
        'genus',
        'species',
      ]);
    });
  });

  describe('filterGroupedAnnotations', () => {
    const grouped: GroupedAnnotation[] = [
      { category: 'UniProt', annotations: ['gene_name', 'reviewed', 'protein_families'] },
      { category: 'InterPro', annotations: ['pfam', 'cath'] },
      { category: 'Taxonomy', annotations: ['species', 'genus'] },
      { category: 'Other', annotations: ['custom_field'] },
    ];

    it('returns all annotations when query is empty', () => {
      const result = filterGroupedAnnotations(grouped, '');
      expect(result).toEqual(grouped);
    });

    it('filters annotations by substring match (case insensitive)', () => {
      const result = filterGroupedAnnotations(grouped, 'gene');
      expect(result.length).toBe(1);
      expect(result[0].category).toBe('UniProt');
      expect(result[0].annotations).toEqual(['gene_name']);
    });

    it('filters across multiple categories', () => {
      const result = filterGroupedAnnotations(grouped, 'e');
      // Should match: gene_name, reviewed, species, genus, custom_field
      expect(result.length).toBeGreaterThan(0);
      const allAnnotations = result.flatMap((g) => g.annotations);
      expect(allAnnotations).toContain('gene_name');
      expect(allAnnotations).toContain('reviewed');
      expect(allAnnotations).toContain('species');
      expect(allAnnotations).toContain('genus');
    });

    it('removes categories with no matching annotations', () => {
      const result = filterGroupedAnnotations(grouped, 'pfam');
      expect(result.length).toBe(1);
      expect(result[0].category).toBe('InterPro');
    });

    it('handles case insensitive search', () => {
      const result = filterGroupedAnnotations(grouped, 'GENE');
      expect(result.length).toBe(1);
      expect(result[0].annotations).toEqual(['gene_name']);
    });

    it('trims whitespace from query', () => {
      const result = filterGroupedAnnotations(grouped, '  gene  ');
      expect(result.length).toBe(1);
      expect(result[0].annotations).toEqual(['gene_name']);
    });

    it('returns empty array when no matches found', () => {
      const result = filterGroupedAnnotations(grouped, 'xyz123');
      expect(result).toEqual([]);
    });

    it('handles partial matches', () => {
      const result = filterGroupedAnnotations(grouped, 'fam');
      expect(result.length).toBe(2); // pfam and protein_families
      const allAnnotations = result.flatMap((g) => g.annotations);
      expect(allAnnotations).toContain('pfam');
      expect(allAnnotations).toContain('protein_families');
    });
  });

  describe('flattenGroupedAnnotations', () => {
    it('flattens grouped annotations into single array', () => {
      const grouped: GroupedAnnotation[] = [
        { category: 'UniProt', annotations: ['gene_name', 'reviewed'] },
        { category: 'InterPro', annotations: ['pfam', 'cath'] },
      ];

      const result = flattenGroupedAnnotations(grouped);
      expect(result).toEqual(['gene_name', 'reviewed', 'pfam', 'cath']);
    });

    it('preserves order from grouped annotations', () => {
      const grouped: GroupedAnnotation[] = [
        { category: 'Taxonomy', annotations: ['species'] },
        { category: 'UniProt', annotations: ['gene_name'] },
        { category: 'InterPro', annotations: ['pfam'] },
      ];

      const result = flattenGroupedAnnotations(grouped);
      expect(result).toEqual(['species', 'gene_name', 'pfam']);
    });

    it('handles empty groups', () => {
      const result = flattenGroupedAnnotations([]);
      expect(result).toEqual([]);
    });

    it('handles groups with no annotations', () => {
      const grouped: GroupedAnnotation[] = [
        { category: 'UniProt', annotations: [] },
        { category: 'InterPro', annotations: ['pfam'] },
      ];

      const result = flattenGroupedAnnotations(grouped);
      expect(result).toEqual(['pfam']);
    });

    it('handles single group with multiple annotations', () => {
      const grouped: GroupedAnnotation[] = [
        { category: 'UniProt', annotations: ['a', 'b', 'c', 'd'] },
      ];

      const result = flattenGroupedAnnotations(grouped);
      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });
  });
});
