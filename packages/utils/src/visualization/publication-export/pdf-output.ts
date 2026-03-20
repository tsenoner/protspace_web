import type { PublicationLayout } from './layout';

export async function downloadPublicationPdf(
  rasterCanvas: HTMLCanvasElement,
  layout: PublicationLayout,
  fileName: string,
): Promise<void> {
  const { default: JsPDF } = await import('jspdf');
  const w = layout.figureMm.width;
  const h = layout.figureMm.height;
  const pdf = new JsPDF({
    orientation: w > h ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [w, h],
  });
  const img = rasterCanvas.toDataURL('image/png', 1.0);
  pdf.addImage(img, 'PNG', 0, 0, w, h);
  pdf.save(fileName);
}
