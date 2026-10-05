import { describe, expect, it, vi } from 'vitest';
import {
  detectBarcode,
  expandUpcE,
  isValidGtinChecksum,
  isValidRetailBarcode,
  pickBarcode,
  validateDetection,
  type BarcodeDetectorLike,
  type RawDetection,
} from './barcode';

const EAN13 = '4006381333931';
const EAN13_KR = '8801007310107'; // made-up 880 prefix with a correct check digit
const EAN8 = '96385074';
const UPCA = '036000291452';
const UPCE = '04252614'; // UPC-A 042100005264

describe('isValidGtinChecksum', () => {
  it.each([EAN13, EAN13_KR, EAN8, UPCA, '042100005264'])('accepts %s', (code) => {
    expect(isValidGtinChecksum(code)).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidGtinChecksum('4006381333932')).toBe(false);
    expect(isValidGtinChecksum('96385075')).toBe(false);
    expect(isValidGtinChecksum('036000291453')).toBe(false);
  });

  it('rejects a single swapped digit', () => {
    expect(isValidGtinChecksum('4006381333391')).toBe(false);
  });

  it.each([
    '',
    '123',
    '1234567',
    '12345678901',
    '12345678901234',
    '40063813339a1',
    ' 4006381333931',
  ])('rejects malformed %j', (code) => {
    expect(isValidGtinChecksum(code)).toBe(false);
  });
});

describe('expandUpcE', () => {
  it.each([
    ['04252614', '042100005264'], // last digit 4
    ['01234565', '012345000065'], // last digit 5..9
    ['01234133', '012300000413'], // last digit 3 → manufacturer 3 digits + 00
    ['01234120', '012200003410'], // last digit 0..2
  ])('%s → %s', (upce, upca) => {
    expect(expandUpcE(upce)).toBe(upca);
  });

  it('rejects number system other than 0/1 and wrong length', () => {
    expect(expandUpcE('24252614')).toBeNull();
    expect(expandUpcE('0425261')).toBeNull();
    expect(expandUpcE('0425261a')).toBeNull();
  });
});

describe('isValidRetailBarcode', () => {
  it('validates per format', () => {
    expect(isValidRetailBarcode(EAN13, 'ean_13')).toBe(true);
    expect(isValidRetailBarcode(EAN8, 'ean_8')).toBe(true);
    expect(isValidRetailBarcode(UPCA, 'upc_a')).toBe(true);
    expect(isValidRetailBarcode(UPCE, 'upc_e')).toBe(true);
  });

  it('rejects a length that does not match the format', () => {
    expect(isValidRetailBarcode(EAN8, 'ean_13')).toBe(false);
    expect(isValidRetailBarcode(EAN13, 'ean_8')).toBe(false);
    expect(isValidRetailBarcode(EAN13, 'upc_a')).toBe(false);
    expect(isValidRetailBarcode(UPCA, 'ean_13')).toBe(false);
  });

  it('rejects UPC-E with a bad check digit', () => {
    expect(isValidRetailBarcode('04252615', 'upc_e')).toBe(false);
  });
});

describe('validateDetection / pickBarcode', () => {
  it('drops formats we do not use', () => {
    expect(validateDetection({ rawValue: 'hello', format: 'qr_code' })).toBeNull();
  });

  it('trims and keeps checksum-valid EAN', () => {
    expect(validateDetection({ rawValue: ` ${EAN13}\n`, format: 'ean_13' })).toEqual({
      code: EAN13,
      format: 'ean_13',
    });
  });

  it('drops checksum-invalid EAN/UPC', () => {
    expect(validateDetection({ rawValue: '4006381333932', format: 'ean_13' })).toBeNull();
  });

  it('accepts printable Code128 and rejects empty / control chars / too long', () => {
    expect(validateDetection({ rawValue: 'A-1234', format: 'code_128' })).toEqual({
      code: 'A-1234',
      format: 'code_128',
    });
    expect(validateDetection({ rawValue: '  ', format: 'code_128' })).toBeNull();
    expect(validateDetection({ rawValue: 'AB\u0001C', format: 'code_128' })).toBeNull();
    expect(validateDetection({ rawValue: 'x'.repeat(49), format: 'code_128' })).toBeNull();
  });

  it('returns null for no detections', () => {
    expect(pickBarcode([])).toBeNull();
  });

  it('prefers the first valid retail code over an earlier Code128', () => {
    const ds: RawDetection[] = [
      { rawValue: 'STORE-778', format: 'code_128' },
      { rawValue: '4006381333932', format: 'ean_13' }, // bad checksum
      { rawValue: EAN8, format: 'ean_8' },
      { rawValue: EAN13, format: 'ean_13' },
    ];
    expect(pickBarcode(ds)).toEqual({ code: EAN8, format: 'ean_8' });
  });

  it('falls back to Code128 when there is no valid retail code', () => {
    expect(
      pickBarcode([
        { rawValue: '4006381333932', format: 'ean_13' },
        { rawValue: 'STORE-778', format: 'code_128' },
      ]),
    ).toEqual({ code: 'STORE-778', format: 'code_128' });
  });
});

describe('detectBarcode', () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
  const fake = (impl: BarcodeDetectorLike['detect']): BarcodeDetectorLike => ({ detect: impl });

  it('returns the picked code', async () => {
    const detector = fake(async () => [{ rawValue: EAN13, format: 'ean_13' }]);
    await expect(detectBarcode(blob, { detector })).resolves.toEqual({
      code: EAN13,
      format: 'ean_13',
    });
  });

  it('returns null when nothing valid is found', async () => {
    const detector = fake(async () => [{ rawValue: '123', format: 'ean_13' }]);
    await expect(detectBarcode(blob, { detector })).resolves.toBeNull();
  });

  it('never rejects when the detector throws', async () => {
    const detector = fake(async () => {
      throw new Error('wasm failed');
    });
    await expect(detectBarcode(blob, { detector })).resolves.toBeNull();
  });

  it('never rejects when the detector throws synchronously', async () => {
    const detector = fake(() => {
      throw new Error('boom');
    });
    await expect(detectBarcode(blob, { detector })).resolves.toBeNull();
  });

  it('returns null for a non-array result', async () => {
    const detector = fake(async () => undefined as unknown as RawDetection[]);
    await expect(detectBarcode(blob, { detector })).resolves.toBeNull();
  });

  it('resolves null after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const detector = fake(() => new Promise<RawDetection[]>(() => undefined));
      const p = detectBarcode(blob, { detector, timeoutMs: 50 });
      await vi.advanceTimersByTimeAsync(50);
      await expect(p).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
