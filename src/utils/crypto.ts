// ============================================================================
// Cryptographic Utility Module — SHA-256 Hashing & Verification
// Compatible with both Browser (Web Crypto API) and Node.js
// ============================================================================

/**
 * Converts an ArrayBuffer to a lowercase hexadecimal string.
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hexString = '';
  for (let i = 0; i < byteArray.length; i++) {
    hexString += byteArray[i].toString(16).padStart(2, '0');
  }
  return hexString;
}

/**
 * Computes the real SHA-256 digest of text or binary data.
 * Returns a 64-character lowercase hex string.
 */
export async function computeSha256(
  input: string | ArrayBuffer | Uint8Array
): Promise<string> {
  let dataBuffer: Uint8Array;

  if (typeof input === 'string') {
    dataBuffer = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    dataBuffer = input;
  } else {
    dataBuffer = new Uint8Array(input);
  }

  // Use Web Crypto API if available (in browsers and modern Node.js)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const bufferSource =
      dataBuffer.byteOffset === 0 && dataBuffer.byteLength === dataBuffer.buffer.byteLength
        ? dataBuffer.buffer
        : dataBuffer.buffer.slice(
            dataBuffer.byteOffset,
            dataBuffer.byteOffset + dataBuffer.byteLength
          );
    const hashBuffer = await globalThis.crypto.subtle.digest(
      'SHA-256',
      bufferSource as ArrayBuffer
    );
    return bufferToHex(hashBuffer);
  }

  // Fallback for Node.js environments without subtle crypto initialized
  try {
    // Dynamic import to prevent bundler errors in browser contexts
    const nodeCrypto = await import('node:crypto');
    return nodeCrypto.createHash('sha256').update(dataBuffer).digest('hex');
  } catch {
    throw new Error('No cryptographic provider available to compute SHA-256.');
  }
}

/**
 * Compares an observed hash with an expected baseline hash in constant-time semantics.
 */
export function verifyHashMatch(observed: string, expected: string): boolean {
  if (!observed || !expected) return false;
  const a = observed.trim().toLowerCase();
  const b = expected.trim().toLowerCase();
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Computes a hash for an audit block to maintain a tamper-evident blockchain-like chain.
 */
export async function computeAuditBlockHash(
  previousHash: string | null,
  timestamp: string,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const canonicalString = JSON.stringify({
    prev: previousHash || '0'.repeat(64),
    ts: timestamp,
    actor: actorId || 'SYSTEM',
    act: action,
    type: entityType,
    id: entityId,
    data: payload,
  });

  return computeSha256(canonicalString);
}

/**
 * Human-readable byte size formatter.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}

// ----------------------------------------------------------------------------
// Incremental / Streaming SHA-256 Engine (NIST FIPS 180-4 Compliant)
// Enables memory-bounded hashing of multi-gigabyte forensic artifacts
// ----------------------------------------------------------------------------
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export class IncrementalSha256 {
  private h = new Int32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private buffer = new Uint8Array(64);
  private bufferLength = 0;
  private bytesHashed = 0;
  private w = new Int32Array(64);

  private processBlock(block: Uint8Array): void {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      w[i] =
        (block[i * 4] << 24) |
        (block[i * 4 + 1] << 16) |
        (block[i * 4 + 2] << 8) |
        block[i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const g1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      const g0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      w[i] = (g1 + w[i - 7] + g0 + w[i - 16]) | 0;
    }

    let a = this.h[0];
    let b = this.h[1];
    let c = this.h[2];
    let d = this.h[3];
    let e = this.h[4];
    let f = this.h[5];
    let g = this.h[6];
    let h = this.h[7];

    for (let i = 0; i < 64; i++) {
      const s1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + SHA256_K[i] + w[i]) | 0;

      const s0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }

    this.h[0] = (this.h[0] + a) | 0;
    this.h[1] = (this.h[1] + b) | 0;
    this.h[2] = (this.h[2] + c) | 0;
    this.h[3] = (this.h[3] + d) | 0;
    this.h[4] = (this.h[4] + e) | 0;
    this.h[5] = (this.h[5] + f) | 0;
    this.h[6] = (this.h[6] + g) | 0;
    this.h[7] = (this.h[7] + h) | 0;
  }

  public update(chunk: Uint8Array | string): this {
    const data = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
    let offset = 0;
    this.bytesHashed += data.length;

    if (this.bufferLength > 0) {
      const needed = 64 - this.bufferLength;
      if (data.length >= needed) {
        this.buffer.set(data.subarray(0, needed), this.bufferLength);
        this.processBlock(this.buffer);
        offset = needed;
        this.bufferLength = 0;
      } else {
        this.buffer.set(data, this.bufferLength);
        this.bufferLength += data.length;
        return this;
      }
    }

    while (offset + 64 <= data.length) {
      this.processBlock(data.subarray(offset, offset + 64));
      offset += 64;
    }

    if (offset < data.length) {
      this.buffer.set(data.subarray(offset), 0);
      this.bufferLength = data.length - offset;
    }

    return this;
  }

  public digest(): string {
    const totalBits = BigInt(this.bytesHashed) * 8n;
    this.buffer[this.bufferLength++] = 0x80;

    if (this.bufferLength > 56) {
      this.buffer.fill(0, this.bufferLength, 64);
      this.processBlock(this.buffer);
      this.buffer.fill(0, 0, 64);
    } else {
      this.buffer.fill(0, this.bufferLength, 56);
    }

    const highBits = Number(totalBits >> 32n);
    const lowBits = Number(totalBits & 0xffffffffn);

    this.buffer[56] = (highBits >>> 24) & 0xff;
    this.buffer[57] = (highBits >>> 16) & 0xff;
    this.buffer[58] = (highBits >>> 8) & 0xff;
    this.buffer[59] = highBits & 0xff;
    this.buffer[60] = (lowBits >>> 24) & 0xff;
    this.buffer[61] = (lowBits >>> 16) & 0xff;
    this.buffer[62] = (lowBits >>> 8) & 0xff;
    this.buffer[63] = lowBits & 0xff;

    this.processBlock(this.buffer);

    let hex = '';
    for (let i = 0; i < 8; i++) {
      hex += (this.h[i] >>> 0).toString(16).padStart(8, '0');
    }
    return hex;
  }

  public getBytesProcessed(): number {
    return this.bytesHashed;
  }
}

/**
 * Computes SHA-256 over an iterable or async-iterable stream of byte chunks without holding all data in RAM.
 */
export async function computeStreamingSha256(
  chunks: Iterable<Uint8Array> | AsyncIterable<Uint8Array>
): Promise<string> {
  const hasher = new IncrementalSha256();
  for await (const chunk of chunks) {
    hasher.update(chunk);
  }
  return hasher.digest();
}

/**
 * Computes SHA-256 directly from a browser File or Blob using streaming slices.
 * Memory footprint stays bounded to `chunkSize` (default 2 MB) rather than file size.
 */
export async function computeFileSha256(
  file: Blob,
  chunkSize = 2 * 1024 * 1024,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
): Promise<string> {
  const total = file.size;
  if (total <= chunkSize) {
    const buffer = await file.arrayBuffer();
    return computeSha256(buffer);
  }

  const hasher = new IncrementalSha256();
  let offset = 0;

  while (offset < total) {
    const slice = file.slice(offset, Math.min(offset + chunkSize, total));
    const arrayBuffer = await slice.arrayBuffer();
    hasher.update(new Uint8Array(arrayBuffer));
    offset += arrayBuffer.byteLength;
    if (onProgress) {
      onProgress(offset, total);
    }
  }

  return hasher.digest();
}
