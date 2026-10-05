// C1-1: compress the tag photo in the browser before upload. PLAN S1:
// long edge 1568px, JPEG 0.85, EXIF orientation applied.
// Pure helpers (sizing, base64, JPEG header parsing) are exported for tests;
// the canvas work sits behind `ImageCodec` so it can be faked in node.

export const IMAGE_MAX_EDGE = 1568;
export const IMAGE_JPEG_QUALITY = 0.85;
export const IMAGE_MIME = 'image/jpeg';
/** How much of the file to scan for the EXIF/SOF headers. */
const HEADER_SCAN_BYTES = 512 * 1024;

// ---------- capture timing ----------

/** The caller records t0 the moment a file is chosen (PLAN S1), before compressing. */
export interface CaptureStart {
  file: File;
  /** `performance.now()` at file selection. */
  t0: number;
}

export function markCaptureStart(
  file: File,
  now: () => number = () => performance.now(),
): CaptureStart {
  return { file, t0: now() };
}

// ---------- pure: sizing ----------

export interface TargetSize {
  width: number;
  height: number;
  /** <= 1. Never upscales. */
  scale: number;
}

/** Fit (width, height) so the long edge is at most `maxEdge`, keeping aspect ratio. */
export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number = IMAGE_MAX_EDGE,
): TargetSize {
  for (const v of [width, height, maxEdge]) {
    if (!Number.isFinite(v) || v <= 0) throw new RangeError(`invalid image size: ${v}`);
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  if (scale === 1) return { width: Math.round(width), height: Math.round(height), scale };
  return {
    width: Math.max(1, Math.min(maxEdge, Math.round(width * scale))),
    height: Math.max(1, Math.min(maxEdge, Math.round(height * scale))),
    scale,
  };
}

// ---------- pure: base64 ----------

/** Plain base64 (no `data:` prefix). Chunked so large photos don't overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ---------- pure: JPEG header (EXIF orientation + stored size) ----------

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface JpegHeaderInfo {
  /** EXIF orientation, 1 when the tag is absent. */
  orientation: ExifOrientation;
  /** Stored (un-rotated) pixel size from the SOF marker, or null if not found. */
  width: number | null;
  height: number | null;
}

function readExifOrientation(view: DataView, start: number, end: number): ExifOrientation | null {
  // "Exif\0\0" then TIFF header
  if (end - start < 14 || view.getUint32(start) !== 0x45786966 || view.getUint16(start + 4) !== 0)
    return null;
  const tiff = start + 6;
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const le = order === 0x4949;
  if (view.getUint16(tiff + 2, le) !== 42) return null;
  const ifd0 = tiff + view.getUint32(tiff + 4, le);
  if (ifd0 + 2 > end) return null;
  const count = view.getUint16(ifd0, le);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > end) return null;
    if (view.getUint16(entry, le) === 0x0112) {
      const value = view.getUint16(entry + 8, le);
      return value >= 1 && value <= 8 ? (value as ExifOrientation) : null;
    }
  }
  return null;
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** Parse a JPEG's EXIF orientation and stored size. Null if not a JPEG. Never throws. */
export function readJpegHeader(bytes: Uint8Array): JpegHeaderInfo | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return null;
    let orientation: ExifOrientation | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let pos = 2;
    while (pos + 4 <= bytes.length) {
      if (bytes[pos] !== 0xff) break;
      const marker = bytes[pos + 1]!;
      if (marker === 0xff) {
        pos += 1; // fill byte
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break; // EOI / start of scan
      const len = view.getUint16(pos + 2);
      const segStart = pos + 4;
      const segEnd = Math.min(pos + 2 + len, bytes.length);
      if (marker === 0xe1 && orientation === null) {
        orientation = readExifOrientation(view, segStart, segEnd);
      } else if (SOF_MARKERS.has(marker) && segStart + 5 <= bytes.length) {
        height = view.getUint16(segStart + 1);
        width = view.getUint16(segStart + 3);
      }
      if (width !== null && orientation !== null) break;
      pos += 2 + len;
    }
    return { orientation: orientation ?? 1, width, height };
  } catch {
    return null;
  }
}

/**
 * True when orientation 5–8 (90° turns) was clearly NOT applied by the decoder:
 * the decoded size equals the stored size instead of being swapped.
 * (Orientations 2–4 keep the size, so they cannot be checked this way.)
 */
export function orientationLooksIgnored(
  header: JpegHeaderInfo | null,
  decoded: { width: number; height: number },
): boolean {
  if (!header || header.orientation < 5 || header.width === null || header.height === null)
    return false;
  if (header.width === header.height) return false;
  return decoded.width === header.width && decoded.height === header.height;
}

