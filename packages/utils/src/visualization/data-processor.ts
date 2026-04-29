import type { VisualizationData, PlotDataPoint, NumericAnnotationType } from '../types.js';
import { normalizeMissingValue, toInternalValue } from './missing-values.js';
import * as d3 from 'd3';
import { getNumericBinLabelMap } from './numeric-binning.js';

export class DataProcessor {
  static processVisualizationData(
    data: VisualizationData,
    projectionIndex: number,
    isolationMode: boolean = false,
    isolationHistory?: string[][],
    projectionPlane: 'xy' | 'xz' | 'yz' = 'xy',
  ): PlotDataPoint[] {
    if (!data.projections[projectionIndex]) return [];

    const processedData: PlotDataPoint[] = data.protein_ids.map((id, index) => {
      const coordinates = (data.projections[projectionIndex].data[index] ?? [0, 0]) as
        | [number, number]
        | [number, number, number];

      // Map annotation values for this protein
      const annotationValues: Record<string, string[]> = {};
      const annotationDisplayValues: Record<string, string[]> = {};
      const numericAnnotationValues: Record<string, number | null> = {};
      const numericAnnotationTypes: Record<string, NumericAnnotationType> = {};
      const annotationScores: Record<string, (number[] | null)[]> = {};
      const annotationEvidence: Record<string, (string | null)[]> = {};
      Object.keys(data.annotations).forEach((annotationKey) => {
        const annotation = data.annotations[annotationKey];
        const annotationRows = data.annotation_data?.[annotationKey];
        const annotationIndicesData = annotationRows ? annotationRows[index] : undefined;
        const numericValue = data.numeric_annotation_data?.[annotationKey]?.[index] ?? null;
        const numericLabelMap = getNumericBinLabelMap(annotation);

        // Handle array/single/undefined cases
        const annotationIndices: unknown[] = Array.isArray(annotationIndicesData)
          ? annotationIndicesData
          : annotationIndicesData == null
            ? []
            : [annotationIndicesData];

        // TEMPORARY (Task 2 of NA-handling redesign): the data-loader does not
        // yet run normalizeMissingValue at ingestion. Wrap toInternalValue with
        // it here so missing-value spellings ('NA', 'N/A', 'NaN', 'None',
        // 'missing', empty/whitespace, non-finite numbers) collapse to the
        // __NA__ legend key. Drop the wrapping once Task 3 normalizes at
        // ingestion-time in conversion.ts; then call toInternalValue directly.
        annotationValues[annotationKey] = Array.isArray(annotation.values)
          ? annotationIndices
              .filter((i): i is number => typeof i === 'number' && Number.isFinite(i))
              .map((i) => toInternalValue(normalizeMissingValue(annotation.values[i])))
          : [];
        annotationDisplayValues[annotationKey] = annotationValues[annotationKey].map(
          (value) => numericLabelMap.get(value) ?? value,
        );
        numericAnnotationValues[annotationKey] = numericValue;
        numericAnnotationTypes[annotationKey] =
          annotation.numericType ?? annotation.numericMetadata?.numericType ?? 'float';

        // Map annotation scores if available
        const scoresForAnnotation = data.annotation_scores?.[annotationKey]?.[index];
        annotationScores[annotationKey] = Array.isArray(scoresForAnnotation)
          ? scoresForAnnotation
          : [];

        // Map annotation evidence if available
        const evidenceForAnnotation = data.annotation_evidence?.[annotationKey]?.[index];
        annotationEvidence[annotationKey] = Array.isArray(evidenceForAnnotation)
          ? evidenceForAnnotation
          : [];
      });

      // Determine 2D mapping depending on plane for 3D coordinates
      let xVal = coordinates[0];
      let yVal = coordinates[1];
      const base = {
        id,
        x: xVal,
        y: yVal,
        annotationValues,
        annotationDisplayValues,
        numericAnnotationValues,
        numericAnnotationTypes,
        annotationScores,
        annotationEvidence,
        originalIndex: index,
      } as PlotDataPoint;
      if (coordinates.length === 3) {
        base.z = coordinates[2];
        if (projectionPlane === 'xz') {
          yVal = coordinates[2];
        } else if (projectionPlane === 'yz') {
          xVal = coordinates[1];
          yVal = coordinates[2];
        }
        base.x = xVal;
        base.y = yVal;
      }
      return base;
    });

    // Apply isolation filtering if needed
    if (isolationMode && isolationHistory && isolationHistory.length > 0) {
      let filteredData = processedData.filter((p) => isolationHistory[0].includes(p.id));

      for (let i = 1; i < isolationHistory.length; i++) {
        const splitIds = isolationHistory[i];
        filteredData = filteredData.filter((p) => splitIds.includes(p.id));
      }

      return filteredData;
    }

    return processedData;
  }

  static createScales(
    plotData: PlotDataPoint[],
    width: number,
    height: number,
    margin: { top: number; right: number; bottom: number; left: number },
  ) {
    if (plotData.length === 0) return null;

    const xExtent = d3.extent(plotData, (d) => d.x) as [number, number];
    const yExtent = d3.extent(plotData, (d) => d.y) as [number, number];

    const xPadding = Math.abs(xExtent[1] - xExtent[0]) * 0.05;
    const yPadding = Math.abs(yExtent[1] - yExtent[0]) * 0.05;

    return {
      x: d3
        .scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .range([margin.left, width - margin.right]),
      y: d3
        .scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([height - margin.bottom, margin.top]),
    };
  }
}
