// ============================================================================
// EVIDENCEVAULT 360 — EVIDENCE INTEGRITY VERIFICATION ENGINE
// Real End-to-End SHA-256 Streaming Verification & Tamper Detection
// "Never trust claims. Verify actual storage bytes against baseline."
// ============================================================================

import type {
  UserRole,
  IntegrityVerificationResult,
  VerificationResultStatus,
  ProviderIntegrityCheck,
} from '../types.ts';
import { computeStreamingSha256, verifyHashMatch, computeSha256 } from './crypto.ts';
import { globalStorageEngine, SecureEvidenceStorageEngine } from './storage.ts';
import { globalDb, EvidenceVaultDatabase } from '../data/db.ts';

// ----------------------------------------------------------------------------
// Role-Based Authorization for Forensic Integrity Audits
// ----------------------------------------------------------------------------
export const AUTHORIZED_VERIFIER_ROLES = new Set<UserRole>([
  'FORENSIC_EXAMINER',
  'PUBLIC_PROSECUTOR',
  'SYSTEM_ADMIN',
]);

export interface VerificationOptions {
  fileVersionId: string;
  actorId: string;
  actorRole: UserRole;
  storageEngine?: SecureEvidenceStorageEngine;
  database?: EvidenceVaultDatabase;
  useStreaming?: boolean;
}

/**
 * Performs actual end-to-end cryptographic SHA-256 verification of an evidence file.
 *
 * Requirements Guarantee:
 * 1. Calculates SHA-256 from actual bytes streamed from private object storage.
 * 2. Compares against registered baseline manifest hash.
 * 3. Returns MATCH, MISMATCH, or ERROR with expected, observed, timestamp, and actor.
 * 4. Never returns MATCH if verification was skipped, failed, or errored.
 * 5. Strictly distinguishes storage/network errors from confirmed cryptographic mismatches.
 * 6. Records EVERY attempt into the immutable audit ledger, preserving history.
 * 7. Documents provider-side integrity checks separately from application SHA-256.
 */
let verificationCounter = 0;

