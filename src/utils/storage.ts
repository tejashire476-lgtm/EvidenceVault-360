// ============================================================================
// EVIDENCEVAULT 360 — SECURE EVIDENCE OBJECT STORAGE ENGINE
// Cloudflare R2 / S3-Compatible & Private Object Storage Ingestion Engine
// "Zero Egress Bandwidth Fees • End-to-End Cryptographic Chain"
// ============================================================================

import type {
  EvidenceType,
  UserRole,
  StorageMetricsReport,
  SignedUrlResult,
  FileValidationResult,
  MultipartUploadSession,
  MultipartUploadPart,
  UploadProgressEvent,
  ProviderIntegrityCheck,
} from '../types.ts';
import { computeSha256, verifyHashMatch, formatFileSize } from './crypto.ts';

// ----------------------------------------------------------------------------
// Forensic File Extension Whitelist & Disallowed Execution Patterns
// ----------------------------------------------------------------------------
export const ALLOWED_FORENSIC_EXTENSIONS = new Set([
  '.raw',
  '.dd',
  '.img',
  '.e01',
  '.pcap',
  '.pcapng',
  '.dmp',
  '.mem',
  '.log',
  '.vmdk',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.csv',
  '.json',
  '.txt',
  '.iso',
  '.bin',
]);

export const DISALLOWED_EXECUTABLE_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.msi',
  '.dll',
  '.vbs',
  '.scr',
  '.jar',
  '.com',
  '.pif',
]);

// ----------------------------------------------------------------------------
// Configured Storage Limits by Forensic Evidence Category
// ----------------------------------------------------------------------------
export const CATEGORY_STORAGE_LIMITS: Record<EvidenceType, number> = {
  DISK_IMAGE: 107374182400, // 100 GB
  MEMORY_DUMP: 68719476736, // 64 GB
  DATABASE_DUMP: 21474836480, // 20 GB
  MOBILE_EXTRACTION: 34359738368, // 32 GB
  NETWORK_CAPTURE: 10737418240, // 10 GB
  MEDIA: 5368709120, // 5 GB
  SYSTEM_LOG: 2147483648, // 2 GB
  DOCUMENT: 524288000, // 500 MB
};

export const CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB part size

// ----------------------------------------------------------------------------
// Canonical Storage Key Sanitization & Path Traversal Prevention
// ----------------------------------------------------------------------------
export function sanitizePathSegment(segment: string): string {
  // Strip null bytes, path traversal sequences (../ or ..\), and illegal characters
  return segment
    .replace(/\0/g, '')
    .replace(/\.\./g, '')
    .replace(/[\\/]/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

export function generateCanonicalStorageKey(
  caseId: string,
  evidenceId: string,
  versionId: string,
  rawFilename: string
): string {
  const safeCase = sanitizePathSegment(caseId);
  const safeEvidence = sanitizePathSegment(evidenceId);
  const safeVersion = sanitizePathSegment(versionId);
  const safeFilename = sanitizePathSegment(rawFilename);

  return `cases/${safeCase}/evidence/${safeEvidence}/${safeVersion}/${safeFilename}`;
}

// ----------------------------------------------------------------------------
// File Type & Size Limit Validation
// ----------------------------------------------------------------------------
export function validateEvidenceFile(
  filename: string,
  sizeBytes: number,
  evidenceType: EvidenceType
): FileValidationResult {
  const cleanName = filename.trim();
  const lowerName = cleanName.toLowerCase();
  const dotIndex = lowerName.lastIndexOf('.');
  const ext = dotIndex !== -1 ? lowerName.slice(dotIndex) : '';

  // Check disallowed executable extensions
  if (DISALLOWED_EXECUTABLE_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      sanitizedFilename: sanitizePathSegment(cleanName),
      sanitizedStorageKey: '',
      errorMessage: `Security violation: File type '${ext}' is an executable/script format and cannot be uploaded.`,
      detectedMimeType: 'application/x-executable',
      categoryLimitBytes: CATEGORY_STORAGE_LIMITS[evidenceType],
    };
  }

  // Check permitted extensions
  if (!ALLOWED_FORENSIC_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      sanitizedFilename: sanitizePathSegment(cleanName),
      sanitizedStorageKey: '',
      errorMessage: `Invalid file format '${ext}'. Permitted extensions: ${Array.from(ALLOWED_FORENSIC_EXTENSIONS).join(', ')}.`,
      detectedMimeType: 'application/octet-stream',
      categoryLimitBytes: CATEGORY_STORAGE_LIMITS[evidenceType],
    };
  }

  // Check category size limit
  const limitBytes = CATEGORY_STORAGE_LIMITS[evidenceType] || CATEGORY_STORAGE_LIMITS.DISK_IMAGE;
  if (sizeBytes > limitBytes) {
    return {
      isValid: false,
      sanitizedFilename: sanitizePathSegment(cleanName),
      sanitizedStorageKey: '',
      errorMessage: `File size (${formatFileSize(sizeBytes)}) exceeds configured maximum limit of ${formatFileSize(limitBytes)} for category '${evidenceType}'.`,
      detectedMimeType: 'application/octet-stream',
      categoryLimitBytes: limitBytes,
    };
  }

  const safeFilename = sanitizePathSegment(cleanName);
  const canonicalKey = `cases/pending/evidence/pending/v1/${safeFilename}`;

  return {
    isValid: true,
    sanitizedFilename: safeFilename,
    sanitizedStorageKey: canonicalKey,
    detectedMimeType: ext === '.pdf' ? 'application/pdf' : 'application/octet-stream',
    categoryLimitBytes: limitBytes,
  };
}

