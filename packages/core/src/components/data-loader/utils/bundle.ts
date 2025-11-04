import { parquetReadObjects } from 'hyparquet';
import type { Rows } from './types';
import { assertValidParquetMagic, validateMergedBundleRows } from './validation';

const BUNDLE_DELIMITER = new TextEncoder().encode('---PARQUET_DELIMITER---');

export function isParquetBundle(arrayBuffer: ArrayBuffer): boolean {
  const uint8Array = new Uint8Array(arrayBuffer);
  const len = BUNDLE_DELIMITER.length;
  for (let i = 0; i <= uint8Array.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (uint8Array[i + j] !== BUNDLE_DELIMITER[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

export function findBundleDelimiterPositions(uint8Array: Uint8Array): number[] {
  const positions: number[] = [];
  const len = BUNDLE_DELIMITER.length;
  for (let i = 0; i <= uint8Array.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (uint8Array[i + j] !== BUNDLE_DELIMITER[j]) {
        match = false;
        break;
      }
    }
    if (match) positions.push(i);
  }
  return positions;
}

export async function extractRowsFromParquetBundle(
  arrayBuffer: ArrayBuffer,
  { disableInspection }: { disableInspection: boolean }
): Promise<Rows> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const delimiterPositions = findBundleDelimiterPositions(uint8Array);

  if (delimiterPositions.length !== 2) {
    throw new Error(`Expected 2 delimiters in parquetbundle, found ${delimiterPositions.length}`);
  }

  const part1 = uint8Array.subarray(0, delimiterPositions[0]).slice().buffer;
  const part2 = uint8Array
    .subarray(delimiterPositions[0] + BUNDLE_DELIMITER.length, delimiterPositions[1])
    .slice().buffer;
  const part3 = uint8Array.subarray(delimiterPositions[1] + BUNDLE_DELIMITER.length).slice().buffer;

  // Validate parquet magic for each part before parsing
  assertValidParquetMagic(part1);
  assertValidParquetMagic(part2);
  assertValidParquetMagic(part3);

  const [selectedFeaturesData, projectionsMetadataData, projectionsData] = await Promise.all([
    parquetReadObjects({ file: part1 }),
    parquetReadObjects({ file: part2 }),
    parquetReadObjects({ file: part3 }),
  ]);

  const mergedRows = mergeProjectionsWithFeatures(projectionsData, selectedFeaturesData);

  // Validate merged rows for expected bundle shape
  validateMergedBundleRows(mergedRows);

  if (!disableInspection) {
    createInspectionFiles(
      part1,
      part2,
      part3,
      selectedFeaturesData,
      projectionsMetadataData,
      projectionsData
    );
  }

  return mergedRows;
}

export function mergeProjectionsWithFeatures(projectionsData: Rows, featuresData: Rows): Rows {
  // Build map of features keyed by protein id
  const featureIdColumn = findColumn(featuresData.length > 0 ? Object.keys(featuresData[0]) : [], [
    'protein_id',
    'identifier',
    'id',
    'uniprot',
    'entry',
  ]);

  const finalFeatureIdColumn =
    featureIdColumn || (featuresData.length > 0 ? Object.keys(featuresData[0])[0] : undefined);

  const featuresMap = new Map<string, Record<string, any>>();
  if (finalFeatureIdColumn) {
    for (const feature of featuresData) {
      const proteinId = feature[finalFeatureIdColumn];
      if (proteinId != null) {
        featuresMap.set(String(proteinId), feature);
      }
    }
  }

  const projectionIdColumn = findColumn(
    projectionsData.length > 0 ? Object.keys(projectionsData[0]) : [],
    ['identifier', 'protein_id', 'id', 'uniprot', 'entry']
  );

  if (!projectionIdColumn) {
    return projectionsData;
  }

  const merged: Rows = new Array(projectionsData.length);
  for (let i = 0; i < projectionsData.length; i++) {
    const projection = projectionsData[i];
    const proteinId = projection[projectionIdColumn];
    const feature = proteinId != null ? featuresMap.get(String(proteinId)) : undefined;
    merged[i] = feature ? { ...projection, ...feature } : { ...projection };
  }

  return merged;
}

export function findColumn(columnNames: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    const found = columnNames.find((col) => col.toLowerCase().includes(candidate.toLowerCase()));
    if (found) return found;
  }
  return null;
}

function createInspectionFiles(
  part1Buffer: ArrayBuffer,
  part2Buffer: ArrayBuffer,
  part3Buffer: ArrayBuffer,
  part1Data: Rows,
  part2Data: Rows,
  part3Data: Rows
): void {
  try {
    const part1Blob = new Blob([part1Buffer], {
      type: 'application/octet-stream',
    });
    const part2Blob = new Blob([part2Buffer], {
      type: 'application/octet-stream',
    });
    const part3Blob = new Blob([part3Buffer], {
      type: 'application/octet-stream',
    });

    const part1Url = URL.createObjectURL(part1Blob);
    const part2Url = URL.createObjectURL(part2Blob);
    const part3Url = URL.createObjectURL(part3Blob);

    const downloadContainer = document.createElement('div');
    downloadContainer.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      background: white; border: 1px solid #333; border-radius: 8px;
      padding: 15px; font-family: Arial, sans-serif; font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 300px;
    `;

    downloadContainer.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px;">📥 Bundle Parts for Inspection</div>
      <div style="margin-bottom: 5px;">
        <a href="${part1Url}" download="selected_features.parquet" style="color: #0066cc;">
          📄 Part 1: selected_features.parquet (${part1Data.length} rows)
        </a>
      </div>
      <div style="margin-bottom: 5px;">
        <a href="${part2Url}" download="projections_metadata.parquet" style="color: #0066cc;">
          📊 Part 2: projections_metadata.parquet (${part2Data.length} rows)
        </a>
      </div>
      <div style="margin-bottom: 10px;">
        <a href="${part3Url}" download="projections_data.parquet" style="color: #0066cc;">
          📈 Part 3: projections_data.parquet (${part3Data.length} rows)
        </a>
      </div>
      <button id="ps-bundle-close" style="
        background: #ff4444; color: white; border: none; 
        padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;
      ">Close</button>
    `;

    document.body.appendChild(downloadContainer);

    const closeBtn = downloadContainer.querySelector<HTMLButtonElement>('#ps-bundle-close');
    closeBtn?.addEventListener('click', () => downloadContainer.remove());

    setTimeout(() => {
      if (downloadContainer.parentElement) downloadContainer.remove();
      URL.revokeObjectURL(part1Url);
      URL.revokeObjectURL(part2Url);
      URL.revokeObjectURL(part3Url);
    }, 30000);
  } catch (error) {
    // non-fatal

    console.error('Failed to create inspection files', error);
  }
}
