export const ANNOTATION_CATEGORIES = {
  UniProt: [
    'annotation_score',
    'cc_subcellular_location',
    'ec',
    'fragment',
    'gene_name',
    'go_bp',
    'go_cc',
    'go_mf',
    'keyword',
    'length',
    'protein_existence',
    'protein_families',
    'reviewed',
    'xref_pdb',
  ],
  InterPro: [
    'cath',
    'cdd',
    'panther',
    'pfam',
    'prints',
    'prosite',
    'signal_peptide',
    'smart',
    'superfamily',
  ],
  Taxonomy: ['root', 'domain', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'],
} as const;

export const TAXONOMY_ORDER = [
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

export type CategoryName = 'UniProt' | 'InterPro' | 'Taxonomy' | 'Other';

export interface GroupedAnnotation {
  category: CategoryName;
  annotations: string[];
}

/**
 * Categorize and sort annotations into grouped categories.
 * Shared by annotation-select and query-condition-row.
 */
export function groupAnnotations(annotations: string[]): GroupedAnnotation[] {
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

  categorized.UniProt.sort((a, b) => a.localeCompare(b));
  categorized.InterPro.sort((a, b) => a.localeCompare(b));
  categorized.Other.sort((a, b) => a.localeCompare(b));
  categorized.Taxonomy.sort((a, b) => {
    const aIndex = TAXONOMY_ORDER.indexOf(a as (typeof TAXONOMY_ORDER)[number]);
    const bIndex = TAXONOMY_ORDER.indexOf(b as (typeof TAXONOMY_ORDER)[number]);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const groups: GroupedAnnotation[] = [];
  const categoryOrder: CategoryName[] = ['InterPro', 'Taxonomy', 'UniProt', 'Other'];
  for (const category of categoryOrder) {
    if (categorized[category].length > 0) {
      groups.push({ category, annotations: categorized[category] });
    }
  }

  return groups;
}