// ----------------------------------------------------------------------------
// Ephemeral Signed URLs & Authorization Verification
// ----------------------------------------------------------------------------
const SIGNED_URL_SECRET = 'ev360-ephemeral-sig-token-key-2026';

export async function generateSignedUrl(
  storageKey: string,
  actorRole: UserRole,
  method: 'GET' | 'PUT' = 'GET',
  ttlSeconds = 300 // 5 minutes default
): Promise<SignedUrlResult> {
  // Enforce role authorization for storage downloads
  if (method === 'GET') {
    const allowedRoles: UserRole[] = [
      'PUBLIC_PROSECUTOR',
      'FORENSIC_EXAMINER',
      'SYSTEM_ADMIN',
    ];
    if (!allowedRoles.includes(actorRole)) {
      throw new Error(`Access Denied: Role '${actorRole}' is not authorized to download raw evidence objects.`);
    }
  }

  const expiresTimestamp = Date.now() + ttlSeconds * 1000;
  const signaturePayload = `${storageKey}:${actorRole}:${method}:${expiresTimestamp}:${SIGNED_URL_SECRET}`;
  const signature = await computeSha256(signaturePayload);

  const mockEndpoint = 'https://r2.evidencevault360.internal';
  const signedUrl = `${mockEndpoint}/${storageKey}?exp=${expiresTimestamp}&role=${actorRole}&sig=${signature.slice(0, 32)}`;

  return {
    url: signedUrl,
    storageKey,
    expiresAt: new Date(expiresTimestamp).toISOString(),
    authorizedRole: actorRole,
    method,
  };
}

