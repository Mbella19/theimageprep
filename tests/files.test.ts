import { describe, it, expect } from 'vitest';
import {
  safeFileName,
  safeZipPath,
  withExtension,
  withSuffix,
  stemOf,
  extensionOf,
  aspectRatioLabel,
  isProbablyImage,
} from '../src/lib/files';

describe('safeFileName', () => {
  it('strips characters that break downloads', () => {
    expect(safeFileName('a/b\\c?d%e*f:g|h"i<j>k')).toBe('a-b-c-d-e-f-g-h-i-j-k');
  });

  it('collapses whitespace and trims', () => {
    expect(safeFileName('  my   photo .jpg ')).toBe('my photo .jpg');
  });

  it('caps absurdly long names', () => {
    expect(safeFileName('x'.repeat(500)).length).toBe(120);
  });
});

describe('safeZipPath', () => {
  /**
   * Regression test. `safeFileName` replaces "/" with "-", which is correct for
   * a download filename and silently flattened the platform subfolders in the
   * social-sizes ZIP into one directory.
   */
  it('KEEPS folder separators', () => {
    expect(safeZipPath('instagram/photo-1080x1080.jpg')).toBe('instagram/photo-1080x1080.jpg');
  });

  it('still sanitises each segment', () => {
    expect(safeZipPath('in:stagram/pho?to.jpg')).toBe('in-stagram/pho-to.jpg');
  });

  it('refuses directory traversal', () => {
    expect(safeZipPath('../../etc/passwd')).toBe('etc/passwd');
    expect(safeZipPath('a/./b')).toBe('a/b');
  });

  it('drops empty segments from double slashes', () => {
    expect(safeZipPath('a//b')).toBe('a/b');
    expect(safeZipPath('/leading.jpg')).toBe('leading.jpg');
  });
});

describe('filename helpers', () => {
  it('swaps the extension for a target format', () => {
    expect(withExtension('holiday.HEIC', 'jpeg')).toBe('holiday.jpg');
    expect(withExtension('logo.png', 'webp')).toBe('logo.webp');
    expect(withExtension('no-extension', 'png')).toBe('no-extension.png');
  });

  it('inserts a suffix before the extension', () => {
    expect(withSuffix('photo.jpg', '-compressed')).toBe('photo-compressed.jpg');
    expect(withSuffix('archive.tar.gz', '-x')).toBe('archive.tar-x.gz');
    expect(withSuffix('noext', '-x')).toBe('noext-x');
  });

  it('reads stems and extensions', () => {
    expect(stemOf('a/b/photo.jpg')).toBe('a/b/photo');
    expect(extensionOf('photo.JPEG')).toBe('jpeg');
    expect(extensionOf('noext')).toBe('');
  });
});

describe('aspectRatioLabel', () => {
  it('reduces common ratios', () => {
    expect(aspectRatioLabel(1920, 1080)).toBe('16:9');
    expect(aspectRatioLabel(1080, 1080)).toBe('1:1');
    expect(aspectRatioLabel(1080, 1350)).toBe('4:5');
    expect(aspectRatioLabel(640, 480)).toBe('4:3');
  });

  it('falls back to a decimal for ratios nobody would recognise', () => {
    // 1273:717 tells the reader nothing.
    expect(aspectRatioLabel(1273, 717)).toMatch(/^\d+\.\d+:1$/);
  });
});

describe('isProbablyImage', () => {
  const file = (name: string, type: string) => ({ name, type }) as File;

  it('accepts by MIME type', () => {
    expect(isProbablyImage(file('x.jpg', 'image/jpeg'))).toBe(true);
  });

  it('accepts HEIC even when the OS reports no useful type', () => {
    // macOS and Windows frequently hand over an empty type for .heic
    expect(isProbablyImage(file('IMG_0001.HEIC', ''))).toBe(true);
    expect(isProbablyImage(file('IMG_0001.heif', 'application/octet-stream'))).toBe(true);
  });

  it('rejects non-images', () => {
    expect(isProbablyImage(file('notes.pdf', 'application/pdf'))).toBe(false);
    expect(isProbablyImage(file('data.csv', 'text/csv'))).toBe(false);
  });
});
