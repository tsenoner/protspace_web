export function downloadPng(canvas: HTMLCanvasElement, fileName: string): void {
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
