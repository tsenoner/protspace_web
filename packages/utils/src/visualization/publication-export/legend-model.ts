export interface PublicationLegendRow {
  value: string;
  displayLabel: string;
  color: string;
  shape: string;
  count: number;
  isVisible: boolean;
  zOrder: number;
}

export interface PublicationLegendModel {
  annotationTitle: string;
  includeShapes: boolean;
  otherItemsCount: number;
  items: PublicationLegendRow[];
}

export interface LegendExportSnapshot {
  annotation: string;
  includeShapes: boolean;
  otherItemsCount: number;
  items: readonly {
    value: string;
    color: string;
    shape: string;
    count: number;
    isVisible: boolean;
    zOrder: number;
  }[];
}
