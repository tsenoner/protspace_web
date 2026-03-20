import type { ProtspaceLegend, ProtspaceScatterplot } from '@protspace/core';
import { buildPublicationLegendModel, type PublicationLegendModel } from '@protspace/utils';

export function buildPublicationLegendModelFromDom(
  plotElement: ProtspaceScatterplot,
  legendElement: ProtspaceLegend,
  selectedProteinIds: readonly string[],
): PublicationLegendModel {
  const legendExport = legendElement.getLegendExportData();
  const data = plotElement.getCurrentData();
  return buildPublicationLegendModel({
    legendExport,
    data,
    annotationKey: plotElement.selectedAnnotation,
    selectedProteinIds,
    hiddenAnnotationValues: plotElement.hiddenAnnotationValues ?? [],
  });
}