// ---------- codec (browser) ----------

export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

export interface ImageCodec {
  /** Decode with EXIF orientation applied. */
  decode(file: Blob): Promise<DecodedImage>;
  /** Draw `img` scaled to width x height and encode as JPEG. */
  encode(img: DecodedImage, width: number, height: number, quality: number): Promise<Blob>;
}

async function decodeWithBitmap(file: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  };
}

async function decodeWithImgElement(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  // browsers apply EXIF orientation to <img> (CSS image-orientation: from-image is the default)
  img.style.imageOrientation = 'from-image';
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}

async function readHeader(file: Blob): Promise<JpegHeaderInfo | null> {
  try {
    return readJpegHeader(new Uint8Array(await file.slice(0, HEADER_SCAN_BYTES).arrayBuffer()));
  } catch {
    return null;
  }
}

function drawToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: DecodedImage,
  width: number,
  height: number,
): void {
  ctx.fillStyle = '#fff'; // transparent PNGs would turn black in JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.source, 0, 0, width, height);
}

export const browserImageCodec: ImageCodec = {
  async decode(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        const [decoded, header] = await Promise.all([decodeWithBitmap(file), readHeader(file)]);
        if (!orientationLooksIgnored(header, decoded)) return decoded;
        decoded.close(); // this browser ignored EXIF in createImageBitmap; try <img>
      } catch {
        // fall through to <img>
      }
    }
    return decodeWithImgElement(file);
  },

  async encode(img, width, height, quality) {
    if (typeof OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawToCanvas(ctx, img, width, height);
        return canvas.convertToBlob({ type: IMAGE_MIME, quality });
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    drawToCanvas(ctx, img, width, height);
    try {
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
          IMAGE_MIME,
          quality,
        ),
      );
    } finally {
      // release the backing store early (iOS Safari has a tight total canvas memory limit)
      canvas.width = 0;
      canvas.height = 0;
    }
  },
};

// ---------- compress ----------

export type ImageCompressErrorCode = 'not_image' | 'decode_failed' | 'encode_failed';

export class ImageCompressError extends Error {
  readonly code: ImageCompressErrorCode;
  constructor(code: ImageCompressErrorCode, cause?: unknown) {
    super(`image compress failed: ${code}`, { cause });
    this.name = 'ImageCompressError';
    this.code = code;
  }
}

export interface CompressedImage {
  /** JPEG bytes as base64, no `data:` prefix — the `imageBase64` field of /api/read-tag. */
  base64: string;
  /** The same JPEG, e.g. for barcode decoding. */
  blob: Blob;
  mimeType: typeof IMAGE_MIME;
  width: number;
  height: number;
  /** JPEG size in bytes (before base64). */
  bytes: number;
}

export interface CompressOptions {
  maxEdge?: number;
  quality?: number;
  /** Injected for tests. Defaults to the canvas-based browser codec. */
  codec?: ImageCodec;
}

/**
 * Decode (EXIF-rotated), downscale to a 1568px long edge, re-encode as JPEG 0.85.
 * Rejects with ImageCompressError so the caller can show the retake / manual-entry path.
 */
export async function compressImage(
  file: Blob,
  options: CompressOptions = {},
): Promise<CompressedImage> {
  const maxEdge = options.maxEdge ?? IMAGE_MAX_EDGE;
  const quality = options.quality ?? IMAGE_JPEG_QUALITY;
  const codec = options.codec ?? browserImageCodec;

  // some Android pickers leave type empty; only reject when it is clearly not an image
  if (file.type && !file.type.startsWith('image/')) throw new ImageCompressError('not_image');

  let decoded: DecodedImage;
  try {
    decoded = await codec.decode(file);
  } catch (err) {
    throw new ImageCompressError('decode_failed', err);
  }
  if (!(decoded.width > 0 && decoded.height > 0)) {
    decoded.close();
    throw new ImageCompressError('decode_failed');
  }

  let blob: Blob;
  let target: TargetSize;
  try {
    target = computeTargetSize(decoded.width, decoded.height, maxEdge);
    blob = await codec.encode(decoded, target.width, target.height, quality);
  } catch (err) {
    throw new ImageCompressError('encode_failed', err);
  } finally {
    decoded.close();
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length === 0) throw new ImageCompressError('encode_failed');
  return {
    base64: bytesToBase64(bytes),
    blob,
    mimeType: IMAGE_MIME,
    width: target.width,
    height: target.height,
    bytes: bytes.length,
  };
}
