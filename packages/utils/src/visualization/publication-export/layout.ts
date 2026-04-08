import type { FigureLayout } from './presets';

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

function placeLegendRight(
  innerX: number,
  innerY: number,
  innerW: number,
  innerH: number,
  scatterAspect: number,
  legendBandMm: number,
): { scatterMm: MmRect; legendMm: MmRect } {
  const availScatterW = innerW - legendBandMm;
  const hFromW = availScatterW / scatterAspect;
  const scatterH = Math.min(hFromW, innerH);
  const scatterW = scatterH * scatterAspect;
  const scatterX = innerX + (availScatterW - scatterW) / 2;
  const scatterY = innerY + (innerH - scatterH) / 2;
  return {
    scatterMm: { x: scatterX, y: scatterY, width: scatterW, height: scatterH },
    legendMm: { x: innerX + availScatterW, y: innerY, width: legendBandMm, height: innerH },
  };
}

function placeLegendVertical(
  innerX: number,
  innerY: number,
  innerW: number,
  innerH: number,
  scatterAspect: number,
  legendBandMm: number,
  legendOnTop: boolean,
): { scatterMm: MmRect; legendMm: MmRect } {
  const availScatterH = innerH - legendBandMm;
  const wFromH = availScatterH * scatterAspect;
  const scatterW = Math.min(wFromH, innerW);
  const scatterH = scatterW / scatterAspect;
  const scatterX = innerX + (innerW - scatterW) / 2;

  if (legendOnTop) {
    const scatterY = innerY + legendBandMm + (availScatterH - scatterH) / 2;
    return {
      scatterMm: { x: scatterX, y: scatterY, width: scatterW, height: scatterH },
      legendMm: { x: innerX, y: innerY, width: innerW, height: legendBandMm },
    };
  }

  const scatterY = innerY + (availScatterH - scatterH) / 2;
  return {
    scatterMm: { x: scatterX, y: scatterY, width: scatterW, height: scatterH },
    legendMm: { x: innerX, y: innerY + availScatterH, width: innerW, height: legendBandMm },
  };
}

export function computePublicationLayout(layout: FigureLayout): PublicationLayout {
  const { widthMm, heightMm, paddingMm, legendBandMm, scatterAspect, legend } = layout;
  const innerX = paddingMm;
  const innerY = paddingMm;
  const innerW = widthMm - 2 * paddingMm;
  const innerH = heightMm - 2 * paddingMm;

  let placed: { scatterMm: MmRect; legendMm: MmRect };
  switch (legend.placement) {
    case 'right':
      placed = placeLegendRight(innerX, innerY, innerW, innerH, scatterAspect, legendBandMm);
      break;
    case 'below':
      placed = placeLegendVertical(
        innerX,
        innerY,
        innerW,
        innerH,
        scatterAspect,
        legendBandMm,
        false,
      );
      break;
    case 'top':
      placed = placeLegendVertical(
        innerX,
        innerY,
        innerW,
        innerH,
        scatterAspect,
        legendBandMm,
        true,
      );
      break;
  }

  return {
    figureMm: { width: widthMm, height: heightMm },
    scatterMm: placed.scatterMm,
    legendMm: placed.legendMm,
  };
}
