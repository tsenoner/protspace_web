/**
 * Fast hash function (djb2 variant) for generating deterministic dataset identifiers.
 * Used to scope persisted settings to specific datasets.
 */

interface DatasetHashInput {
  protein_ids: string[];
  annotations?: Record<
    string,
    {
      kind?: 'categorical' | 'numeric';
      sourceKind?: 'categorical' | 'numeric';
      values?: (string | null)[];
      numericMetadata?: {
        strategy?: string;
        binCount?: number;
        bins?: Array<{
          id?: string;
          label?: string;
          lowerBound?: number;
          upperBound?: number;
          count?: number;
        }>;
      };
    }
  >;
  numeric_annotation_data?: Record<string, (number | null)[]>;
}

interface NumericMetadataFingerprintInput {
  strategy?: string;
  binCount?: number;
  bins?: Array<{
    id?: string;
    lowerBound?: number;
    upperBound?: number;
  }>;
}

export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

function appendHash(hash: number, value: string): number {
  let nextHash = hash;
  for (let i = 0; i < value.length; i++) {
    nextHash = ((nextHash << 5) + nextHash) ^ value.charCodeAt(i);
  }
  return nextHash >>> 0;
}

function fnv1a64Hash(str: string): string {
  let hash = 0xcbf29ce484222325n;
  const fnvPrime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * fnvPrime) & mask;
  }

  return hash.toString(16).padStart(16, '0');
}

function buildNumericFingerprint(values: Array<number | null>): string {
  if (values.length === 0) {
    return '';
  }

  let hash = 5381;
  let nonNullCount = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    const serialized = value == null ? 'null' : String(value);
    hash = appendHash(hash, serialized);
    hash = appendHash(hash, '\x1f');

    if (value == null || !Number.isFinite(value)) {
      continue;
    }

    nonNullCount += 1;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return [
    values.length,
    nonNullCount,
    nonNullCount > 0 ? min : 'none',
    nonNullCount > 0 ? max : 'none',
    hash.toString(16).padStart(8, '0'),
  ].join('|');
}

function buildNumericMetadataFingerprint(
  numericMetadata?: NumericMetadataFingerprintInput,
): string {
  if (!numericMetadata) {
    return '';
  }

  const serializedBins = (numericMetadata.bins ?? [])
    .map((bin) =>
      [
        bin.id ?? '',
        Number.isFinite(bin.lowerBound) ? String(bin.lowerBound) : '',
        Number.isFinite(bin.upperBound) ? String(bin.upperBound) : '',
      ].join('|'),
    )
    .join('\x1f');

  return [numericMetadata.strategy ?? '', numericMetadata.binCount ?? '', serializedBins].join(
    '::',
  );
}

function buildDatasetFingerprint(data: DatasetHashInput): string {
  const proteinIds = Array.isArray(data.protein_ids) ? data.protein_ids : [];
  const sortedIds = [...proteinIds].sort();
  const annotationFingerprint = Object.entries(data.annotations ?? {})
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([annotationName, annotation]) => {
      const isNumericAnnotation =
        annotation.kind === 'numeric' || annotation.sourceKind === 'numeric';
      const normalizedKind = isNumericAnnotation ? 'numeric' : (annotation.kind ?? 'categorical');
      const normalizedSourceKind = isNumericAnnotation ? 'numeric' : '';
      const categoricalValues =
        !isNumericAnnotation && Array.isArray(annotation.values)
          ? annotation.values.map((value) => value ?? '__NULL__').join('|')
          : '';
      const numericValues = data.numeric_annotation_data?.[annotationName] ?? [];
      const numericFingerprint =
        numericValues.length > 0
          ? buildNumericFingerprint(numericValues)
          : buildNumericMetadataFingerprint(annotation.numericMetadata);

      return [
        annotationName,
        normalizedKind,
        normalizedSourceKind,
        categoricalValues,
        numericFingerprint,
      ].join('::');
    })
    .join('\x01');

  return [sortedIds.join('\x00'), annotationFingerprint].join('\x02');
}

export function generateDatasetHash(input: string[] | DatasetHashInput): string {
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return '0000000000000000';
  }

  const combined = Array.isArray(input)
    ? [...input].sort().join('\x00')
    : buildDatasetFingerprint(input);

  return fnv1a64Hash(combined);
}
