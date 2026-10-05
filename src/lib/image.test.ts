import { describe, expect, it, vi } from 'vitest';
import {
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_EDGE,
  ImageCompressError,
  bytesToBase64,
  compressImage,
  computeTargetSize,
  markCaptureStart,
  orientationLooksIgnored,
  readJpegHeader,
  type DecodedImage,
  type ImageCodec,
} from './image';

describe('computeTargetSize', () => {
  it('uses 1568 by default', () => {
    expect(IMAGE_MAX_EDGE).toBe(1568);
    expect(IMAGE_JPEG_QUALITY).toBe(0.85);
  });

  it('scales a 4:3 landscape phone photo to a 1568 long edge', () => {
    expect(computeTargetSize(4032, 3024)).toEqual({
      width: 1568,
      height: 1176,
      scale: 1568 / 4032,
    });
  });

  it('scales a portrait photo by its height', () => {
    const t = computeTargetSize(3024, 4032);
    expect(t.width).toBe(1176);
    expect(t.height).toBe(1568);
  });

  it('keeps aspect ratio within rounding', () => {
    const t = computeTargetSize(4000, 1800);
    expect(t.width).toBe(1568);
    expect(t.height).toBe(Math.round(1800 * (1568 / 4000))); // 706
    expect(Math.abs(t.width / t.height - 4000 / 1800)).toBeLessThan(0.01);
  });

  it('never upscales small images', () => {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
    expect(computeTargetSize(1568, 1000)).toEqual({ width: 1568, height: 1000, scale: 1 });
  });

  it('handles squares and extreme panoramas (min 1px)', () => {
    expect(computeTargetSize(5000, 5000)).toMatchObject({ width: 1568, height: 1568 });
    expect(computeTargetSize(100000, 10)).toMatchObject({ width: 1568, height: 1 });
  });

  it('honours a custom max edge', () => {
    expect(computeTargetSize(2000, 1000, 1000)).toMatchObject({ width: 1000, height: 500 });
  });

  it.each([
    [0, 100],
    [100, -1],
    [Number.NaN, 100],
    [100, Number.POSITIVE_INFINITY],
  ])('throws on invalid size %s x %s', (w, h) => {
    expect(() => computeTargetSize(w, h)).toThrow(RangeError);
  });
});

describe('bytesToBase64', () => {
  it('encodes known bytes as plain base64 with no data: prefix', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 250]);
    expect(bytesToBase64(bytes)).toBe('/9j/4AABAvo=');
    expect(bytesToBase64(bytes).startsWith('data:')).toBe(false);
  });

  it('handles empty and large (multi-chunk) input', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
    const big = new Uint8Array(200_000).map((_, i) => (i * 31) % 256);
    expect(bytesToBase64(big)).toBe(btoa(Array.from(big, (b) => String.fromCharCode(b)).join('')));
  });
});