export async function verifyEvidenceFileVersionIntegrity(
  options: VerificationOptions
): Promise<IntegrityVerificationResult> {
  const {
    fileVersionId,
    actorId,
    actorRole,
    storageEngine = globalStorageEngine,
    database = globalDb,
    useStreaming = true,
  } = options;

  // 1. Enforce RBAC Authorization
  if (!AUTHORIZED_VERIFIER_ROLES.has(actorRole)) {
    throw new Error(
      `Access Denied: Role '${actorRole}' is not authorized to execute forensic cryptographic verification.`
    );
  }

  // 2. Fetch File Version Record from Database
  const fileVersion = database.getFileVersion(fileVersionId);
  if (!fileVersion) {
    throw new Error(`File version record '${fileVersionId}' was not found in the evidence database.`);
  }

  const expectedSha256 = fileVersion.sha256_hash.trim().toLowerCase();
  const storageKey = fileVersion.generated_storage_key;
  const startTime = Date.now();
  const verificationId = `VERIF-${Date.now()}-${String(++verificationCounter).padStart(6, '0')}`;

  // 3. Storage Object Retrieval & Error Distinction
  // Distinguish an object storage retrieval failure from an integrity mismatch
  if (!storageEngine.hasObject(storageKey)) {
    const errorResult: IntegrityVerificationResult = {
      id: verificationId,
      evidence_id: fileVersion.evidence_id,
      file_version_id: fileVersion.id,
      expected_sha256: expectedSha256,
      observed_sha256: '', // Empty observed hash on storage failure
      result: 'ERROR',
      verified_by: actorId,
      verified_by_role: actorRole,
      verified_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      byte_size: 0,
      verification_mode: useStreaming ? 'STREAMING_CHUNKS' : 'BUFFER',
      storage_key: storageKey,
      error_reason: `Storage Object Missing: No binary object found in private storage at key '${storageKey}'. File cannot be verified.`,
      provider_integrity: {
        provider: 'CLOUDFLARE_R2',
        encryptionAtRest: 'AES-256 (Cloudflare R2 SSE-S3)',
        transportProtocol: 'TLS 1.3 HTTPS',
        transportVerified: false,
      },
    };

    // Record the failure attempt in the audit log
    await database.recordVerificationResult(errorResult);
    return errorResult;
  }

  // 4. Stream & Calculate SHA-256 from Actual Bytes
  let observedSha256 = '';
  let byteSize = 0;
  let status: VerificationResultStatus = 'ERROR';
  let errorReason: string | null = null;

  try {
    if (useStreaming) {
      // Memory-bounded chunked streaming verification
      const stream = storageEngine.getObjectStream(storageKey, 1024 * 1024);
      observedSha256 = await computeStreamingSha256(stream);
      const stored = storageEngine.getStoredObject(storageKey);
      byteSize = stored ? stored.data.length : fileVersion.file_size;
    } else {
      const stored = storageEngine.getStoredObject(storageKey);
      if (!stored) {
        throw new Error('Failed to access buffer.');
      }
      byteSize = stored.data.length;
      observedSha256 = await computeSha256(stored.data);
    }

    observedSha256 = observedSha256.trim().toLowerCase();

    // 5. Compare Observed against Expected Baseline
    const isMatch = verifyHashMatch(observedSha256, expectedSha256);

    if (isMatch) {
      status = 'MATCH';
      errorReason = null;
    } else {
      // Tampering or bit-flip detected!
      status = 'MISMATCH';
      errorReason = `Cryptographic Mismatch: Observed storage hash does not match original baseline manifest. Potential tampering detected.`;
    }
  } catch (err) {
    status = 'ERROR';
    observedSha256 = '';
    errorReason = `Verification Execution Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const durationMs = Date.now() - startTime;
  const providerIntegrity: ProviderIntegrityCheck = storageEngine.getProviderIntegrityMetadata(storageKey);

  // 6. Assemble Immutable Verification Record
  const verificationRecord: IntegrityVerificationResult = {
    id: verificationId,
    evidence_id: fileVersion.evidence_id,
    file_version_id: fileVersion.id,
    expected_sha256: expectedSha256,
    observed_sha256: observedSha256,
    result: status,
    verified_by: actorId,
    verified_by_role: actorRole,
    verified_at: new Date().toISOString(),
    duration_ms: durationMs,
    byte_size: byteSize,
    verification_mode: useStreaming ? 'STREAMING_CHUNKS' : 'BUFFER',
    storage_key: storageKey,
    error_reason: errorReason,
    provider_integrity: providerIntegrity,
  };

  // 7. Persist to Database & Append to Immutable Audit Trail
  await database.recordVerificationResult(verificationRecord);

  return verificationRecord;
}

/**
 * Batch verification for all evidence items in a case.
 */
export async function verifyCaseEvidenceIntegrity(
  caseId: string,
  actorId: string,
  actorRole: UserRole,
  database: EvidenceVaultDatabase = globalDb,
  storageEngine: SecureEvidenceStorageEngine = globalStorageEngine
): Promise<{
  totalFiles: number;
  matches: number;
  mismatches: number;
  errors: number;
  results: IntegrityVerificationResult[];
}> {
  const caseEvidence = database.getEvidenceForCase(caseId);
  const results: IntegrityVerificationResult[] = [];
  let matches = 0;
  let mismatches = 0;
  let errors = 0;

  for (const ev of caseEvidence) {
    const fileVersions = database.getFileVersionsForEvidence(ev.id);
    for (const fv of fileVersions) {
      const res = await verifyEvidenceFileVersionIntegrity({
        fileVersionId: fv.id,
        actorId,
        actorRole,
        database,
        storageEngine,
      });
      results.push(res);
      if (res.result === 'MATCH') matches++;
      else if (res.result === 'MISMATCH') mismatches++;
      else errors++;
    }
  }

  return {
    totalFiles: results.length,
    matches,
    mismatches,
    errors,
    results,
  };
}
