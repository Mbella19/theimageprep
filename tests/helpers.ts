import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixturesDir, name)));
}

/**
 * Decodes to raw pixels so two encoded files can be compared for pixel
 * equality. This is what turns "lossless" from a claim into a test.
 */
export async function rawPixels(bytes: Uint8Array): Promise<Buffer> {
  return sharp(Buffer.from(bytes)).raw().toBuffer();
}

export async function metadataOf(bytes: Uint8Array) {
  return sharp(Buffer.from(bytes)).metadata();
}

/** Asserts two encoded images decode to byte-identical pixel data. */
export async function expectPixelIdentical(
  a: Uint8Array,
  b: Uint8Array,
): Promise<void> {
  const [pa, pb] = await Promise.all([rawPixels(a), rawPixels(b)]);
  if (pa.length !== pb.length) {
    throw new Error(`Pixel buffers differ in length: ${pa.length} vs ${pb.length}`);
  }
  if (!pa.equals(pb)) {
    let firstDiff = -1;
    for (let i = 0; i < pa.length; i++) {
      if (pa[i] !== pb[i]) {
        firstDiff = i;
        break;
      }
    }
    throw new Error(`Pixel data differs at byte ${firstDiff} of ${pa.length}`);
  }
}
