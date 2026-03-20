export const MAX_CANVAS_DIMENSION = 8192;
export const MAX_CANVAS_AREA = 268435456;
export const SAFE_DIMENSION_MARGIN = 0.95;

export function validateCanvasDimensions(
  targetWidth: number,
  targetHeight: number,
): { isValid: boolean; reason?: string } {
  const effectiveMaxDimension = Math.floor(MAX_CANVAS_DIMENSION * SAFE_DIMENSION_MARGIN);

  if (targetWidth > effectiveMaxDimension || targetHeight > effectiveMaxDimension) {
    return {
      isValid: false,
      reason: `Dimensions exceed browser limit of ${MAX_CANVAS_DIMENSION}px per side. Maximum safe dimension: ${effectiveMaxDimension}px`,
    };
  }

  const totalPixels = targetWidth * targetHeight;
  const maxSafeArea = MAX_CANVAS_AREA * SAFE_DIMENSION_MARGIN;
  if (totalPixels > maxSafeArea) {
    return {
      isValid: false,
      reason: `Total pixel area (${totalPixels.toLocaleString()}) exceeds browser limit (~${Math.floor(maxSafeArea).toLocaleString()} pixels)`,
    };
  }

  return { isValid: true };
}
