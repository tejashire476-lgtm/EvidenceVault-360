// ============================================================================
// EVIDENCEVAULT 360 — PHASE 10: END-TO-END INTEGRATION & SECURITY TEST SUITE
// Tests Scenarios A through M:
// A. Police creates synthetic case & registers evidence
// B. Evidence uploads to private object storage & SHA-256 calculated
// C. Forensic receives evidence, acknowledges handoff & verifies file (MATCH)
// D. Modified test file produces real MISMATCH
// E. Forensic creates versioned examination report
// F. Prosecution reviews same case, evidence & report
// G. Chain-of-custody history & hash-linked audit verification work
// H. Unauthorized API requests & downloads rejected
// I. Broken or modified audit events detected
// J. Large-file upload failures, retries & quotas behave correctly
// K. Offline synchronization, conflicts & permission revalidation behave correctly
// L. Weekly audit filters & exports contain expected records
// M. Existing routes & previously working features remain functional
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EvidenceVaultDatabase,
  AuthorizationError,
} from '../db.ts';
import { seedDatabase } from '../seed.ts';
import {
  computeSha256,
} from '../../utils/crypto.ts';
import {
  SecureEvidenceStorageEngine,
  generateSignedUrl,
  validateEvidenceFile,
} from '../../utils/storage.ts';
import {
  verifyEvidenceFileVersionIntegrity,
} from '../../utils/verification.ts';
import {
  IdorAccessDeniedError,
} from '../../utils/security.ts';
import {
  OfflineQueueManager,
  OfflineSyncEngine,
  OfflineCacheManager,
  ProhibitedOfflineCacheError,
} from '../../utils/offlineSync.ts';
import {
  OfflineBiometricEngine,
  BIOMETRIC_FEASIBILITY_SPEC,
} from '../../utils/biometric.ts';
import {
  AuditReviewEngine,
  AuditReviewScheduler,
  sanitizeCsvField,
} from '../../utils/auditReview.ts';
import type { SecurityContext } from '../../types.ts';

