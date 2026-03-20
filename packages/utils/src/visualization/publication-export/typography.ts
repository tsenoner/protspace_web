export const PRINT_DPI_DEFAULT = 300;

export function ptToPx(pt: number, dpi: number = PRINT_DPI_DEFAULT): number {
  return (pt * dpi) / 72;
}

export function mmToPx(mm: number, dpi: number = PRINT_DPI_DEFAULT): number {
  return (mm / 25.4) * dpi;
}

export function legendBodyPt(
  legendInnerHeightMm: number,
  displayedItemCount: number,
  headerMm: number,
): number {
  const bodyMm = Math.max(4, legendInnerHeightMm - headerMm);
  const density = displayedItemCount / Math.max(bodyMm, 1);
  let pt = 10 - Math.min(3, density * 2);
  return Math.max(7, Math.min(10, pt));
}