// ---- minimal JPEG header builder ----
function u16(v: number, le = false): number[] {
  return le ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff];
}
function u32(v: number, le = false): number[] {
  const b = [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  return le ? b.reverse() : b;
}
function app1Exif(orientation: number, le: boolean): number[] {
  const tiff = [
    ...(le ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(42, le),
    ...u32(8, le),
    ...u16(2, le), // 2 entries
    ...u16(0x010f, le),
    ...u16(2, le),
    ...u32(4, le),
    ...u32(0, le), // Make (ignored)
    ...u16(0x0112, le),
    ...u16(3, le),
    ...u32(1, le),
    ...u16(orientation, le),
    0,
    0,
    ...u32(0, le),
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  return [0xff, 0xe1, ...u16(payload.length + 2), ...payload];
}
function app0Jfif(): number[] {
  const payload = [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  return [0xff, 0xe0, ...u16(payload.length + 2), ...payload];
}
function sof(marker: number, width: number, height: number): number[] {
  const payload = [8, ...u16(height), ...u16(width), 1, 1, 0x11, 0];
  return [0xff, marker, ...u16(payload.length + 2), ...payload];
}
function jpeg(...segments: number[][]): Uint8Array {
  return new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0, 2, 0xff, 0xd9]);
}

describe('readJpegHeader', () => {
  it('reads orientation (big endian) and stored size', () => {
    expect(readJpegHeader(jpeg(app1Exif(6, false), sof(0xc0, 4032, 3024)))).toEqual({
      orientation: 6,
      width: 4032,
      height: 3024,
    });
  });

  it('reads little-endian EXIF and progressive SOF2 after other segments', () => {
    expect(readJpegHeader(jpeg(app0Jfif(), app1Exif(8, true), sof(0xc2, 640, 480)))).toEqual({
      orientation: 8,
      width: 640,
      height: 480,
    });
  });

  it('defaults orientation to 1 when there is no EXIF', () => {
    expect(readJpegHeader(jpeg(app0Jfif(), sof(0xc0, 10, 20)))).toEqual({
      orientation: 1,
      width: 10,
      height: 20,
    });
  });

  it('skips 0xFF fill bytes between markers', () => {
    const bytes = jpeg([0xff], app1Exif(3, false), sof(0xc0, 30, 40));
    expect(readJpegHeader(bytes)).toEqual({ orientation: 3, width: 30, height: 40 });
  });

  it('returns null for non-JPEG, and never throws on truncated data', () => {
    expect(readJpegHeader(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(readJpegHeader(new Uint8Array())).toBeNull();
    const full = jpeg(app1Exif(6, false), sof(0xc0, 4032, 3024));
    for (let n = 0; n < full.length; n++) {
      expect(() => readJpegHeader(full.subarray(0, n))).not.toThrow();
    }
  });

  it('ignores an out-of-range orientation value', () => {
    expect(readJpegHeader(jpeg(app1Exif(9, false), sof(0xc0, 1, 2)))?.orientation).toBe(1);
  });
});

describe('orientationLooksIgnored', () => {
  const header = { orientation: 6 as const, width: 4032, height: 3024 };

  it('true when a 90° orientation left the size unswapped', () => {
    expect(orientationLooksIgnored(header, { width: 4032, height: 3024 })).toBe(true);
  });

  it('false when the decoder rotated', () => {
    expect(orientationLooksIgnored(header, { width: 3024, height: 4032 })).toBe(false);
  });

  it('false for orientations that keep the size, squares, or missing info', () => {
    expect(
      orientationLooksIgnored({ ...header, orientation: 3 }, { width: 4032, height: 3024 }),
    ).toBe(false);
    expect(
      orientationLooksIgnored(
        { orientation: 6, width: 100, height: 100 },
        { width: 100, height: 100 },
      ),
    ).toBe(false);
    expect(orientationLooksIgnored(null, { width: 4032, height: 3024 })).toBe(false);
    expect(
      orientationLooksIgnored(
        { orientation: 6, width: null, height: null },
        { width: 1, height: 2 },
      ),
    ).toBe(false);
  });
});

describe('markCaptureStart', () => {
  it('records t0 from the clock', () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    expect(markCaptureStart(file, () => 1234.5)).toEqual({ file, t0: 1234.5 });
  });
});

describe('compressImage (fake codec)', () => {
  const JPEG_OUT = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3]);

  function fakeCodec(w: number, h: number, overrides: Partial<ImageCodec> = {}) {
    const close = vi.fn();
    const decoded: DecodedImage = { source: {} as CanvasImageSource, width: w, height: h, close };
    const codec: ImageCodec = {
      decode: vi.fn(async () => decoded),
      encode: vi.fn(async () => new Blob([JPEG_OUT], { type: 'image/jpeg' })),
      ...overrides,
    };
    return { codec, close, decoded };
  }

  const photo = new Blob([new Uint8Array([0xff, 0xd8])], { type: 'image/jpeg' });

  it('downscales, encodes at 0.85 and returns base64 + size + bytes', async () => {
    const { codec, close, decoded } = fakeCodec(3024, 4032);
    const out = await compressImage(photo, { codec });
    expect(codec.encode).toHaveBeenCalledWith(decoded, 1176, 1568, 0.85);
    expect(out).toMatchObject({
      base64: '/9j/2QECAw==',
      mimeType: 'image/jpeg',
      width: 1176,
      height: 1568,
      bytes: JPEG_OUT.length,
    });
    expect(out.blob.size).toBe(JPEG_OUT.length);
    expect(close).toHaveBeenCalledOnce();
  });

  it('accepts files with an empty MIME type', async () => {
    const { codec } = fakeCodec(100, 50);
    const out = await compressImage(new Blob([new Uint8Array([1])]), { codec });
    expect(out).toMatchObject({ width: 100, height: 50 });
  });

  it('rejects non-image files before decoding', async () => {
    const { codec } = fakeCodec(100, 50);
    const err = await compressImage(new Blob(['x'], { type: 'application/pdf' }), { codec }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ImageCompressError);
    expect((err as ImageCompressError).code).toBe('not_image');
    expect(codec.decode).not.toHaveBeenCalled();
  });

  it('maps decode errors and zero-size decodes to decode_failed', async () => {
    const bad = fakeCodec(0, 0, {
      decode: vi.fn(async () => {
        throw new Error('HEIC not supported');
      }),
    });
    await expect(compressImage(photo, { codec: bad.codec })).rejects.toMatchObject({
      code: 'decode_failed',
    });
    const empty = fakeCodec(0, 10);
    await expect(compressImage(photo, { codec: empty.codec })).rejects.toMatchObject({
      code: 'decode_failed',
    });
    expect(empty.close).toHaveBeenCalledOnce();
  });

  it('maps encode errors (and empty output) to encode_failed and still releases the image', async () => {
    const failing = fakeCodec(100, 100, {
      encode: vi.fn(async () => {
        throw new Error('toBlob returned null');
      }),
    });
    await expect(compressImage(photo, { codec: failing.codec })).rejects.toMatchObject({
      code: 'encode_failed',
    });
    expect(failing.close).toHaveBeenCalledOnce();

    const emptyOut = fakeCodec(100, 100, { encode: vi.fn(async () => new Blob([])) });
    await expect(compressImage(photo, { codec: emptyOut.codec })).rejects.toMatchObject({
      code: 'encode_failed',
    });
  });
});
