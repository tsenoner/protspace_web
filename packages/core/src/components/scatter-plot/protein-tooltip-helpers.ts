import { NA_VALUE } from '@protspace/utils';

/**
 * Filter annotation values, removing N/A entries and empty/whitespace strings.
 * Returns the joined result or null if nothing remains.
 */
export function filterAnnotationValues(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  const filtered = values
    .filter((value) => value !== NA_VALUE)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (filtered.length === 0) return null;
  return filtered.join(', ');
}

/**
 * Resolve gene name from a protein's annotation values.
 * Checks both snake_case and human-readable keys.
 */
export function getGeneName(annotationValues: Record<string, string[]>): string | null {
  return filterAnnotationValues(annotationValues?.gene_name || annotationValues?.['Gene name']);
}

/**
 * Resolve protein name from a protein's annotation values.
 * Checks both snake_case and human-readable keys.
 */
export function getProteinName(annotationValues: Record<string, string[]>): string | null {
  return filterAnnotationValues(
    annotationValues?.protein_name || annotationValues?.['Protein name'],
  );
}

/**
 * Resolve UniProtKB ID from a protein's annotation values.
 */
export function getUniprotKbId(annotationValues: Record<string, string[]>): string | null {
  return filterAnnotationValues(annotationValues?.uniprot_kb_id);
}

/**
 * Determine the annotation header type based on available scores and evidence.
 * Returns 'bitscore' if any scores are present, 'evidence' if any evidence codes
 * are present (but no scores), or null if neither exists.
 */
export function getAnnotationHeaderType(
  scores: (number[] | null)[],
  evidence: (string | null)[],
): 'bitscore' | 'evidence' | null {
  if (scores.some((s) => Array.isArray(s) && s.length > 0)) return 'bitscore';
  if (evidence.some((e) => e != null)) return 'evidence';
  return null;
}
