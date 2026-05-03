/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { pngWithDpi } from './phys-chunk';

// 1×1 transparent PNG (no pHYs chunk). Bytes verified against `xxd` output.
// Structure: signature(8) + IHDR(25) + IDAT(4+4+11+4=23) + IEND(12) = 68 bytes
const ONE_BY_ONE_PNG = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a, // PNG signature
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x48,
  0x44,
  0x52, // IHDR length(13) + type
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01, // width=1, height=1
  0x08,
  0x06,
  0x00,
  0x00,
  0x00,
  0x1f,
  0x15,
  0xc4,
  0x89, // IHDR data + CRC
  0x00,
  0x00,
  0x00,
  0x0b,
  0x49,
  0x44,
  0x41,
  0x54, // IDAT length(11) + type
  0x78,
  0xda,
  0x63,
  0x60,
  0x00,
  0x02,
  0x00,
  0x00, // IDAT data (zlib-compressed)
  0x05,
  0x00,
  0x01, // IDAT data (continued)
  0xe9,
  0xfa,
  0xdc,
  0xd8, // IDAT CRC
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4e,
  0x44, // IEND length(0) + type
  0xae,
  0x42,
  0x60,
  0x82, // IEND CRC
]);

function readUint32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0
  );
}

function findChunk(buf: Uint8Array, type: string): { dataOffset: number; length: number } | null {
  let offset = 8;
  while (offset < buf.length) {
    const length = readUint32(buf, offset);
    const tag = String.fromCharCode(
      buf[offset + 4],
      buf[offset + 5],
      buf[offset + 6],
      buf[offset + 7],
    );
    if (tag === type) return { dataOffset: offset + 8, length };
    offset += 12 + length;
  }
  return null;
}

describe('pngWithDpi', () => {
  it('inserts a pHYs chunk after IHDR for 300 DPI', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const out = await pngWithDpi(blob, 300);
    const buf = new Uint8Array(await out.arrayBuffer());
    const phys = findChunk(buf, 'pHYs');
    expect(phys).not.toBeNull();
    expect(phys!.length).toBe(9);
    const ppmX = readUint32(buf, phys!.dataOffset);
    const ppmY = readUint32(buf, phys!.dataOffset + 4);
    const unit = buf[phys!.dataOffset + 8];
    expect(ppmX).toBe(11811); // 300 * 39.3701 rounded
    expect(ppmY).toBe(11811);
    expect(unit).toBe(1); // metres
  });

  it('round-trips 600 DPI', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const out = await pngWithDpi(blob, 600);
    const buf = new Uint8Array(await out.arrayBuffer());
    const phys = findChunk(buf, 'pHYs');
    expect(phys).not.toBeNull();
    const ppmX = readUint32(buf, phys!.dataOffset);
    expect(ppmX).toBe(23622); // 600 * 39.3701 rounded
  });

  it('produces a valid PNG (CRC32) — IEND still parseable', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const out = await pngWithDpi(blob, 300);
    const buf = new Uint8Array(await out.arrayBuffer());
    const iend = findChunk(buf, 'IEND');
    expect(iend).not.toBeNull();
    expect(iend!.length).toBe(0);
  });

  it('preserves IHDR contents', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const out = await pngWithDpi(blob, 300);
    const buf = new Uint8Array(await out.arrayBuffer());
    const ihdr = findChunk(buf, 'IHDR');
    expect(ihdr).not.toBeNull();
    expect(ihdr!.length).toBe(13);
    // Width and height of original (1×1)
    expect(readUint32(buf, ihdr!.dataOffset)).toBe(1);
    expect(readUint32(buf, ihdr!.dataOffset + 4)).toBe(1);
  });

  it('pHYs chunk carries a correct CRC32', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const out = await pngWithDpi(blob, 300);
    const buf = new Uint8Array(await out.arrayBuffer());
    const phys = findChunk(buf, 'pHYs');
    expect(phys).not.toBeNull();
    // CRC sits immediately after the 9-byte data block.
    const crcOffset = phys!.dataOffset + 9;
    const storedCrc = readUint32(buf, crcOffset);
    expect(storedCrc).toBe(0x78a53f76); // independently computed for {type='pHYs', ppm=11811, ppm=11811, unit=1}
  });

  it('replaces a pre-existing pHYs chunk rather than duplicating it', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const first = await pngWithDpi(blob, 96);
    const second = await pngWithDpi(first, 300);
    const buf = new Uint8Array(await second.arrayBuffer());

    // Exactly one pHYs chunk should be present.
    let physCount = 0;
    let offset = 8;
    while (offset < buf.length) {
      const length = readUint32(buf, offset);
      const tag = String.fromCharCode(
        buf[offset + 4],
        buf[offset + 5],
        buf[offset + 6],
        buf[offset + 7],
      );
      if (tag === 'pHYs') physCount++;
      offset += 12 + length;
    }
    expect(physCount).toBe(1);

    // And it carries the new (300 DPI) value, not the stale one.
    const phys = findChunk(buf, 'pHYs');
    expect(readUint32(buf, phys!.dataOffset)).toBe(11811);
  });
});
