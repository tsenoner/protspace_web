import type { Feature, VisualizationData } from '@protspace/utils';
import { validateRowsBasic } from './validation';
import { findColumn } from './bundle';
import type { Rows } from './types';

export function convertParquetToVisualizationData(rows: Rows): VisualizationData {
  validateRowsBasic(rows);

  const columnNames = Object.keys(rows[0]);
  const hasProjectionName = columnNames.includes('projection_name');
  const hasXY = columnNames.includes('x') && columnNames.includes('y');

  if (hasProjectionName && hasXY) {
    return convertBundleFormatData(rows, columnNames);
  }
  return convertLegacyFormatData(rows, columnNames);
}

export function convertParquetToVisualizationDataOptimized(rows: Rows): Promise<VisualizationData> {
  validateRowsBasic(rows);
  const dataSize = rows.length;
  if (dataSize < 10000) {
    return Promise.resolve(convertParquetToVisualizationData(rows));
  }
  return convertLargeDatasetOptimized(rows);
}

async function convertLargeDatasetOptimized(rows: Rows): Promise<VisualizationData> {
  const columnNames = Object.keys(rows[0]);
  const hasProjectionName = columnNames.includes('projection_name');
  const hasXY = columnNames.includes('x') && columnNames.includes('y');
  if (hasProjectionName && hasXY) {
    return convertBundleFormatDataOptimized(rows, columnNames);
  }
  return convertLegacyFormatData(rows, columnNames);
}

function convertBundleFormatData(rows: Rows, columnNames: string[]): VisualizationData {
  const proteinIdCol =
    findColumn(columnNames, ['identifier', 'protein_id', 'id', 'protein', 'uniprot']) ||
    columnNames[0];

  const projectionGroups = new Map<string, Rows>();
  for (const row of rows) {
    const projectionName = row.projection_name || 'Unknown';
    let group = projectionGroups.get(projectionName);
    if (!group) {
      group = [];
      projectionGroups.set(projectionName, group);
    }
    group.push(row);
  }

  const uniqueProteinIds = Array.from(
    new Set(
      rows.map((row) => {
        const value = row[proteinIdCol];
        return value ? String(value) : '';
      })
    )
  );

  const projections = [] as VisualizationData['projections'];
  for (const [projectionName, projectionRows] of projectionGroups.entries()) {
    const coordMap = new Map<string, [number, number] | [number, number, number]>();
    for (const row of projectionRows) {
      const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
      const x = Number(row.x) || 0;
      const y = Number(row.y) || 0;
      const zValue = row.z;
      const z = zValue == null ? null : Number(zValue);
      if (z !== null && !Number.isNaN(z)) {
        coordMap.set(proteinId, [x, y, z]);
      } else {
        coordMap.set(proteinId, [x, y]);
      }
    }
    const projectionData = uniqueProteinIds.map((proteinId) => coordMap.get(proteinId) || [0, 0]);
    const has3D = projectionData.some((p) => p.length === 3);
    projections.push({
      name: formatProjectionName(projectionName),
      data: projectionData as Array<[number, number] | [number, number, number]>,
      metadata: has3D ? { dimension: 3 } : { dimension: 2 },
    });
  }

  const allIdColumns = new Set([
    'projection_name',
    'x',
    'y',
    'z',
    'identifier',
    'protein_id',
    'id',
    'uniprot',
    'entry',
    proteinIdCol,
  ]);

  const featureColumns = columnNames.filter((col) => !allIdColumns.has(col));

  const features: Record<string, Feature> = {};
  const feature_data: Record<string, number[][]> = {};

  const baseProjectionData = projectionGroups.values().next().value || rows;

  for (const featureCol of featureColumns) {
    const featureMap = new Map<string, string[]>();
    for (const row of baseProjectionData) {
      const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
      const value = row[featureCol];

      if (value == null) {
        featureMap.set(proteinId, []);
      } else {
        featureMap.set(proteinId, String(value).split(';'));
      }
    }

    const allValues = Array.from(featureMap.values());
    const uniqueValues = Array.from(new Set(allValues.flat()));
    const valueToIndex = new Map<string | null, number>();
    uniqueValues.forEach((value, idx) => valueToIndex.set(value, idx));

    const colors = generateColors(uniqueValues.length);
    const shapes = generateShapes(uniqueValues.length);

    const featureDataArray = uniqueProteinIds.map((proteinId) => {
      const value = featureMap.get(proteinId);
      return (value ?? []).map((v) => valueToIndex.get(v) ?? -1);
    });

    features[featureCol] = { values: uniqueValues, colors, shapes };
    feature_data[featureCol] = featureDataArray;
  }

  return { protein_ids: uniqueProteinIds, projections, features, feature_data };
}

