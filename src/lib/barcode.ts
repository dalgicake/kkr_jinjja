// C1-2: decode a barcode from the (compressed) tag photo. PLAN S1 (a).
// Uses the `barcode-detector` ponyfill (zxing-wasm) so behaviour is the same on iOS Safari and Android.
// The detector is loaded lazily, so the ~1MB wasm is fetched only when a photo is scanned.

/** Formats PLAN S1 asks for. */
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const;
export type BarcodeFormatName = (typeof BARCODE_FORMATS)[number];
export type RetailBarcodeFormat = Exclude<BarcodeFormatName, 'code_128'>;

export interface FoundBarcode {
  /** Digits for EAN/UPC (checksum-valid), trimmed text for Code128. */
  code: string;
  format: BarcodeFormatName;
}

/** What a detector returns per barcode (subset of the Barcode Detection API's DetectedBarcode). */
export interface RawDetection {
  rawValue: string;
  format: string;
}

export interface BarcodeDetectorLike {
  detect(image: Blob | ImageBitmap | ImageData | HTMLCanvasElement): Promise<RawDetection[]>;
}

export type BarcodeSource = Blob | ImageBitmap | ImageData | HTMLCanvasElement;

export const BARCODE_TIMEOUT_MS = 4000;
const CODE128_MAX_LENGTH = 48;

// ---------- pure: check digits ----------

/**
 * GS1 mod-10 check digit for EAN-13, EAN-8 and UPC-A (GTIN-8/12/13).
 * Weights 3,1,3,... from the rightmost data digit.
 */
export function isValidGtinChecksum(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i]! * w;
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Expand an 8-digit UPC-E (number system + 6 digits + check) to its 12-digit UPC-A.
 * Returns null when the input is not 8 digits or the number system is not 0/1.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0]!;
  const d = code.slice(1, 7);
  const check = code[7]!;
  const [d1, d2, d3, d4, d5, d6] = [...d] as [string, string, string, string, string, string];
  let body: string;
  switch (d6) {
    case '0':
    case '1':
    case '2':
      body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
      break;
    case '3':
      body = `${d1}${d2}${d3}00000${d4}${d5}`;
      break;
    case '4':
      body = `${d1}${d2}${d3}${d4}00000${d5}`;
      break;
    default:
      body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }
  return `${ns}${body}${check}`;
}

/** Check digit validation per format. UPC-E is validated through its UPC-A expansion. */
export function isValidRetailBarcode(code: string, format: RetailBarcodeFormat): boolean {
  switch (format) {
    case 'ean_13':
      return code.length === 13 && isValidGtinChecksum(code);
    case 'ean_8':
      return code.length === 8 && isValidGtinChecksum(code);
    case 'upc_a':
      return code.length === 12 && isValidGtinChecksum(code);
    case 'upc_e': {
      const upcA = expandUpcE(code);
      return upcA !== null && isValidGtinChecksum(upcA);
    }
  }
}

function isBarcodeFormat(format: string): format is BarcodeFormatName {
  return (BARCODE_FORMATS as readonly string[]).includes(format);
}

/** Normalise one detection, or null if it is not a format we use / fails its checksum. */
export function validateDetection(d: RawDetection): FoundBarcode | null {
  if (typeof d.rawValue !== 'string' || !isBarcodeFormat(d.format)) return null;
  const value = d.rawValue.trim();
  if (d.format === 'code_128') {
    // printable ASCII only; store-internal codes can be anything, so only sanity-check the shape
    if (value.length === 0 || value.length > CODE128_MAX_LENGTH || !/^[\x20-\x7e]+$/.test(value))
      return null;
    return { code: value, format: 'code_128' };
  }
  return isValidRetailBarcode(value, d.format) ? { code: value, format: d.format } : null;
}

/**
 * Pick the code to use from a photo's detections: the first checksum-valid EAN/UPC,
 * else the first usable Code128 (shelf tags often carry store-internal Code128 codes,
 * so a retail code wins when both are present).
 */
export function pickBarcode(detections: readonly RawDetection[]): FoundBarcode | null {
  const valid = detections.map(validateDetection).filter((b): b is FoundBarcode => b !== null);
  return valid.find((b) => b.format !== 'code_128') ?? valid[0] ?? null;
}

// ---------- browser: detector ----------

let detectorPromise: Promise<BarcodeDetectorLike> | null = null;

async function loadDetector(): Promise<BarcodeDetectorLike> {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    // self-hosted wasm: no third-party CDN at runtime
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
  });
  return new BarcodeDetector({ formats: [...BARCODE_FORMATS] });
}

function getDetector(): Promise<BarcodeDetectorLike> {
  detectorPromise ??= loadDetector().catch((err: unknown) => {
    detectorPromise = null; // allow a later retry (e.g. wasm fetch failed on weak signal)
    throw err;
  });
  return detectorPromise;
}

/** Start loading the detector + wasm early (e.g. when the capture screen opens). Never throws. */
export function preloadBarcodeDetector(): void {
  getDetector().catch(() => undefined);
}

export interface DetectBarcodeOptions {
  /** Give up and resolve null after this many ms. Default 4000. */
  timeoutMs?: number;
  /** Injected detector (tests). Defaults to the lazily loaded ponyfill. */
  detector?: BarcodeDetectorLike;
}

/**
 * Decode the first valid barcode in the photo. Resolves null when none is found,
 * the detector fails to load, decoding errors, or it takes longer than `timeoutMs`.
 * Never rejects — the tag read must not depend on it.
 */
export async function detectBarcode(
  source: BarcodeSource,
  options: DetectBarcodeOptions = {},
): Promise<FoundBarcode | null> {
  const timeoutMs = options.timeoutMs ?? BARCODE_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  const work = (async () => {
    try {
      const detector = options.detector ?? (await getDetector());
      const detections = await detector.detect(source);
      return Array.isArray(detections) ? pickBarcode(detections) : null;
    } catch {
      return null;
    }
  })();
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
