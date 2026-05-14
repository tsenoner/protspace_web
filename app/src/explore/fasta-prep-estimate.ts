// Rough model: 10s of fixed overhead + 0.25s per sequence.
// Calibrated against the observation that ~700 sequences embeds in ~3 min.
const BASE_OVERHEAD_SECONDS = 10;
const SECONDS_PER_SEQUENCE = 0.25;

export async function countFastaSequences(file: File): Promise<number> {
  const text = await file.text();
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) !== 0x3e /* '>' */) continue;
    if (i === 0 || text.charCodeAt(i - 1) === 0x0a /* '\n' */) count++;
  }
  return count;
}

export function estimateEmbedSeconds(seqCount: number): number {
  if (seqCount <= 0) return BASE_OVERHEAD_SECONDS;
  return BASE_OVERHEAD_SECONDS + SECONDS_PER_SEQUENCE * seqCount;
}

export function formatEstimate(seconds: number): string {
  if (seconds < 60) {
    const rounded = Math.max(10, Math.round(seconds / 10) * 10);
    return `~${rounded} sec`;
  }
  const minutes = seconds / 60;
  if (minutes < 2) return '~1 min';
  if (minutes < 10) {
    const half = Math.round(minutes * 2) / 2;
    return `~${half} min`;
  }
  return `~${Math.round(minutes)} min`;
}

export function formatEmbeddingLabel(seqCount: number): string {
  return `Embedding sequences (${formatEstimate(estimateEmbedSeconds(seqCount))})…`;
}