async function convertBundleFormatDataOptimized(
  rows: Rows,
  columnNames: string[]
): Promise<VisualizationData> {
  const chunkSize = 5000;
  const proteinIdCol =
    findColumn(columnNames, ['identifier', 'protein_id', 'id', 'protein', 'uniprot']) ||
    columnNames[0];

  const projectionGroups = new Map<string, Rows>();
  const uniqueProteinIdsSet = new Set<string>();

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, Math.min(i + chunkSize, rows.length));
    for (const row of chunk) {
      const projectionName = row.projection_name || 'Unknown';
      let group = projectionGroups.get(projectionName);
      if (!group) {
        group = [];
        projectionGroups.set(projectionName, group);
      }
      group.push(row);
      const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : undefined;
      if (proteinId) uniqueProteinIdsSet.add(proteinId);
    }
    // yield

    await new Promise((r) => setTimeout(r, 0));
  }

  const uniqueProteinIds = Array.from(uniqueProteinIdsSet);

  const projections = [] as VisualizationData['projections'];
  for (const [projectionName, projectionRows] of projectionGroups.entries()) {
    const coordMap = new Map<string, [number, number] | [number, number, number]>();
    for (const row of projectionRows) {
      const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
      const x = Number(row.x) || 0;
      const y = Number(row.y) || 0;
      const zValue = row.z;
      const z = zValue == null ? null : Number(zValue);
      if (z !== null && !Number.isNaN(z)) {
        coordMap.set(proteinId, [x, y, z]);
      } else {
        coordMap.set(proteinId, [x, y]);
      }
    }
    const projectionData: Array<[number, number] | [number, number, number]> = new Array(
      uniqueProteinIds.length
    );
    for (let i = 0; i < uniqueProteinIds.length; i++) {
      projectionData[i] = coordMap.get(uniqueProteinIds[i]) || [0, 0];
    }
    const has3D = projectionData.some((p) => p.length === 3);
    projections.push({
      name: formatProjectionName(projectionName),
      data: projectionData,
      metadata: has3D ? { dimension: 3 } : { dimension: 2 },
    });
    // yield

    await new Promise((r) => setTimeout(r, 0));
  }

  const { features, feature_data } = await extractFeaturesOptimized(
    rows,
    columnNames,
    proteinIdCol,
    uniqueProteinIds
  );

  return { protein_ids: uniqueProteinIds, projections, features, feature_data };
}

