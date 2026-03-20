import type { FigurePreset, LegendPlacement } from './presets';

export interface MmRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PublicationLayout {
  figureMm: { width: number; height: number };
  scatterMm: MmRect;
  legendMm: MmRect;
}

export function computePublicationLayout(
  preset: FigurePreset,
  placement: LegendPlacement,
): PublicationLayout {
  const { widthMm, heightMm, paddingMm, legendBandMm, scatterAspect } = preset;
  const innerX = paddingMm;
  const innerY = paddingMm;
  const innerW = widthMm - 2 * paddingMm;
  const innerH = heightMm - 2 * paddingMm;

  let scatterMm: MmRect;
  let legendMm: MmRect;

  if (placement === 'right') {
    const legendW = legendBandMm.right;
    const availScatterW = innerW - legendW;
    const hFromW = availScatterW / scatterAspect;
    const scatterH = Math.min(hFromW, innerH);
    const scatterW = scatterH * scatterAspect;
    const scatterX = innerX + (availScatterW - scatterW) / 2;
    const scatterY = innerY + (innerH - scatterH) / 2;
    scatterMm = { x: scatterX, y: scatterY, width: scatterW, height: scatterH };
    legendMm = {
      x: innerX + availScatterW,
      y: innerY,
      width: legendW,
      height: innerH,
    };
  } else {
    const legendH = legendBandMm.below;
    const availScatterH = innerH - legendH;
    const wFromH = availScatterH * scatterAspect;
    const scatterW = Math.min(wFromH, innerW);
    const scatterH = scatterW / scatterAspect;
    const scatterX = innerX + (innerW - scatterW) / 2;
    const scatterY = innerY + (availScatterH - scatterH) / 2;
    scatterMm = { x: scatterX, y: scatterY, width: scatterW, height: scatterH };
    legendMm = {
      x: innerX,
      y: innerY + availScatterH,
      width: innerW,
      height: legendH,
    };
  }

  return {
    figureMm: { width: widthMm, height: heightMm },
    scatterMm,
    legendMm,
  };
}