export async function verifySignedUrl(
  signedUrl: string,
  actorRole: UserRole
): Promise<{ isValid: boolean; reason?: string }> {
  try {
    const parsed = new URL(signedUrl);
    const expParam = parsed.searchParams.get('exp');
    const roleParam = parsed.searchParams.get('role');
    const sigParam = parsed.searchParams.get('sig');
    const storageKey = parsed.pathname.replace(/^\//, '');

    if (!expParam || !sigParam || !roleParam) {
      return { isValid: false, reason: 'Malformed signed URL: missing security parameters.' };
    }

    const expiresAt = parseInt(expParam, 10);
    if (Date.now() > expiresAt) {
      return { isValid: false, reason: 'Signed URL has expired. Request a new authorized download token.' };
    }

    if (roleParam !== actorRole) {
      return { isValid: false, reason: 'Role mismatch: Token was not issued to current authenticated session.' };
    }

    const expectedPayload = `${storageKey}:${roleParam}:GET:${expiresAt}:${SIGNED_URL_SECRET}`;
    const expectedSig = (await computeSha256(expectedPayload)).slice(0, 32);

    if (sigParam !== expectedSig) {
      return { isValid: false, reason: 'Cryptographic signature verification failed.' };
    }

    return { isValid: true };
  } catch (err) {
    return { isValid: false, reason: `URL parsing error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ----------------------------------------------------------------------------
// Private Object Storage Engine (Cloudflare R2 Compatible & Virtual Blob Store)
// ----------------------------------------------------------------------------
export class SecureEvidenceStorageEngine {
  private objectStore: Map<string, { data: Uint8Array; contentType: string }> = new Map();
  private uploadSessions: Map<string, MultipartUploadSession> = new Map();
  private classAOperations = 0;
  private classBOperations = 0;
  private totalStoredBytes = 0;
  private quotaLimitBytes = 500 * 1024 * 1024 * 1024; // 500 GB default quota
  private bucketName = 'evidencevault-360-artifacts-r2';

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.objectStore.clear();
    this.uploadSessions.clear();
    this.classAOperations = 0;
    this.classBOperations = 0;
    this.totalStoredBytes = 0;
  }

  // --------------------------------------------------------------------------
  // Multipart Resumable Ingestion Lifecycle
  // --------------------------------------------------------------------------
  public initiateMultipartUpload(params: {
    caseId: string;
    evidenceId: string;
    versionId: string;
    originalFilename: string;
    contentType: string;
    totalSizeBytes: number;
    evidenceType: EvidenceType;
    uploadedBy: string;
    expectedSha256?: string;
  }): MultipartUploadSession {
    // Validate file type and size
    const validation = validateEvidenceFile(
      params.originalFilename,
      params.totalSizeBytes,
      params.evidenceType
    );
    if (!validation.isValid) {
      throw new Error(validation.errorMessage);
    }

    // Check quota
    if (this.totalStoredBytes + params.totalSizeBytes > this.quotaLimitBytes) {
      throw new Error(
        `Storage quota exceeded: Upload requires ${formatFileSize(params.totalSizeBytes)}, but available bucket capacity is ${formatFileSize(this.quotaLimitBytes - this.totalStoredBytes)}.`
      );
    }

    const storageKey = generateCanonicalStorageKey(
      params.caseId,
      params.evidenceId,
      params.versionId,
      params.originalFilename
    );

    const uploadId = `MPU-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const session: MultipartUploadSession = {
      uploadId,
      caseId: params.caseId,
      evidenceId: params.evidenceId,
      versionId: params.versionId,
      storageKey,
      originalFilename: params.originalFilename,
      contentType: params.contentType,
      totalSizeBytes: params.totalSizeBytes,
      expectedSha256: params.expectedSha256,
      parts: [],
      status: 'INITIALIZED',
      initiatedAt: new Date().toISOString(),
      uploadedBy: params.uploadedBy,
    };

    this.uploadSessions.set(uploadId, session);
    this.classAOperations++; // CreateMultipartUpload is Class A
    return session;
  }

  public async uploadPart(
    uploadId: string,
    partNumber: number,
    chunkData: Uint8Array,
    onProgress?: (progress: UploadProgressEvent) => void
  ): Promise<MultipartUploadPart> {
    const session = this.uploadSessions.get(uploadId);
    if (!session) {
      throw new Error(`Upload session '${uploadId}' not found.`);
    }
    if (session.status === 'ABORTED') {
      throw new Error(`Upload session '${uploadId}' was cancelled.`);
    }

    session.status = 'IN_PROGRESS';
    const etag = await computeSha256(chunkData);

    const part: MultipartUploadPart = {
      partNumber,
      etag,
      sizeBytes: chunkData.length,
      uploadedAt: new Date().toISOString(),
    };

    // Remove existing part if retrying
    session.parts = session.parts.filter((p) => p.partNumber !== partNumber);
    session.parts.push(part);
    session.parts.sort((a, b) => a.partNumber - b.partNumber);

    this.classAOperations++; // UploadPart is Class A

    if (onProgress) {
      const loadedBytes = session.parts.reduce((sum, p) => sum + p.sizeBytes, 0);
      const totalBytes = session.totalSizeBytes;
      const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
      const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE_BYTES) || 1;

      onProgress({
        uploadId,
        loadedBytes,
        totalBytes,
        percent,
        speedBytesPerSec: 15 * 1024 * 1024, // Simulated 15 MB/s transfer speed
        activeChunkIndex: partNumber,
        totalChunks,
      });
    }

    return part;
  }

  public abortMultipartUpload(uploadId: string): void {
    const session = this.uploadSessions.get(uploadId);
    if (!session) {
      throw new Error(`Upload session '${uploadId}' not found.`);
    }

    session.status = 'ABORTED';
    session.parts = []; // Purge partial chunks to prevent dangling storage charges
    this.classAOperations++; // AbortMultipartUpload is Class A
  }

  public async completeMultipartUpload(
    uploadId: string,
    combinedBuffer: Uint8Array
  ): Promise<{ storageKey: string; sha256: string; totalBytes: number }> {
    const session = this.uploadSessions.get(uploadId);
    if (!session) {
      throw new Error(`Upload session '${uploadId}' not found.`);
    }
    if (session.status === 'ABORTED') {
      throw new Error(`Cannot complete aborted upload session '${uploadId}'.`);
    }

    // Verify computed SHA-256
    const observedSha256 = await computeSha256(combinedBuffer);
    if (session.expectedSha256 && !verifyHashMatch(observedSha256, session.expectedSha256)) {
      this.abortMultipartUpload(uploadId);
      throw new Error(
        `Integrity Verification Failure: Observed checksum '${observedSha256}' does not match expected manifest '${session.expectedSha256}'. Object discarded.`
      );
    }

    // Store binary object in private object store (outside database rows)
    this.objectStore.set(session.storageKey, {
      data: new Uint8Array(combinedBuffer),
      contentType: session.contentType,
    });

    session.status = 'COMPLETED';
    session.completedAt = new Date().toISOString();
    this.totalStoredBytes += combinedBuffer.length;
    this.classAOperations++; // CompleteMultipartUpload is Class A

    return {
      storageKey: session.storageKey,
      sha256: observedSha256,
      totalBytes: combinedBuffer.length,
    };
  }

  // --------------------------------------------------------------------------
  // Object Retrieval via Ephemeral Signed URL
  // --------------------------------------------------------------------------
  public async getObjectBySignedUrl(
    signedUrl: string,
    actorRole: UserRole
  ): Promise<{ data: Uint8Array; contentType: string }> {
    const verification = await verifySignedUrl(signedUrl, actorRole);
    if (!verification.isValid) {
      throw new Error(`Access Denied: ${verification.reason}`);
    }

    const parsed = new URL(signedUrl);
    const storageKey = parsed.pathname.replace(/^\//, '');

    const record = this.objectStore.get(storageKey);
    if (!record) {
      throw new Error(`Object not found at key '${storageKey}'.`);
    }

    this.classBOperations++; // GetObject is Class B
    return record;
  }

  public hasObject(storageKey: string): boolean {
    return this.objectStore.has(storageKey);
  }

  public getStoredObject(storageKey: string): { data: Uint8Array; contentType: string } | undefined {
    return this.objectStore.get(storageKey);
  }

  /**
   * Memory-safe chunked stream retrieval for large forensic evidence files.
   * Yields slices without duplicating the entire buffer in client RAM.
   */
  public async *getObjectStream(
    storageKey: string,
    chunkSize = 1024 * 1024
  ): AsyncIterable<Uint8Array> {
    const record = this.objectStore.get(storageKey);
    if (!record) {
      throw new Error(`Object not found in storage at key '${storageKey}'.`);
    }

    this.classBOperations++;
    const data = record.data;
    let offset = 0;
    while (offset < data.length) {
      const end = Math.min(offset + chunkSize, data.length);
      yield data.subarray(offset, end);
      offset = end;
    }
  }

  /**
   * Intentionally corrupts / flips bits on a stored object to verify that
   * cryptographic verification detects unauthorized alteration (MISMATCH).
   */
  public tamperObject(
    storageKey: string,
    byteIndex = 0
  ): { originalByte: number; tamperedByte: number; storageKey: string } {
    const record = this.objectStore.get(storageKey);
    if (!record) {
      throw new Error(`Cannot tamper: Object not found at key '${storageKey}'.`);
    }
    const data = record.data;
    if (data.length === 0) {
      throw new Error('Cannot tamper empty object.');
    }
    const index = Math.min(byteIndex, data.length - 1);
    const originalByte = data[index];
    const tamperedByte = originalByte ^ 0xff; // Invert byte bits
    data[index] = tamperedByte;
    return { originalByte, tamperedByte, storageKey };
  }

  /**
   * Restores pristine data back to a stored object after tamper demonstration.
   */
  public restoreObject(storageKey: string, pristineData: Uint8Array): void {
    const record = this.objectStore.get(storageKey);
    if (!record) {
      throw new Error(`Object not found at key '${storageKey}'.`);
    }
    record.data = new Uint8Array(pristineData);
  }

  /**
   * Returns provider-side transport integrity metadata documented separately
   * from the application's court-admissible SHA-256 hash.
   */
  public getProviderIntegrityMetadata(storageKey: string): ProviderIntegrityCheck {
    const record = this.objectStore.get(storageKey);
    return {
      provider: 'CLOUDFLARE_R2',
      etag: record ? `"${Date.now().toString(16)}-r2-part"` : undefined,
      encryptionAtRest: 'AES-256 (Cloudflare R2 SSE-S3)',
      transportProtocol: 'TLS 1.3 HTTPS',
      transportVerified: Boolean(record),
    };
  }

  public seedObject(
    storageKey: string,
    data: Uint8Array,
    contentType = 'application/octet-stream'
  ): void {
    this.objectStore.set(storageKey, { data: new Uint8Array(data), contentType });
    this.totalStoredBytes += data.length;
  }

  // --------------------------------------------------------------------------
  // Metrics, Quota & Cloudflare R2 Cost Calculator
  // --------------------------------------------------------------------------
  public getStorageMetrics(): StorageMetricsReport {
    const totalStoredGB = this.totalStoredBytes / (1024 * 1024 * 1024);
    const freeTierGB = 10; // Cloudflare R2 includes 10 GB free tier

    // R2 Pricing: $0.015 / GB-month beyond free 10 GB. Egress is $0.00.
    const billableGB = Math.max(0, totalStoredGB - freeTierGB);
    const storageCostUSD = billableGB * 0.015;

    // Class A operations: $4.50 / million beyond 1M free
    const billableClassA = Math.max(0, this.classAOperations - 1000000);
    const classACostUSD = (billableClassA / 1000000) * 4.5;

    const totalCostUSD = storageCostUSD + classACostUSD;
    const quotaUsedPercent = Math.min(
      100,
      parseFloat(((this.totalStoredBytes / this.quotaLimitBytes) * 100).toFixed(1))
    );

    return {
      provider: 'CLOUDFLARE_R2',
      bucketName: this.bucketName,
      totalStoredBytes: this.totalStoredBytes,
      totalStoredFormatted: formatFileSize(this.totalStoredBytes),
      totalObjectsCount: this.objectStore.size,
      classAOperations: this.classAOperations,
      classBOperations: this.classBOperations,
      freeTierStorageLimitBytes: freeTierGB * 1024 * 1024 * 1024,
      estimatedMonthlyCostUSD: parseFloat(totalCostUSD.toFixed(4)),
      egressCostUSD: 0.0, // Guarantees zero egress bandwidth charge
      quotaLimitBytes: this.quotaLimitBytes,
      quotaUsedPercent,
      encryptionStandard: 'AES-256 (Cloudflare R2 SSE-S3)',
      retentionPolicy: '7-Year Criminal Justice WORM Immutability Policy',
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const globalStorageEngine = new SecureEvidenceStorageEngine();