function convertLegacyFormatData(rows: Rows, columnNames: string[]): VisualizationData {
  const proteinIdCol =
    findColumn(columnNames, ['identifier', 'protein_id', 'id', 'protein', 'uniprot']) ||
    columnNames[0];
  if (!proteinIdCol) {
    throw new Error(`Protein ID column not found. Available columns: ${columnNames.join(', ')}`);
  }

  const projectionPairs = findProjectionPairs(columnNames);
  if (projectionPairs.length === 0) {
    const numericColumns = columnNames.filter((col) => {
      const sampleValue = rows[0][col];
      return typeof sampleValue === 'number' || !Number.isNaN(Number(sampleValue));
    });
    if (numericColumns.length === 0) {
      throw new Error(
        `No projection coordinate pairs found. Available columns: ${columnNames.join(', ')}`
      );
    }
  }

  const protein_ids = rows.map((row) => (row[proteinIdCol] ? String(row[proteinIdCol]) : ''));

  const projections = projectionPairs.map((pair) => {
    const projectionData: [number, number][] = rows.map((row, idx) => {
      const x = Number(row[pair.xCol]);
      const y = Number(row[pair.yCol]);
      if (Number.isNaN(x) || Number.isNaN(y)) {
        console.warn(`Invalid coordinates at row ${idx} for projection ${pair.name}`, { x, y });
      }
      return [x, y];
    });
    return {
      name: pair.name,
      data: projectionData,
    } as VisualizationData['projections'][number];
  });

  const usedColumns = new Set([proteinIdCol, ...projectionPairs.flatMap((p) => [p.xCol, p.yCol])]);
  const featureColumns = columnNames.filter((col) => !usedColumns.has(col));

  const features: Record<string, Feature> = {};
  const feature_data: Record<string, number[][]> = {};

  for (const featureCol of featureColumns) {
    const rawValues: string[][] = rows.map((row) => {
      const v = row[featureCol];
      return v == null ? [] : String(v).split(';');
    });
    const uniqueValues = Array.from(new Set(rawValues.flat()));
    const valueToIndex = new Map<string, number>();
    uniqueValues.forEach((value, idx) => valueToIndex.set(value, idx));

    const colors = generateColors(uniqueValues.length);
    const shapes = generateShapes(uniqueValues.length);
    const featureDataArray = rawValues.map((valueArray) =>
      valueArray.map((v) => valueToIndex.get(v) ?? -1)
    );

    features[featureCol] = { values: uniqueValues, colors, shapes };
    feature_data[featureCol] = featureDataArray;
  }

  return { protein_ids, projections, features, feature_data };
}

export function findProjectionPairs(
  columnNames: string[]
): Array<{ name: string; xCol: string; yCol: string }> {
  const pairs: Array<{ name: string; xCol: string; yCol: string }> = [];
  const groups = new Map<string, { x?: string; y?: string }>();

  for (const col of columnNames) {
    const lower = col.toLowerCase();
    if (
      lower.includes('protein') ||
      lower.includes('id') ||
      (!lower.includes('_x') &&
        !lower.includes('_y') &&
        !lower.includes('1') &&
        !lower.includes('2'))
    ) {
      continue;
    }
    let projectionName = '';
    let coordType = '';
    if (lower.includes('_x') || lower.includes('_y')) {
      const parts = col.split('_');
      coordType = parts[parts.length - 1].toLowerCase();
      projectionName = parts.slice(0, -1).join('_');
    } else if (lower.includes('1') || lower.includes('2')) {
      if (lower.includes('1')) {
        coordType = 'x';
        projectionName = col.replace(/[_]?1/g, '');
      } else if (lower.includes('2')) {
        coordType = 'y';
        projectionName = col.replace(/[_]?2/g, '');
      }
    }
    if (projectionName && coordType) {
      const group = groups.get(projectionName) ?? {};
      if (coordType === 'x') group.x = col;
      if (coordType === 'y') group.y = col;
      groups.set(projectionName, group);
    }
  }

  for (const [name, group] of groups.entries()) {
    if (group.x && group.y) {
      pairs.push({
        name: formatProjectionName(name),
        xCol: group.x,
        yCol: group.y,
      });
    }
  }

  if (pairs.length === 0) {
    const xCol = findColumn(columnNames, ['x', 'umap_1', 'pc1', 'tsne_1']);
    const yCol = findColumn(columnNames, ['y', 'umap_2', 'pc2', 'tsne_2']);
    if (xCol && yCol) pairs.push({ name: inferProjectionName(xCol, yCol), xCol, yCol });
  }

  return pairs;
}

export function formatProjectionName(name: string): string {
  if (name.toUpperCase() === 'PCA_2') return 'PCA 2';
  if (name.toUpperCase() === 'PCA_3') return 'PCA 3';
  if (/^PCA_?\d+$/i.test(name)) {
    const number = name.replace(/^PCA_?/i, '');
    return `PCA ${number}`;
  }
  return name
    .split('_')
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower.includes('umap')) return 'UMAP' + part.replace(/umap/i, '');
      if (lower.includes('pca')) return 'PCA' + part.replace(/pca/i, '');
      if (lower.includes('tsne')) return 't-SNE' + part.replace(/tsne/i, '');
      if (/^\d+$/.test(part)) return part;
      return part.toUpperCase();
    })
    .join(' ');
}

