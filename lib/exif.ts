/**
 * EXIF and metadata stripping, in pure JS.
 *
 * A photo of a worksheet taken on a phone routinely carries GPS coordinates,
 * a device serial and a capture timestamp. That is a family's home address
 * riding along with a homework question, so it is removed before the image
 * is sent anywhere, including to the model.
 *
 * Done by hand rather than with an image library because the operation is
 * segment surgery, not re-encoding: the pixels are untouched, so there is no
 * quality loss and no native dependency in the serverless bundle.
 */

/** JPEG markers that carry metadata rather than image data. */
const JPEG_METADATA_MARKERS = new Set([
  0xe1, // APP1, EXIF and XMP
  0xe2, // APP2, ICC and FlashPix
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec,
  0xed, // APP13, Photoshop IRB, including IPTC
  0xee, 0xef,
  0xfe, // COM, comment
]);

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8]; // SOI
  let i = 2;

  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) {
      // Desynchronised. Copy the rest verbatim rather than corrupt the file.
      for (let j = i; j < bytes.length; j += 1) out.push(bytes[j] as number);
      break;
    }

    const marker = bytes[i + 1] as number;

    // Start of scan: everything after this is entropy-coded image data.
    if (marker === 0xda) {
      for (let j = i; j < bytes.length; j += 1) out.push(bytes[j] as number);
      break;
    }

    // Standalone markers carry no length.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }

    const length = ((bytes[i + 2] as number) << 8) | (bytes[i + 3] as number);
    if (!Number.isFinite(length) || length < 2) break;

    if (!JPEG_METADATA_MARKERS.has(marker)) {
      for (let j = i; j < i + 2 + length && j < bytes.length; j += 1) out.push(bytes[j] as number);
    }

    i += 2 + length;
  }

  return new Uint8Array(out);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** PNG ancillary chunks that carry text or metadata. */
const PNG_METADATA_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME", "iCCP"]);

function stripPng(bytes: Uint8Array): Uint8Array {
  const out: number[] = [...PNG_SIGNATURE];
  let i = 8;

  while (i + 8 <= bytes.length) {
    const length =
      ((bytes[i] as number) << 24) |
      ((bytes[i + 1] as number) << 16) |
      ((bytes[i + 2] as number) << 8) |
      (bytes[i + 3] as number);

    const type = String.fromCharCode(
      bytes[i + 4] as number,
      bytes[i + 5] as number,
      bytes[i + 6] as number,
      bytes[i + 7] as number,
    );

    const total = 12 + length;
    if (length < 0 || i + total > bytes.length) break;

    if (!PNG_METADATA_CHUNKS.has(type)) {
      for (let j = i; j < i + total; j += 1) out.push(bytes[j] as number);
    }

    i += total;
    if (type === "IEND") break;
  }

  return new Uint8Array(out);
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, index) => bytes[index] === b);
}

/**
 * Removes metadata from a JPEG or PNG. Other formats are passed through
 * unchanged, since we cannot safely edit what we cannot parse.
 */
export function stripMetadata(bytes: Uint8Array): Uint8Array {
  try {
    if (isJpeg(bytes)) return stripJpeg(bytes);
    if (isPng(bytes)) return stripPng(bytes);
  } catch {
    // A malformed image is the model's problem to report, not ours to crash on.
  }
  return bytes;
}

/** Strips metadata and returns a data URL for the vision model. */
export function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  const stripped = stripMetadata(bytes);
  const base64 = Buffer.from(stripped).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
