export interface WrappedLabel {
  lines: [string] | [string, string];
  truncated: boolean;
}

const ELLIPSIS = '…';

function truncateWithEllipsis(ctx: CanvasRenderingContext2D, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const t = s.slice(0, mid) + ELLIPSIS;
    if (ctx.measureText(t).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + ELLIPSIS;
}

export function wrapLabelToTwoLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
): WrappedLabel {
  if (ctx.measureText(text).width <= maxWidthPx) {
    return { lines: [text], truncated: false };
  }

  const words = text.split(/\s+/);
  let line1 = '';
  for (let i = 0; i < words.length; i++) {
    const next = line1 ? `${line1} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxWidthPx) line1 = next;
    else break;
  }
  if (!line1) {
    return { lines: [truncateWithEllipsis(ctx, text, maxWidthPx)], truncated: true };
  }

  const rest = text.slice(line1.length).trim();
  let line2 = '';
  for (const w of rest.split(/\s+/)) {
    const next = line2 ? `${line2} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidthPx) line2 = next;
    else break;
  }
  if (!line2) {
    line2 = truncateWithEllipsis(ctx, rest, maxWidthPx);
    return { lines: [line1, line2], truncated: true };
  }

  const remainder = rest.slice(line2.length).trim();
  if (remainder) {
    const budget = maxWidthPx - ctx.measureText(ELLIPSIS).width;
    line2 = truncateWithEllipsis(ctx, line2, budget) + ELLIPSIS;
    return { lines: [line1, line2], truncated: true };
  }
  return { lines: [line1, line2], truncated: false };
}
