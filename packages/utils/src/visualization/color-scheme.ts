import {
  schemeCategory10,
  interpolateViridis,
  interpolatePlasma,
  interpolateTurbo,
  interpolateRdYlBu,
  interpolateSpectral,
} from 'd3-scale-chromatic';

export const COLOR_SCHEMES = {
  // Scientific color schemes
  scientific: [
    '#d73027',
    '#f46d43',
    '#fdae61',
    '#fee08b',
    '#e6f598',
    '#abdda4',
    '#66c2a5',
    '#3288bd',
  ],

  // Colorblind-friendly schemes
  colorblind: ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7'],

  // Category schemes
  category10: schemeCategory10,
  category20: schemeCategory10,

  // Sequential schemes
  viridis: (t: number) => interpolateViridis(t),
  plasma: (t: number) => interpolatePlasma(t),
  turbo: (t: number) => interpolateTurbo(t),

  // Diverging schemes
  rdylbu: (t: number) => interpolateRdYlBu(t),
  spectral: (t: number) => interpolateSpectral(t),

  // Protein-specific schemes
  proteinFamilies: [
    '#1f77b4', // Blue - Structural
    '#ff7f0e', // Orange - Enzymatic
    '#2ca02c', // Green - Transport
    '#d62728', // Red - Toxin
    '#9467bd', // Purple - Regulatory
    '#8c564b', // Brown - Membrane
    '#e377c2', // Pink - Signaling
    '#7f7f7f', // Gray - Unknown
    '#bcbd22', // Olive - Metabolic
    '#17becf', // Cyan - Defense
  ],

  // Taxonomic schemes
  taxonomy: [
    '#e41a1c', // Red - Bacteria
    '#377eb8', // Blue - Archaea
    '#4daf4a', // Green - Eukaryota
    '#984ea3', // Purple - Viruses
    '#ff7f00', // Orange - Other
    '#ffff33', // Yellow - Unclassified
    '#a65628', // Brown - Synthetic
    '#f781bf', // Pink - Hybrid
  ],
};

export function generateColorScale(
  values: string[],
  scheme: keyof typeof COLOR_SCHEMES = 'category10',
): string[] {
  const colors = COLOR_SCHEMES[scheme];

  if (Array.isArray(colors)) {
    return values.map((_, i) => colors[i % colors.length]);
  }

  // For interpolator functions
  return values.map((_, i) => (colors as Function)(i / Math.max(1, values.length - 1)));
}
