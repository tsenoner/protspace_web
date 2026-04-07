export interface WrappedLabel {
  lines: string[];
  truncated: boolean;
}

const ELLIPSIS = '…';
const LINE_HEIGHT = 1;

async function loadPretext() {
  return import('@chenglou/pretext');
}

function truncateLineToWidth(
  text: string,
  maxWidthPx: number,
  measureWidth: (s: string) => number,
): string {
  if (measureWidth(text) <= maxWidthPx) return text;
  const ellipsisWidth = measureWidth(ELLIPSIS);
  const budget = maxWidthPx - ellipsisWidth;
  let lo = 0;
  let hi = [...text].length;
  const chars = [...text];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measureWidth(chars.slice(0, mid).join('')) <= budget) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join('') + ELLIPSIS;
}

export async function wrapLabelToTwoLines(
  text: string,
  font: string,
  maxWidthPx: number,
): Promise<WrappedLabel> {
  const pretext = await loadPretext();
  const prepared = pretext.prepareWithSegments(text, font);

  const result = pretext.layoutWithLines(prepared, maxWidthPx, LINE_HEIGHT);
  const allLines = result.lines;

  if (allLines.length === 0) {
    return { lines: [text], truncated: false };
  }

  const measureWidth = (s: string): number => {
    const p = pretext.prepareWithSegments(s, font);
    let w = 0;
    pretext.walkLineRanges(p, Infinity, (line) => {
      w = line.width;
    });
    return w;
  };

  if (allLines.length === 1) {
    const line = allLines[0];
    if (line.width <= maxWidthPx) {
      return { lines: [line.text], truncated: false };
    }
    return {
      lines: [truncateLineToWidth(line.text, maxWidthPx, measureWidth)],
      truncated: true,
    };
  }

  const line1 = allLines[0].text;

  if (allLines.length === 2) {
    const line2 = allLines[1];
    if (line2.width <= maxWidthPx) {
      return { lines: [line1, line2.text], truncated: false };
    }
    return {
      lines: [line1, truncateLineToWidth(line2.text, maxWidthPx, measureWidth)],
      truncated: true,
    };
  }

  const rawLine2 = allLines[1].text.trimEnd();
  const ellipsisWidth = measureWidth(ELLIPSIS);
  const line2 = truncateLineToWidth(rawLine2, maxWidthPx - ellipsisWidth, measureWidth) + ELLIPSIS;
  return {
    lines: [line1, line2],
    truncated: true,
  };
}
