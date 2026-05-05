/**
 * Inject a `pHYs` chunk into a PNG so it carries the chosen DPI metadata.
 * Standalone, dependency-free implementation — no third-party libs in
 * the export path.
 *
 * PNG layout: 8-byte signature, then chunks of `length(4) | type(4) | data(N) | crc(4)`.
 * The pHYs chunk encodes pixels-per-metre (uint32 X, uint32 Y) and a 1-byte
 * unit specifier (1 = metres). DPI → pixels-per-metre = round(dpi × 39.3701).
 *
 * We insert pHYs immediately after IHDR (always the first chunk) and before
 * the rest. Existing pHYs chunks are removed first so we don't end up with
 * two of them.
 */

const PNG_SIGNATURE_LENGTH = 8;
const INCH_PER_METRE = 39.3700787401575;
const PNG_SIGNATURE: ReadonlyArray<number> = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readUint32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0
  );
}

function writeUint32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function buildPhysChunk(dpi: number): Uint8Array {
  const ppm = Math.round(dpi * INCH_PER_METRE);
  const chunk = new Uint8Array(21); // 4 length + 4 type + 9 data + 4 crc
  writeUint32(chunk, 0, 9); // length
  chunk[4] = 0x70; // 'p'
  chunk[5] = 0x48; // 'H'
  chunk[6] = 0x59; // 'Y'
  chunk[7] = 0x73; // 's'
  writeUint32(chunk, 8, ppm); // pixelsPerUnitX
  writeUint32(chunk, 12, ppm); // pixelsPerUnitY
  chunk[16] = 1; // unit = metres
  // CRC over type + data
  writeUint32(chunk, 17, crc32(chunk.slice(4, 17)));
  return chunk;
}

/**
 * Return a new PNG blob carrying the given DPI in its `pHYs` chunk.
 * Existing pHYs chunks (if any) are stripped first.
 */
export async function pngWithDpi(blob: Blob, dpi: number): Promise<Blob> {
  const ab: ArrayBuffer = await blob.arrayBuffer();
  const buf = new Uint8Array(ab);
  if (buf.length < PNG_SIGNATURE_LENGTH) return blob;
  for (let i = 0; i < PNG_SIGNATURE_LENGTH; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) {
      console.warn('pngWithDpi: input is not a PNG (signature mismatch); returning unchanged');
      return blob;
    }
  }

  // IHDR is always the first chunk, fixed-size: 4 length + 4 type + 13 data + 4 crc = 25 bytes.
  const ihdrEnd = PNG_SIGNATURE_LENGTH + 25;
  if (ihdrEnd > buf.length) return blob;

  const ranges: Array<[number, number]> = [[0, ihdrEnd]];

  let cursor = ihdrEnd;
  let malformed = false;
  while (cursor < buf.length) {
    if (cursor + 8 > buf.length) {
      ranges.push([cursor, buf.length]);
      break;
    }
    const length = readUint32(buf, cursor);
    const total = 12 + length;
    if (cursor + total > buf.length) {
      malformed = true;
      break;
    }
    const tag = String.fromCharCode(
      buf[cursor + 4],
      buf[cursor + 5],
      buf[cursor + 6],
      buf[cursor + 7],
    );
    if (tag !== 'pHYs') {
      ranges.push([cursor, cursor + total]);
    }
    cursor += total;
  }
  if (malformed) {
    console.warn('pngWithDpi: chunk length runs past end of buffer; returning unchanged');
    return blob;
  }

  const phys = buildPhysChunk(dpi);

  // Compute total output size: head + phys + filtered tail.
  let totalSize = phys.length;
  for (const [start, end] of ranges) totalSize += end - start;

  const out = new Uint8Array(totalSize);
  let pos = 0;

  // Write head (first range = sig + IHDR).
  const [headStart, headEnd] = ranges[0];
  out.set(buf.subarray(headStart, headEnd), pos);
  pos += headEnd - headStart;

  // Write pHYs chunk right after IHDR.
  out.set(phys, pos);
  pos += phys.length;

  // Write remaining ranges (the non-pHYs tail chunks).
  for (let i = 1; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    out.set(buf.subarray(start, end), pos);
    pos += end - start;
  }

  return new Blob([out], { type: 'image/png' });
}