export function inferProjectionName(xCol: string, yCol: string): string {
  const lx = xCol.toLowerCase();
  const ly = yCol.toLowerCase();
  if (lx.includes('umap') || ly.includes('umap')) return 'UMAP';
  if (lx.includes('pca') || lx.includes('pc')) return 'PCA';
  if (lx.includes('tsne')) return 't-SNE';
  return 'Projection';
}

export function generateColors(count: number): string[] {
  if (count <= 0) return [];
  const palette = [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
    '#17becf',
    '#aec7e8',
    '#ffbb78',
    '#98df8a',
    '#ff9896',
    '#c5b0d5',
    '#c49c94',
    '#f7b6d3',
    '#c7c7c7',
    '#dbdb8d',
    '#9edae5',
  ];
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i < palette.length) colors.push(palette[i]);
    else {
      const hue = ((i * 360) / count) % 360;
      const saturation = 70 + (i % 3) * 10;
      const lightness = 50 + (i % 2) * 15;
      colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`);
    }
  }
  return colors;
}

export function generateShapes(count: number): string[] {
  if (count <= 0) return [];
  const options = [
    'circle',
    'square',
    'triangle',
    'diamond',
    'cross',
    'star',
    'plus',
    'times',
    'wye',
    'asterisk',
  ];
  const shapes: string[] = [];
  for (let i = 0; i < count; i++) shapes.push(options[i % options.length]);
  return shapes;
}

export async function extractFeaturesOptimized(
  rows: Rows,
  columnNames: string[],
  proteinIdCol: string,
  uniqueProteinIds: string[]
): Promise<{
  features: Record<string, Feature>;
  feature_data: Record<string, number[][]>;
}> {
  const allIdColumns = new Set([
    'projection_name',
    'x',
    'y',
    'z',
    'identifier',
    'protein_id',
    'id',
    'uniprot',
    'entry',
    proteinIdCol,
  ]);
  const featureColumns = columnNames.filter((c) => !allIdColumns.has(c));

  const features: Record<string, Feature> = {};
  const feature_data: Record<string, number[][]> = {};

  const chunkSize = 10000;
  for (const featureCol of featureColumns) {
    const featureMap = new Map<string, string[]>();
    const valueCountMap = new Map<string | null, number>();
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, Math.min(i + chunkSize, rows.length));
      for (const row of chunk) {
        const proteinId = row[proteinIdCol] != null ? String(row[proteinIdCol]) : '';
        const value = row[featureCol];

        if (value == null) {
          featureMap.set(proteinId, []);
          continue;
        }

        const valueArray = String(value).split(';');

        featureMap.set(proteinId, valueArray);

        for (const v of valueArray) {
          valueCountMap.set(v, (valueCountMap.get(v) || 0) + 1);
        }
      }
      // yield

      await new Promise((r) => setTimeout(r, 0));
    }

    const uniqueValues = Array.from(valueCountMap.keys());
    const valueToIndex = new Map<string | null, number>();
    uniqueValues.forEach((val, idx) => valueToIndex.set(val, idx));

    const colors = generateColors(uniqueValues.length);
    const shapes = generateShapes(uniqueValues.length);

    const featureDataArray = new Array<number[]>(uniqueProteinIds.length);

    for (let i = 0; i < uniqueProteinIds.length; i++) {
      const valueArray = featureMap.get(uniqueProteinIds[i]) ?? null;
      featureDataArray[i] = (valueArray ?? []).map((v) => valueToIndex.get(v) ?? -1);
    }

    features[featureCol] = { values: uniqueValues, colors, shapes };
    feature_data[featureCol] = featureDataArray;
  }

  return { features, feature_data };
}