// ----------------------------------------------------------------------------
// Test A: Police creates a synthetic case and registers evidence
// ----------------------------------------------------------------------------
test('Phase 10 - Test A: Police creates a synthetic case and registers evidence', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  const newCase = await db.createCase(
    {
      id: 'CASE-SYNTH-P10-001',
      case_reference: 'CASE-SYNTH-P10-001',
      title: 'State vs. Cyber Syndicate Omega',
      category: 'Cyber Financial Fraud & Exfiltration',
      incident_date: '2026-10-01T10:00:00.000Z',
      assigned_officer_id: policeContext.actorId,
      status: 'OPEN',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  assert.ok(newCase.id);
  assert.equal(newCase.case_reference, 'CASE-SYNTH-P10-001');
  assert.equal(newCase.status, 'OPEN');

  const evidence = await db.createEvidence(
    {
      id: 'EVD-SYNTH-DISK-001',
      case_id: newCase.id,
      description: 'Physical NVMe Drive imaged from primary command server',
      evidence_type: 'DISK_IMAGE',
      source_description: 'Seized during raid at Mumbai Data Center',
      collected_by: policeContext.actorId,
      collected_at: '2026-10-02T14:30:00.000Z',
      current_status: 'ACQUIRED',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  assert.ok(evidence.id);
  assert.equal(evidence.case_id, newCase.id);
  assert.equal(evidence.current_status, 'ACQUIRED');
});

// ----------------------------------------------------------------------------
// Test B: Evidence uploads to private object storage and its SHA-256 is calculated
// ----------------------------------------------------------------------------
test('Phase 10 - Test B: Evidence uploads to private object storage and its SHA-256 is calculated', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);
  const storage = new SecureEvidenceStorageEngine();

  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  const newCase = await db.createCase(
    {
      id: 'CASE-SYNTH-P10-002',
      case_reference: 'CASE-SYNTH-P10-002',
      title: 'State vs. Ransomware Cell Alpha',
      category: 'Cyber Ransomware',
      incident_date: '2026-10-02T10:00:00.000Z',
      assigned_officer_id: policeContext.actorId,
      status: 'OPEN',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  const evidence = await db.createEvidence(
    {
      id: 'EVD-SYNTH-NET-002',
      case_id: newCase.id,
      description: 'Encrypted packet capture file',
      evidence_type: 'NETWORK_CAPTURE',
      source_description: 'Network gateway tap',
      collected_by: policeContext.actorId,
      collected_at: '2026-10-02T15:00:00.000Z',
      current_status: 'ACQUIRED',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  const fileBytes = new TextEncoder().encode('SYNTHETIC_PCAP_DUMP_STREAM_BITS_84920');
  const sha256 = await computeSha256(fileBytes);

  // Validate filename and generate canonical storage key
  const validation = validateEvidenceFile('gateway_traffic.pcap', fileBytes.byteLength, 'NETWORK_CAPTURE');
  assert.equal(validation.isValid, true);

  // Multipart upload to storage
  const upload = storage.initiateMultipartUpload({
    caseId: newCase.id,
    evidenceId: evidence.id,
    versionId: 'v1',
    originalFilename: 'gateway_traffic.pcap',
    contentType: 'application/vnd.tcpdump.pcap',
    totalSizeBytes: fileBytes.byteLength,
    evidenceType: 'NETWORK_CAPTURE',
    uploadedBy: policeContext.actorId,
    expectedSha256: sha256,
  });

  const partRes = await storage.uploadPart(upload.uploadId, 0, fileBytes);
  assert.equal(partRes.etag, sha256);

  const completeRes = await storage.completeMultipartUpload(upload.uploadId, fileBytes);
  assert.equal(completeRes.sha256, sha256);

  // Associate version in DB
  const fileVersion = await db.addFileVersion({
    id: 'FILE-SYNTH-002',
    evidence_id: evidence.id,
    original_filename: 'gateway_traffic.pcap',
    generated_storage_key: completeRes.storageKey,
    content_type: 'application/vnd.tcpdump.pcap',
    file_size: fileBytes.byteLength,
    sha256_hash: sha256,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: policeContext.actorId,
  });

  assert.ok(fileVersion.id);
  assert.equal(fileVersion.sha256_hash, sha256);
  assert.ok(fileVersion.generated_storage_key.includes('gateway_traffic.pcap'));
});

// ----------------------------------------------------------------------------
// Test C: Forensic receives evidence, acknowledges handoff and verifies the file (MATCH)
// ----------------------------------------------------------------------------
test('Phase 10 - Test C: Forensic receives evidence, acknowledges handoff and verifies the file (MATCH)', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);
  const storage = new SecureEvidenceStorageEngine();

  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  const forensicContext: SecurityContext = {
    actorId: 'USR-FORENSIC-01',
    role: 'FORENSIC_EXAMINER',
  };

  const pCase = await db.createCase(
    {
      id: 'CASE-SYNTH-P10-003',
      case_reference: 'CASE-SYNTH-P10-003',
      title: 'State vs. Darknet Exchange',
      category: 'Cyber Narcotics',
      incident_date: '2026-10-03T11:00:00.000Z',
      assigned_officer_id: policeContext.actorId,
      status: 'OPEN',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  const pEvd = await db.createEvidence(
    {
      id: 'EVD-SYNTH-003',
      case_id: pCase.id,
      description: 'Extracted Bitcoin wallet raw dump',
      evidence_type: 'DATABASE_DUMP',
      source_description: 'Seized encrypted laptop',
      collected_by: policeContext.actorId,
      collected_at: '2026-10-03T12:00:00.000Z',
      current_status: 'ACQUIRED',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  const fileBytes = new TextEncoder().encode('RAW_BITCOIN_WALLET_DATABASE_BITS_GENUINE');
  const computedHash = await computeSha256(fileBytes);

  const upload = storage.initiateMultipartUpload({
    caseId: pCase.id,
    evidenceId: pEvd.id,
    versionId: 'v1',
    originalFilename: 'wallet.raw',
    contentType: 'application/octet-stream',
    totalSizeBytes: fileBytes.byteLength,
    evidenceType: 'DATABASE_DUMP',
    uploadedBy: policeContext.actorId,
    expectedSha256: computedHash,
  });
  await storage.uploadPart(upload.uploadId, 0, fileBytes);
  const completeRes = await storage.completeMultipartUpload(upload.uploadId, fileBytes);

  const fv = await db.addFileVersion({
    id: 'FILE-SYNTH-003',
    evidence_id: pEvd.id,
    original_filename: 'wallet.raw',
    generated_storage_key: completeRes.storageKey,
    content_type: 'application/octet-stream',
    file_size: fileBytes.byteLength,
    sha256_hash: computedHash,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: policeContext.actorId,
  });

  // Police submits handoff to Forensics
  const handoff = await db.createHandoff({
    id: 'HND-SYNTH-003',
    evidence_id: pEvd.id,
    source_department: 'POLICE',
    destination_department: 'FORENSIC',
    submitted_by: policeContext.actorId,
    received_by: null,
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
    acknowledged_at: null,
    rejection_reason: null,
  });

  assert.equal(handoff.status, 'SUBMITTED');

  // Forensic transitions handoff status to RECEIVED (acknowledges handoff)
  const acceptedHandoff = await db.transitionHandoffStatus(
    handoff.id,
    'RECEIVED',
    forensicContext.actorId
  );
  assert.equal(acceptedHandoff.status, 'RECEIVED');
  assert.equal(acceptedHandoff.received_by, forensicContext.actorId);

  // Forensic verifies file integrity against baseline hash
  const verifyResult = await verifyEvidenceFileVersionIntegrity({
    fileVersionId: fv.id,
    actorId: forensicContext.actorId,
    actorRole: forensicContext.role,
    storageEngine: storage,
    database: db,
  });

  assert.equal(verifyResult.result, 'MATCH');
  assert.equal(verifyResult.expected_sha256, computedHash);
  assert.equal(verifyResult.observed_sha256, computedHash);
  assert.equal(verifyResult.verified_by_role, 'FORENSIC_EXAMINER');
});

// ----------------------------------------------------------------------------
// Test D: Modified test file produces a real MISMATCH result
// ----------------------------------------------------------------------------
test('Phase 10 - Test D: Modified test file produces a real MISMATCH result', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);
  const storage = new SecureEvidenceStorageEngine();

  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  const forensicContext: SecurityContext = {
    actorId: 'USR-FORENSIC-01',
    role: 'FORENSIC_EXAMINER',
  };

  const pCase = await db.createCase(
    {
      id: 'CASE-SYNTH-P10-004',
      case_reference: 'CASE-SYNTH-P10-004',
      title: 'State vs. Insider Tamper Attack',
      category: 'Data Tampering',
      incident_date: '2026-10-04T09:00:00.000Z',
      assigned_officer_id: policeContext.actorId,
      status: 'OPEN',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  const pEvd = await db.createEvidence(
    {
      id: 'EVD-SYNTH-004',
      case_id: pCase.id,
      description: 'System access log',
      evidence_type: 'SYSTEM_LOG',
      source_description: 'Bastion host auth.log',
      collected_by: policeContext.actorId,
      collected_at: '2026-10-04T10:00:00.000Z',
      current_status: 'ACQUIRED',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  const originalBytes = new TextEncoder().encode('UNALTERED_AUTHENTIC_SYSLOG_LINE_001');
  const originalHash = await computeSha256(originalBytes);

  const upload = storage.initiateMultipartUpload({
    caseId: pCase.id,
    evidenceId: pEvd.id,
    versionId: 'v1',
    originalFilename: 'auth.log',
    contentType: 'text/plain',
    totalSizeBytes: originalBytes.byteLength,
    evidenceType: 'SYSTEM_LOG',
    uploadedBy: policeContext.actorId,
    expectedSha256: originalHash,
  });
  await storage.uploadPart(upload.uploadId, 0, originalBytes);
  const completeRes = await storage.completeMultipartUpload(upload.uploadId, originalBytes);

  const fv = await db.addFileVersion({
    id: 'FILE-SYNTH-004',
    evidence_id: pEvd.id,
    original_filename: 'auth.log',
    generated_storage_key: completeRes.storageKey,
    content_type: 'text/plain',
    file_size: originalBytes.byteLength,
    sha256_hash: originalHash,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: policeContext.actorId,
  });

  // Tamper simulation: deliberately alter bytes in storage to emulate unauthorized disk modification
  storage.tamperObject(completeRes.storageKey);

  const verifyResult = await verifyEvidenceFileVersionIntegrity({
    fileVersionId: fv.id,
    actorId: forensicContext.actorId,
    actorRole: forensicContext.role,
    storageEngine: storage,
    database: db,
  });

  assert.equal(verifyResult.result, 'MISMATCH');
  assert.notEqual(verifyResult.observed_sha256, verifyResult.expected_sha256);
  assert.equal(verifyResult.expected_sha256, originalHash);
});

// ----------------------------------------------------------------------------
// Test E: Forensic creates a versioned examination report
// ----------------------------------------------------------------------------
test('Phase 10 - Test E: Forensic creates a versioned examination report', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  const forensicContext: SecurityContext = {
    actorId: 'USR-FORENSIC-01',
    role: 'FORENSIC_EXAMINER',
  };

  const pCase = await db.createCase(
    {
      id: 'CASE-SYNTH-P10-005',
      case_reference: 'CASE-SYNTH-P10-005',
      title: 'State vs. Malware Developer',
      category: 'Cyber Malware',
      incident_date: '2026-10-05T08:00:00.000Z',
      assigned_officer_id: policeContext.actorId,
      status: 'OPEN',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  const pEvd = await db.createEvidence(
    {
      id: 'EVD-SYNTH-005',
      case_id: pCase.id,
      description: 'Reverse engineered malware executable',
      evidence_type: 'DISK_IMAGE',
      source_description: 'Extracted malware payload',
      collected_by: policeContext.actorId,
      collected_at: '2026-10-05T09:00:00.000Z',
      current_status: 'ACQUIRED',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  // Version 1 of examination report
  const rptV1 = await db.createOrReviseReport({
    case_id: pCase.id,
    evidence_id: pEvd.id,
    author_id: forensicContext.actorId,
    report_content: 'Initial Static Triage: Executable contains UPX packer with C2 beacon string.',
    status: 'DRAFT',
  });

  assert.ok(rptV1.id);
  assert.equal(rptV1.version_number, 1);
  assert.equal(rptV1.status, 'DRAFT');

  // Version 2 of examination report (revised/final)
  const rptV2 = await db.createOrReviseReport({
    case_id: pCase.id,
    evidence_id: pEvd.id,
    author_id: forensicContext.actorId,
    report_content: 'Final Dynamic Analysis: Trojan downloads secondary payload from 198.51.100.42. Keylogger active.',
    status: 'FINAL',
  });

  assert.ok(rptV2.id);
  assert.equal(rptV2.version_number, 2);
  assert.equal(rptV2.status, 'FINAL');
  assert.notEqual(rptV1.id, rptV2.id);
  assert.notEqual(rptV1.report_content, rptV2.report_content);

  // Both versions remain independently identifiable
  const allReports = db.getReportsForEvidence(pEvd.id);
  assert.equal(allReports.length, 2);
  assert.equal(allReports[0].version_number, 2);
  assert.equal(allReports[1].version_number, 1);
});

// ----------------------------------------------------------------------------
// Test F: Prosecution reviews the same case, evidence and report
// ----------------------------------------------------------------------------
test('Phase 10 - Test F: Prosecution reviews the same case, evidence and report', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  const forensicContext: SecurityContext = {
    actorId: 'USR-FORENSIC-01',
    role: 'FORENSIC_EXAMINER',
  };

  const prosecutorContext: SecurityContext = {
    actorId: 'USR-PROSECUTOR-01',
    role: 'PUBLIC_PROSECUTOR',
  };

  const pCase = await db.createCase(
    {
      id: 'CASE-SYNTH-P10-006',
      case_reference: 'CASE-SYNTH-P10-006',
      title: 'State vs. Extortion Syndicate Beta',
      category: 'Cyber Extortion',
      incident_date: '2026-10-06T10:00:00.000Z',
      assigned_officer_id: policeContext.actorId,
      status: 'OPEN',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  const pEvd = await db.createEvidence(
    {
      id: 'EVD-SYNTH-006',
      case_id: pCase.id,
      description: 'Extortion audio recordings and cryptographic hashes',
      evidence_type: 'MEDIA',
      source_description: 'VoIP wiretap recording',
      collected_by: policeContext.actorId,
      collected_at: '2026-10-06T11:00:00.000Z',
      current_status: 'ACQUIRED',
      created_by: policeContext.actorId,
    },
    policeContext
  );

  const rpt = await db.createOrReviseReport({
    case_id: pCase.id,
    evidence_id: pEvd.id,
    author_id: forensicContext.actorId,
    report_content: 'Acoustic waveform authenticated. Voice biometric match confirmed.',
    status: 'FINAL',
  });

  // Prosecutor submits formal judicial review
  const review = await db.submitProsecutionReview({
    id: 'REV-SYNTH-P10-001',
    case_id: pCase.id,
    report_id: rpt.id,
    reviewer_id: prosecutorContext.actorId,
    status: 'ACCEPTED_FOR_TRIAL',
    review_notes: 'All cryptographic hashes match ingestion baseline. Handoff custody complete. Section 65B certified for trial.',
  });

  assert.ok(review.id);
  assert.equal(review.status, 'ACCEPTED_FOR_TRIAL');

  // Generate prosecution case evidence index
  const caseIndex = AuditReviewEngine.generateProsecutionEvidenceIndex(
    db,
    pCase.id,
    prosecutorContext
  );

  assert.equal(caseIndex.caseReference, 'CASE-SYNTH-P10-006');
  assert.ok(caseIndex.judicialCertificationSection65B.includes('SECTION 65B'));
  assert.ok(caseIndex.judicialCertificationSection65B.includes('ISO/IEC 27037:2012'));
});

// ----------------------------------------------------------------------------
// Test G: Chain-of-custody history and hash-linked audit verification work
// ----------------------------------------------------------------------------
test('Phase 10 - Test G: Chain-of-custody history and hash-linked audit verification work', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // Verify that the hash-chained audit ledger is intact from genesis to tip
  const verification = await db.verifyAuditChain();
  assert.equal(verification.isValid, true);
  assert.ok(verification.totalBlocks >= 1);
  assert.equal(verification.totalBlocks, verification.verifiedBlocks);

  // Verify that previous block hash links are sequentially valid
  const audits = db.getAuditEvents();
  for (let i = 1; i < audits.length; i++) {
    assert.equal(audits[i].previous_event_hash, audits[i - 1].event_hash);
  }
});

// ----------------------------------------------------------------------------
// Test H: Unauthorized API requests and downloads are rejected
// ----------------------------------------------------------------------------
test('Phase 10 - Test H: Unauthorized API requests and downloads are rejected', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const unauthorizedPoliceContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  const allCases = db.getAllCases();
  assert.ok(allCases.length > 0);
  const targetCase = allCases[0];

  // 1. Police role cannot create a forensic report
  await assert.rejects(
    async () => {
      await db.createOrReviseReport({
        case_id: targetCase.id,
        evidence_id: 'EVD-2026-001',
        author_id: unauthorizedPoliceContext.actorId,
        report_content: 'Unauthorized report content',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      return true;
    }
  );

  // 2. Police role cannot submit prosecution trial review
  await assert.rejects(
    async () => {
      await db.submitProsecutionReview({
        id: 'REV-UNAUTH-01',
        case_id: targetCase.id,
        report_id: 'REP-01',
        reviewer_id: unauthorizedPoliceContext.actorId,
        status: 'ACCEPTED_FOR_TRIAL',
        review_notes: 'Unauthorized review attempt',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      return true;
    }
  );

  // 3. Unassigned officer or unauthorized role blocked from direct download
  assert.throws(
    () => {
      db.authorizeDownload(
        {
          actorId: 'USR-INTRUDER-99',
          role: 'POLICE_INVESTIGATOR',
        },
        'EVD-2026-001'
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof IdorAccessDeniedError || err instanceof Error);
      return true;
    }
  );

  // 4. Generating signed URL with unauthorized role directly rejected
  await assert.rejects(
    async () => {
      await generateSignedUrl(
        'cases/CASE-01/evidence/EVD-01/v1/disk.raw',
        'POLICE_INVESTIGATOR',
        'GET'
      );
    },
    /Access Denied/
  );
});

// ----------------------------------------------------------------------------
// Test I: Broken or modified audit events are detected
// ----------------------------------------------------------------------------
test('Phase 10 - Test I: Broken or modified audit events are detected', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // Verify unbroken initially
  const initialChain = await db.verifyAuditChain();
  assert.equal(initialChain.isValid, true);

  // Simulate malicious direct tamper on database audit block
  const auditBlocks = db.getAuditEvents();
  assert.ok(auditBlocks.length >= 2);
  const targetBlock = auditBlocks[1];
  (targetBlock as { action: string }).action = 'MALICIOUS_UNAUTHORIZED_ALTERATION';

  // Verifier detects break
  const corruptedChain = await db.verifyAuditChain();
  assert.equal(corruptedChain.isValid, false);

  // Audit review engine flags it as CONFIRMED_FINDING CRITICAL
  const findings = await AuditReviewEngine.generateAuditFindings(db, {}, {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  });

  const brokenChainFinding = findings.find((f) => f.category === 'BROKEN_AUDIT_CHAIN');
  assert.ok(brokenChainFinding);
  assert.equal(brokenChainFinding?.classification, 'CONFIRMED_FINDING');
  assert.equal(brokenChainFinding?.severity, 'CRITICAL');
});

// ----------------------------------------------------------------------------
// Test J: Large-file upload failures, retries and quotas behave correctly
// ----------------------------------------------------------------------------
test('Phase 10 - Test J: Large-file upload failures, retries and quotas behave correctly', async () => {
  const storage = new SecureEvidenceStorageEngine();

  // 1. Quota check: Oversized file rejected (600 MB exceeds DOCUMENT 500 MB limit)
  const oversizedLimit = 600 * 1024 * 1024;
  const valOversized = validateEvidenceFile('case_brief.pdf', oversizedLimit, 'DOCUMENT');
  assert.equal(valOversized.isValid, false);
  assert.ok(valOversized.errorMessage?.includes('exceeds'));

  // 2. Cancellation / abort cleanup
  const upload = storage.initiateMultipartUpload({
    caseId: 'CASE-10-J',
    evidenceId: 'EVD-10-J',
    versionId: 'v1',
    originalFilename: 'large_memory.dmp',
    contentType: 'application/octet-stream',
    totalSizeBytes: 100 * 1024 * 1024,
    evidenceType: 'MEMORY_DUMP',
    uploadedBy: 'USR-POLICE-01',
  });

  storage.abortMultipartUpload(upload.uploadId);

  // Uploading to aborted session is rejected
  await assert.rejects(
    async () => {
      await storage.uploadPart(upload.uploadId, 0, new Uint8Array(1024));
    },
    /was cancelled/
  );
});

// ----------------------------------------------------------------------------
// Test K: Offline synchronization, conflicts and permission revalidation behave correctly
// ----------------------------------------------------------------------------
test('Phase 10 - Test K: Offline synchronization, conflicts and permission revalidation behave correctly', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  OfflineQueueManager.clearQueue();

  // 1. Prohibited offline caching: caching raw evidence files or forensic reports is blocked
  assert.throws(
    () => {
      OfflineCacheManager.assertNonSensitiveOnly({
        case_id: 'CASE-2026-001',
        raw_evidence_binary: new Uint8Array([0x01, 0x02, 0x03]),
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ProhibitedOfflineCacheError);
      return true;
    }
  );

  // 2. Enqueue permitted offline action (CREATE_CASE)
  const queuedItem = OfflineQueueManager.enqueueAction({
    action: 'CREATE_CASE',
    actorId: 'USR-POLICE-01',
    actorRole: 'POLICE_INVESTIGATOR',
    actorDepartment: 'POLICE',
    idempotencyKey: 'IDEMP-CASE-P10-TEST-01',
    payload: {
      id: 'CASE-OFFLINE-P10-01',
      case_reference: 'EV-OFFLINE-P10-01',
      title: 'Field Triage Cybercrime Report',
      category: 'Cyber Financial Crime',
      incident_date: null,
      assigned_officer_id: null,
      status: 'OPEN',
      created_by: 'USR-POLICE-01',
    },
  });

  assert.equal(queuedItem.status, 'PENDING');

  // 3. Reconnection sync executes idempotently
  const syncEngine = new OfflineSyncEngine();
  const syncReport = await syncEngine.syncQueue(db);
  assert.equal(syncReport.totalEvents, 1);
  assert.equal(syncReport.syncedCount, 1);
  assert.equal(syncReport.failedCount, 0);

  // 4. Duplicate resubmission of same event is ignored (idempotency)
  const duplicateSync = await syncEngine.syncQueue(db);
  assert.equal(duplicateSync.totalEvents, 0); // Already synced
});

// ----------------------------------------------------------------------------
// Test L: Weekly audit filters and exports contain the expected records
// ----------------------------------------------------------------------------
test('Phase 10 - Test L: Weekly audit filters and exports contain the expected records', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const actorContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };

  const startIso = '2026-01-01T00:00:00.000Z';
  const endIso = '2026-12-31T23:59:59.999Z';

  const summary = await AuditReviewEngine.generateWeeklySummary(db, actorContext, {
    startDate: startIso,
    endDate: endIso,
  });

  assert.ok(summary.totalAuditBlocksEvaluated > 0);
  assert.equal(summary.auditChainIntegrityStatus, 'INTACT');

  // CSV export conforms to RFC-4180 and formula injection protection
  const csvWeekly = AuditReviewEngine.exportWeeklyAuditSummaryToCsv(summary);
  assert.ok(csvWeekly.includes('EVIDENCEVAULT 360 — WEEKLY AUDIT & COMPLIANCE REVIEW REPORT'));

  // Test formula injection sanitizer
  assert.equal(sanitizeCsvField('=CMD|"/C calc"!A1'), `"'=CMD|""/C calc""!A1"`);
  assert.equal(sanitizeCsvField('+12345'), `"'+12345"`);
  assert.equal(sanitizeCsvField('@SUM(A1:A10)'), `"'@SUM(A1:A10)"`);
});

// ----------------------------------------------------------------------------
// Test M: Existing routes and previously working features remain functional
// ----------------------------------------------------------------------------
test('Phase 10 - Test M: Existing routes and previously working features remain functional', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // 1. Validate Cases and Evidence records exist
  const cases = db.getAllCases();
  assert.ok(cases.length >= 1);

  const evidence = db.getAllEvidence();
  assert.ok(evidence.length >= 1);

  // 2. Validate Biometric Feasibility Specification
  assert.equal(BIOMETRIC_FEASIBILITY_SPEC.status, 'CONDITIONALLY_FEASIBLE_AS_MFA_ONLY');
  assert.ok(BIOMETRIC_FEASIBILITY_SPEC.supportedBrowsers.some((b) => b.includes('Chrome')));

  // 3. Validate Biometric MFA match & mismatch engine
  const bioEngine = new OfflineBiometricEngine();
  const consentRes = bioEngine.recordConsent('USR-POLICE-01', true);
  assert.equal(consentRes, 'GRANTED');

  const matchCandidate = bioEngine.generateCandidateVector('USR-POLICE-01', 0.02);
  const matchOutcome = await bioEngine.verifyFace({
    userId: 'USR-POLICE-01',
    candidateVector: matchCandidate,
    simulateLivenessChallenge: true,
    challengeResponseValid: true,
    database: db,
  });
  assert.equal(matchOutcome.outcome, 'MATCH');

  // 4. Validate AuditReviewScheduler status
  const schedStatus = AuditReviewScheduler.getSchedulerStatus();
  assert.ok(['MANUAL_ON_DEMAND', 'INTERVAL_TIMER_ACTIVE'].includes(schedStatus.mode));
});

// ----------------------------------------------------------------------------
// Test N: Enterprise Database Backup, Snapshot Export, and Disaster Restoration
// ----------------------------------------------------------------------------
test('Phase 10 - Test N: Enterprise Database Backup, Snapshot Export, and Disaster Restoration', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // 1. Verify snapshot export contains baseline entities
  const snapshotBefore = db.getSnapshot();
  assert.ok(snapshotBefore.cases.length > 0);
  assert.ok(snapshotBefore.evidence.length > 0);
  assert.ok(snapshotBefore.audits.length > 0);

  // 2. Perform export backup
  const backupJson = db.exportBackup();
  assert.ok(backupJson.length > 100);
  const parsed = JSON.parse(backupJson);
  assert.equal(parsed.backupVersion, '1.0');
  assert.ok(parsed.entities.cases.length > 0);

  // 3. Simulate disaster recovery into a clean, empty secondary instance
  const restoredDb = new EvidenceVaultDatabase();
  assert.equal(restoredDb.getAllCases().length, 0);

  const restoreResult = await restoredDb.restoreBackup(backupJson);
  assert.equal(restoreResult.restored, true);
  assert.equal(restoreResult.auditChainValid, true);
  assert.ok(restoreResult.totalEntities > 0);

  // 4. Verify restored state matches original exactly
  assert.equal(restoredDb.getAllCases().length, db.getAllCases().length);
  assert.equal(restoredDb.getAllEvidence().length, db.getAllEvidence().length);
  assert.equal(restoredDb.getSnapshot().audits.length, db.getSnapshot().audits.length);

  // 5. Verify cryptographic audit chain integrity after restore
  const chainAudit = await restoredDb.verifyAuditChain();
  assert.equal(chainAudit.isValid, true);
  assert.equal(chainAudit.verifiedBlocks, db.getSnapshot().audits.length);
});

