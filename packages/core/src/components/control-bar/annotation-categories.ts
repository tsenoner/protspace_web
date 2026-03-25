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
    'length_fixed',
    'length_quantile',
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
