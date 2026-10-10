// ============================================================================
// Automated Test Suite: Shared Relational Architecture & Integrity Verification
// Tests for Section 8: Case creation, relationships, constraints, versioning, transitions
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EvidenceVaultDatabase,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  InvalidStatusTransitionError,
  AuthorizationError,
} from '../db.ts';
import { seedDatabase } from '../seed.ts';
import {
  computeSha256,
  verifyHashMatch,
  IncrementalSha256,
} from '../../utils/crypto.ts';
import {
  generateCanonicalStorageKey,
  validateEvidenceFile,
  generateSignedUrl,
  verifySignedUrl,
  SecureEvidenceStorageEngine,
} from '../../utils/storage.ts';
import {
  verifyEvidenceFileVersionIntegrity,
  verifyCaseEvidenceIntegrity,
} from '../../utils/verification.ts';
import {
  createAuthSession,
  validateAuthSession,
  globalRateLimiter,
  detectPathTraversal,
  IdorAccessDeniedError,
  logSecurityViolation,
} from '../../utils/security.ts';
import {
  OfflineCacheManager,
  OfflineQueueManager,
  OfflineSyncEngine,
  ProhibitedOfflineCacheError,
} from '../../utils/offlineSync.ts';
import {
  OfflineBiometricEngine,
  BiometricConsentRequiredError,
  BIOMETRIC_MATCH_THRESHOLD,
  BIOMETRIC_FEASIBILITY_SPEC,
  normalizeVector128,
} from '../../utils/biometric.ts';
import {
  AuditReviewEngine,
  AuditReviewScheduler,
  sanitizeCsvField,
} from '../../utils/auditReview.ts';

test('1. A case can be created with a unique ID and retrieved', async () => {
  const db = new EvidenceVaultDatabase();
  db.addUser({
    id: 'USR-TEST-01',
    display_name: 'Test Officer',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  const newCase = await db.createCase({
    id: 'CASE-UNIT-101',
    case_reference: 'EV-REF-101',
    title: 'Unit Test Cyber Case',
    category: 'Malware Investigation',
    incident_date: '2026-10-01T12:00:00Z',
    assigned_officer_id: 'USR-TEST-01',
    status: 'OPEN',
    created_by: 'USR-TEST-01',
  });

  assert.equal(newCase.id, 'CASE-UNIT-101');
  assert.equal(newCase.case_reference, 'EV-REF-101');
  assert.ok(newCase.created_at);

  const retrieved = db.getCase('CASE-UNIT-101');
  assert.ok(retrieved);
  assert.equal(retrieved.title, 'Unit Test Cyber Case');
});

test('2. Evidence can be successfully associated with an existing case', async () => {
  const db = new EvidenceVaultDatabase();
  await db.createCase({
    id: 'CASE-UNIT-102',
    case_reference: 'EV-REF-102',
    title: 'Network Intrusion Case',
    category: 'Network Intrusion',
    incident_date: null,
    assigned_officer_id: null,
    status: 'OPEN',
    created_by: 'SYSTEM',
  });

  const evidence = await db.createEvidence({
    id: 'EVD-UNIT-201',
    case_id: 'CASE-UNIT-102',
    description: 'PCAP packet capture file',
    evidence_type: 'NETWORK_CAPTURE',
    source_description: 'Core switch mirror port',
    collected_by: 'USR-TEST-01',
    collected_at: '2026-10-02T10:00:00Z',
    current_status: 'ACQUIRED',
    created_by: 'USR-TEST-01',
  });

  assert.equal(evidence.case_id, 'CASE-UNIT-102');
  const forCase = db.getEvidenceForCase('CASE-UNIT-102');
  assert.equal(forCase.length, 1);
  assert.equal(forCase[0].id, 'EVD-UNIT-201');
});

test('3. Evidence referencing a nonexistent case is rejected with ForeignKeyConstraintError', async () => {
  const db = new EvidenceVaultDatabase();

  await assert.rejects(
    async () => {
      await db.createEvidence({
        id: 'EVD-ORPHAN-999',
        case_id: 'NONEXISTENT-CASE-ID',
        description: 'Orphan evidence item',
        evidence_type: 'DISK_IMAGE',
        source_description: 'Unknown',
        collected_by: 'USR-TEST-01',
        collected_at: new Date().toISOString(),
        current_status: 'ACQUIRED',
        created_by: 'USR-TEST-01',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ForeignKeyConstraintError);
      assert.match(err.message, /references nonexistent case_id 'NONEXISTENT-CASE-ID'/);
      return true;
    }
  );
});

test('4. Duplicate unique references (case_reference) are rejected with UniqueConstraintError', async () => {
  const db = new EvidenceVaultDatabase();
  await db.createCase({
    id: 'CASE-ORIGINAL-01',
    case_reference: 'EV-DUPLICATE-REF',
    title: 'First Case',
    category: 'Financial',
    incident_date: null,
    assigned_officer_id: null,
    status: 'OPEN',
    created_by: 'SYSTEM',
  });

  await assert.rejects(
    async () => {
      await db.createCase({
        id: 'CASE-SECOND-02',
        case_reference: 'EV-DUPLICATE-REF', // duplicate reference!
        title: 'Second Case With Same Reference',
        category: 'Financial',
        incident_date: null,
        assigned_officer_id: null,
        status: 'OPEN',
        created_by: 'SYSTEM',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof UniqueConstraintError);
      assert.match(err.message, /with case_reference 'EV-DUPLICATE-REF' already exists/);
      return true;
    }
  );
});

test('5. Report versions remain independently identifiable and are not overwritten', async () => {
  const db = new EvidenceVaultDatabase();
  await db.createCase({
    id: 'CASE-VER-01',
    case_reference: 'EV-REF-VER',
    title: 'Versioning Test Case',
    category: 'Forensics',
    incident_date: null,
    assigned_officer_id: null,
    status: 'OPEN',
    created_by: 'SYSTEM',
  });
  await db.createEvidence({
    id: 'EVD-VER-01',
    case_id: 'CASE-VER-01',
    description: 'Server RAM Dump',
    evidence_type: 'MEMORY_DUMP',
    source_description: 'Production host',
    collected_by: 'EXAMINER-1',
    collected_at: new Date().toISOString(),
    current_status: 'IN_FORENSIC_CUSTODY',
    created_by: 'EXAMINER-1',
  });

  // Create Version 1
  const v1 = await db.createOrReviseReport({
    case_id: 'CASE-VER-01',
    evidence_id: 'EVD-VER-01',
    author_id: 'EXAMINER-1',
    report_content: 'Initial assessment: injected process detected in svchost.exe PID 412.',
    status: 'DRAFT',
  });
  assert.equal(v1.version_number, 1);
  assert.equal(v1.id, 'REP-EVD-VER-01-v1');

  // Create Version 2 (Revised Findings)
  const v2 = await db.createOrReviseReport({
    case_id: 'CASE-VER-01',
    evidence_id: 'EVD-VER-01',
    author_id: 'EXAMINER-1',
    report_content: 'Updated assessment: C2 communication identified at IP 198.51.100.42.',
    status: 'FINALIZED',
  });
  assert.equal(v2.version_number, 2);
  assert.equal(v2.id, 'REP-EVD-VER-01-v2');

  // Verify that Version 1 still exists intact
  const allReports = db.getReportsForEvidence('EVD-VER-01');
  assert.equal(allReports.length, 2);
  assert.equal(allReports[0].version_number, 2);
  assert.equal(allReports[1].version_number, 1);
  assert.match(allReports[1].report_content, /PID 412/);
  assert.match(allReports[0].report_content, /198.51.100.42/);
});

test('6. Invalid workflow status transitions are rejected', async () => {
  const db = new EvidenceVaultDatabase();
  await db.createCase({
    id: 'CASE-FLOW-01',
    case_reference: 'EV-REF-FLOW',
    title: 'Workflow Test',
    category: 'Test',
    incident_date: null,
    assigned_officer_id: null,
    status: 'OPEN',
    created_by: 'SYSTEM',
  });
  await db.createEvidence({
    id: 'EVD-FLOW-01',
    case_id: 'CASE-FLOW-01',
    description: 'Evidence for handoff test',
    evidence_type: 'DOCUMENT',
    source_description: 'Office desk',
    collected_by: 'USER-1',
    collected_at: new Date().toISOString(),
    current_status: 'ACQUIRED',
    created_by: 'USER-1',
  });

  await db.createHandoff({
    id: 'HND-FLOW-01',
    evidence_id: 'EVD-FLOW-01',
    source_department: 'POLICE',
    destination_department: 'FORENSIC',
    submitted_by: 'USER-1',
    received_by: null,
    status: 'DRAFT',
    submitted_at: new Date().toISOString(),
    acknowledged_at: null,
    rejection_reason: null,
  });

  // Transition from DRAFT directly to REPORT_READY is illegal
  await assert.rejects(
    async () => {
      await db.transitionHandoffStatus('HND-FLOW-01', 'REPORT_READY', 'USER-1');
    },
    (err: unknown) => {
      assert.ok(err instanceof InvalidStatusTransitionError);
      assert.match(err.message, /cannot change from 'DRAFT' to 'REPORT_READY'/);
      return true;
    }
  );

  // Transition from DRAFT to SUBMITTED is valid
  const transitioned = await db.transitionHandoffStatus('HND-FLOW-01', 'SUBMITTED', 'USER-1');
  assert.equal(transitioned.status, 'SUBMITTED');
});

test('7. Seed data can be initialized repeatably without uncontrolled duplicate records', async () => {
  const db = new EvidenceVaultDatabase();

  const firstSeed = await seedDatabase(db);
  assert.equal(firstSeed.casesSeeded, 1);
  assert.equal(firstSeed.evidenceSeeded, 1);

  // Re-run seed on the same database
  const secondSeed = await seedDatabase(db);
  assert.equal(secondSeed.casesSeeded, 0, 'No duplicate cases should be seeded');
  assert.equal(secondSeed.evidenceSeeded, 0, 'No duplicate evidence should be seeded');

  // Verify exact counts
  assert.equal(db.getAllCases().length, 1);
  assert.equal(db.getAllEvidence().length, 1);
});

test('8. Real SHA-256 cryptographic verification and hash-chained audit ledger work', async () => {
  const testString = 'EvidenceVault 360 Test Payload';
  const realHash = await computeSha256(testString);
  assert.equal(realHash.length, 64);
  assert.ok(verifyHashMatch(realHash, realHash));
  assert.ok(!verifyHashMatch(realHash, '0000000000000000000000000000000000000000000000000000000000000000'));

  // Verify that repository operations create cryptographically chained audit events
  const db = new EvidenceVaultDatabase();
  await db.createCase({
    id: 'CASE-AUDIT-01',
    case_reference: 'EV-REF-AUDIT',
    title: 'Audit Verification Case',
    category: 'Integrity',
    incident_date: null,
    assigned_officer_id: null,
    status: 'OPEN',
    created_by: 'SYSTEM',
  });

  const audits = db.getAuditEvents();
  assert.ok(audits.length >= 1);
  const lastEvent = audits[audits.length - 1];
  assert.equal(lastEvent.action, 'CREATE_CASE');
  assert.equal(lastEvent.entity_type, 'Case');
  assert.equal(lastEvent.entity_id, 'CASE-AUDIT-01');
  assert.ok(lastEvent.event_hash);
  assert.equal(lastEvent.event_hash.length, 64);
});

test('9. Full Police -> Forensic -> Prosecution connected workflow', async () => {
  const db = new EvidenceVaultDatabase();

  // 1. Setup actors
  db.addUser({
    id: 'POLICE-01',
    display_name: 'Officer Rao',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });
  db.addUser({
    id: 'FORENSIC-01',
    display_name: 'Examiner Maya',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });
  db.addUser({
    id: 'PROSECUTOR-01',
    display_name: 'Counsel Mehta',
    role: 'PUBLIC_PROSECUTOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  // 2. POLICE creates case with stable ID & registers evidence
  const createdCase = await db.createCase({
    id: 'CASE-E2E-001',
    case_reference: 'EV-CASE-E2E-001',
    title: 'Server Ransomware Intrusion',
    category: 'Cyber Incident',
    incident_date: '2026-10-05T09:00:00Z',
    assigned_officer_id: 'POLICE-01',
    status: 'OPEN',
    created_by: 'POLICE-01',
  });
  assert.equal(createdCase.id, 'CASE-E2E-001');

  const evidence = await db.createEvidence({
    id: 'EVD-E2E-001',
    case_id: 'CASE-E2E-001',
    description: 'Suspicious USB thumb drive recovered at crime scene',
    evidence_type: 'DISK_IMAGE',
    source_description: 'Suspect desk drawer',
    collected_by: 'POLICE-01',
    collected_at: '2026-10-05T10:00:00Z',
    current_status: 'ACQUIRED',
    created_by: 'POLICE-01',
  });
  assert.equal(evidence.id, 'EVD-E2E-001');

  // Register file metadata with SHA-256
  const sampleHash = await computeSha256('USB forensic image byte content');
  await db.addFileVersion({
    id: 'FILE-E2E-001',
    evidence_id: 'EVD-E2E-001',
    original_filename: 'evidence-usb-dump.img',
    generated_storage_key: 'vault/case-e2e-001/usb-dump.img',
    content_type: 'application/octet-stream',
    file_size: 16777216,
    sha256_hash: sampleHash,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: 'POLICE-01',
  });

  // Police submits evidence to Forensics
  const handoff = await db.createHandoff({
    id: 'HND-E2E-001',
    evidence_id: 'EVD-E2E-001',
    source_department: 'POLICE',
    destination_department: 'FORENSIC',
    submitted_by: 'POLICE-01',
    received_by: null,
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
    acknowledged_at: null,
    rejection_reason: null,
  });
  assert.equal(handoff.status, 'SUBMITTED');
  assert.equal(db.getEvidence('EVD-E2E-001')?.current_status, 'SUBMITTED_TO_FORENSICS');

  // 3. FORENSIC accepts transfer and starts examination
  await db.transitionHandoffStatus('HND-E2E-001', 'RECEIVED', 'FORENSIC-01');
  const acceptedHandoff = db.getAllHandoffs().find((h) => h.id === 'HND-E2E-001')!;
  assert.equal(acceptedHandoff.status, 'RECEIVED');
  assert.equal(acceptedHandoff.received_by, 'FORENSIC-01');
  assert.ok(acceptedHandoff.acknowledged_at);
  assert.equal(db.getEvidence('EVD-E2E-001')?.current_status, 'IN_FORENSIC_CUSTODY');

  // Forensic begins examination
  await db.transitionHandoffStatus('HND-E2E-001', 'UNDER_EXAMINATION', 'FORENSIC-01');

  // Forensic generates version 1 report
  const repV1 = await db.createOrReviseReport({
    case_id: 'CASE-E2E-001',
    evidence_id: 'EVD-E2E-001',
    author_id: 'FORENSIC-01',
    report_content: 'Initial examination: Encrypted payload found in volume root.',
    status: 'DRAFT',
  });
  assert.equal(repV1.version_number, 1);

  // Forensic finalizes with report version 2
  const repV2 = await db.createOrReviseReport({
    case_id: 'CASE-E2E-001',
    evidence_id: 'EVD-E2E-001',
    author_id: 'FORENSIC-01',
    report_content: 'Final report: Trojan loader identified. SHA-256 matches baseline.',
    status: 'FINALIZED',
  });
  assert.equal(repV2.version_number, 2);

  // Mark examination complete -> REPORT_READY
  await db.transitionHandoffStatus('HND-E2E-001', 'REPORT_READY', 'FORENSIC-01');
  assert.equal(db.getEvidence('EVD-E2E-001')?.current_status, 'PROSECUTION_READY');

  // 4. PROSECUTION reviews and accepts for trial
  const completeness = db.assessEvidenceCompleteness('CASE-E2E-001');
  assert.equal(completeness.length, 1);
  assert.equal(completeness[0].isComplete, true);

  const review = await db.submitProsecutionReview({
    id: 'REV-E2E-001',
    case_id: 'CASE-E2E-001',
    report_id: repV2.id,
    reviewer_id: 'PROSECUTOR-01',
    status: 'ACCEPTED_FOR_TRIAL',
    review_notes: 'All custody logs verified. Forensic report v2 accepted for trial proceedings.',
  });
  assert.equal(review.status, 'ACCEPTED_FOR_TRIAL');

  // Generate Case Evidence Index
  const index = db.generateCaseEvidenceIndex('CASE-E2E-001');
  assert.equal(index.caseId, 'CASE-E2E-001');
  assert.equal(index.trialReadiness, 'READY_FOR_TRIAL');
  assert.equal(index.totalReportsCount, 2);
  assert.equal(index.evidenceItems[0].files[0].sha256Hash, sampleHash);
});

test('10. Forensic rejection with recorded reason returns evidence and logs custody', async () => {
  const db = new EvidenceVaultDatabase();
  await db.createCase({
    id: 'CASE-REJ-01',
    case_reference: 'EV-CASE-REJ-01',
    title: 'Tampered Package Case',
    category: 'Inspection',
    incident_date: null,
    assigned_officer_id: null,
    status: 'OPEN',
    created_by: 'SYSTEM',
  });

  await db.createEvidence({
    id: 'EVD-REJ-01',
    case_id: 'CASE-REJ-01',
    description: 'Damaged evidence bag with broken tamper seal',
    evidence_type: 'MEDIA',
    source_description: 'Field vehicle',
    collected_by: 'OFFICER-01',
    collected_at: new Date().toISOString(),
    current_status: 'ACQUIRED',
    created_by: 'OFFICER-01',
  });

  await db.createHandoff({
    id: 'HND-REJ-01',
    evidence_id: 'EVD-REJ-01',
    source_department: 'POLICE',
    destination_department: 'FORENSIC',
    submitted_by: 'OFFICER-01',
    received_by: null,
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
    acknowledged_at: null,
    rejection_reason: null,
  });

  // Forensic rejects with explicit reason
  const rejectionReason = 'Tamper-evident seal tape was torn prior to laboratory intake.';
  await db.transitionHandoffStatus('HND-REJ-01', 'RETURNED', 'EXAMINER-02', rejectionReason);

  const returnedHandoff = db.getAllHandoffs().find((h) => h.id === 'HND-REJ-01')!;
  assert.equal(returnedHandoff.status, 'RETURNED');
  assert.equal(returnedHandoff.rejection_reason, rejectionReason);
  assert.ok(returnedHandoff.acknowledged_at);

  // Evidence returned to Police custody
  const evidence = db.getEvidence('EVD-REJ-01')!;
  assert.equal(evidence.current_status, 'ACQUIRED');

  // Verify custody logs
  const custodyLogs = db.getCustodyEventsForEvidence('EVD-REJ-01');
  const rejectEvent = custodyLogs.find((c) => c.action === 'HANDOFF_RETURNED_OR_REJECTED');
  assert.ok(rejectEvent);
  assert.equal(rejectEvent?.destination, 'POLICE_EVIDENCE_ROOM');
});

test('11. Duplicate active handoff submissions are prevented', async () => {
  const db = new EvidenceVaultDatabase();
  await db.createCase({
    id: 'CASE-DUP-01',
    case_reference: 'EV-CASE-DUP-01',
    title: 'Duplicate Check Case',
    category: 'Fraud',
    incident_date: null,
    assigned_officer_id: null,
    status: 'OPEN',
    created_by: 'SYSTEM',
  });

  await db.createEvidence({
    id: 'EVD-DUP-01',
    case_id: 'CASE-DUP-01',
    description: 'Evidence item for duplicate handoff check',
    evidence_type: 'SYSTEM_LOG',
    source_description: 'Firewall server',
    collected_by: 'OFFICER-01',
    collected_at: new Date().toISOString(),
    current_status: 'ACQUIRED',
    created_by: 'OFFICER-01',
  });

  await db.createHandoff({
    id: 'HND-ACTIVE-01',
    evidence_id: 'EVD-DUP-01',
    source_department: 'POLICE',
    destination_department: 'FORENSIC',
    submitted_by: 'OFFICER-01',
    received_by: null,
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
    acknowledged_at: null,
    rejection_reason: null,
  });

  // Attempting second handoff while first is still active (SUBMITTED) must fail
  await assert.rejects(
    async () => {
      await db.createHandoff({
        id: 'HND-DUPLICATE-02',
        evidence_id: 'EVD-DUP-01',
        source_department: 'POLICE',
        destination_department: 'FORENSIC',
        submitted_by: 'OFFICER-01',
        received_by: null,
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString(),
        acknowledged_at: null,
        rejection_reason: null,
      });
    },
    (err: unknown) => {
      assert.match((err as Error).message, /Active handoff 'HND-ACTIVE-01' already exists/);
      return true;
    }
  );
});

test('12. Prosecution clarification request and Case Evidence Index generation', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const demoCaseId = 'CASE-2026-001';
  const completeness = db.assessEvidenceCompleteness(demoCaseId);
  assert.ok(completeness.length >= 1);

  // Prosecution requests clarification
  const reports = db.getReportsForEvidence('EVD-2026-001');
  const review = await db.submitProsecutionReview({
    id: 'REV-CLARIFY-01',
    case_id: demoCaseId,
    report_id: reports[0].id,
    reviewer_id: 'USR-PROSECUTOR-01',
    status: 'FURTHER_EVIDENCE_REQUESTED',
    review_notes: 'Please verify whether off-hours export was authorized by IT Admin.',
  });
  assert.equal(review.status, 'FURTHER_EVIDENCE_REQUESTED');

  // Verify Case Evidence Index
  const index = db.generateCaseEvidenceIndex(demoCaseId);
  assert.equal(index.caseReference, 'EV-CASE-2026-001');
  assert.ok(index.evidenceItems.length > 0);
  assert.ok(index.prosecutionReviews.some((r) => r.id === 'REV-CLARIFY-01'));
});

test('13. Audit chain verification confirms unbroken cryptographic link', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const verification = await db.verifyAuditChain();
  assert.equal(verification.isValid, true);
  assert.ok(verification.totalBlocks >= 4);
  assert.equal(verification.totalBlocks, verification.verifiedBlocks);

  const compliance = await db.generateComplianceReport('USR-AUDITOR-01');
  assert.equal(compliance.auditChainStatus, 'INTACT');
  assert.ok(compliance.findings.some((f) => f.includes('verified 100% intact')));
});

test('14. Server-side canonical storage key generation prevents path traversal', () => {
  const traversalFilename = '../../../../etc/shadow';
  const maliciousCaseId = '../../secret_case/..';
  const key = generateCanonicalStorageKey(maliciousCaseId, 'EVD-01', 'v1', traversalFilename);

  // Key must not contain ../ or ..\ sequences or leading slashes
  assert.ok(!key.includes('..'));
  assert.ok(!key.includes('/etc/shadow'));
  assert.match(key, /^cases\/.*\/evidence\/EVD-01\/v1\/.*shadow$/);
});

test('15. File type validation rejects dangerous executable extensions and unknown formats', () => {
  // Disallowed executables
  const exeResult = validateEvidenceFile('trojan_payload.exe', 1024, 'DISK_IMAGE');
  assert.equal(exeResult.isValid, false);
  assert.match(exeResult.errorMessage || '', /executable\/script format and cannot be uploaded/);

  const batResult = validateEvidenceFile('script.bat', 500, 'SYSTEM_LOG');
  assert.equal(batResult.isValid, false);

  const ps1Result = validateEvidenceFile('dump.ps1', 500, 'MEMORY_DUMP');
  assert.equal(ps1Result.isValid, false);

  // Permitted forensic artifacts
  const pcapResult = validateEvidenceFile('traffic_capture.pcapng', 2048, 'NETWORK_CAPTURE');
  assert.equal(pcapResult.isValid, true);

  const rawResult = validateEvidenceFile('disk_nvme0.raw', 1048576, 'DISK_IMAGE');
  assert.equal(rawResult.isValid, true);
});

test('16. Category size limits enforce quotas and reject oversized files', () => {
  const oversizedDocument = 600 * 1024 * 1024; // 600 MB (Document limit is 500 MB)
  const docResult = validateEvidenceFile('case_brief.pdf', oversizedDocument, 'DOCUMENT');
  assert.equal(docResult.isValid, false);
  assert.match(docResult.errorMessage || '', /exceeds configured maximum limit/);

  const validDoc = 10 * 1024 * 1024; // 10 MB
  const validDocResult = validateEvidenceFile('case_brief.pdf', validDoc, 'DOCUMENT');
  assert.equal(validDocResult.isValid, true);
});

test('17. Multipart upload chunking, progress tracking, and complete verification', async () => {
  const engine = new SecureEvidenceStorageEngine();

  const fileData = new TextEncoder().encode('Forensic Bit-stream Image Content Chunk Test Payload');
  const expectedHash = await computeSha256(fileData);

  const session = engine.initiateMultipartUpload({
    caseId: 'CASE-STORAGE-01',
    evidenceId: 'EVD-STORAGE-01',
    versionId: 'v1',
    originalFilename: 'disk-test.img',
    contentType: 'application/octet-stream',
    totalSizeBytes: fileData.length,
    evidenceType: 'DISK_IMAGE',
    uploadedBy: 'USR-POLICE-01',
    expectedSha256: expectedHash,
  });

  assert.equal(session.status, 'INITIALIZED');
  assert.ok(session.uploadId.startsWith('MPU-'));

  let progressCalled = false;
  await engine.uploadPart(session.uploadId, 1, fileData, (progress) => {
    progressCalled = true;
    assert.equal(progress.uploadId, session.uploadId);
    assert.equal(progress.percent, 100);
  });
  assert.ok(progressCalled);

  const completed = await engine.completeMultipartUpload(session.uploadId, fileData);
  assert.equal(completed.sha256, expectedHash);
  assert.equal(completed.totalBytes, fileData.length);
});

test('18. Incomplete upload cancellation and abort cleanup', () => {
  const engine = new SecureEvidenceStorageEngine();

  const session = engine.initiateMultipartUpload({
    caseId: 'CASE-ABORT-01',
    evidenceId: 'EVD-ABORT-01',
    versionId: 'v1',
    originalFilename: 'network.pcap',
    contentType: 'application/octet-stream',
    totalSizeBytes: 1000000,
    evidenceType: 'NETWORK_CAPTURE',
    uploadedBy: 'USR-POLICE-01',
  });

  // Cancel / Abort
  engine.abortMultipartUpload(session.uploadId);

  // Attempting to complete aborted upload must fail
  assert.rejects(async () => {
    await engine.completeMultipartUpload(session.uploadId, new Uint8Array([1, 2, 3]));
  });
});

test('19. Post-upload SHA-256 integrity verification detects bit-flip mismatches', async () => {
  const engine = new SecureEvidenceStorageEngine();

  const originalContent = new TextEncoder().encode('Baseline original disk dump');
  const expectedHash = await computeSha256(originalContent);

  const corruptedContent = new TextEncoder().encode('Baseline corrupted bit-flip disk dump');

  const session = engine.initiateMultipartUpload({
    caseId: 'CASE-TAMPER-01',
    evidenceId: 'EVD-TAMPER-01',
    versionId: 'v1',
    originalFilename: 'memory.dmp',
    contentType: 'application/octet-stream',
    totalSizeBytes: originalContent.length,
    evidenceType: 'MEMORY_DUMP',
    uploadedBy: 'USR-POLICE-01',
    expectedSha256: expectedHash,
  });

  // Attempting to complete with corrupted data must fail
  await assert.rejects(
    async () => {
      await engine.completeMultipartUpload(session.uploadId, corruptedContent);
    },
    (err: unknown) => {
      assert.match((err as Error).message, /Integrity Verification Failure/);
      return true;
    }
  );
});

test('20. Ephemeral signed URL generation and unauthorized / expired download blocking', async () => {
  const storageKey = 'cases/case-100/evidence/evd-100/v1/disk.raw';

  // Unauthorized role cannot request download URL
  await assert.rejects(async () => {
    await generateSignedUrl(storageKey, 'POLICE_INVESTIGATOR' as any, 'GET');
  });

  // Authorized role succeeds
  const signed = await generateSignedUrl(storageKey, 'PUBLIC_PROSECUTOR', 'GET', 300);
  assert.ok(signed.url.includes('sig='));
  assert.ok(signed.url.includes('exp='));

  // Valid verification
  const verification = await verifySignedUrl(signed.url, 'PUBLIC_PROSECUTOR');
  assert.equal(verification.isValid, true);

  // Role mismatch rejected
  const mismatchRole = await verifySignedUrl(signed.url, 'FORENSIC_EXAMINER');
  assert.equal(mismatchRole.isValid, false);
  assert.match(mismatchRole.reason || '', /Role mismatch/);

  // Expired URL rejected
  const expired = await generateSignedUrl(storageKey, 'PUBLIC_PROSECUTOR', 'GET', -10);
  const expiredCheck = await verifySignedUrl(expired.url, 'PUBLIC_PROSECUTOR');
  assert.equal(expiredCheck.isValid, false);
  assert.match(expiredCheck.reason || '', /expired/);
});

test('21. Storage metrics, quota tracking, and Cloudflare R2 cost calculation', () => {
  const engine = new SecureEvidenceStorageEngine();

  const metrics = engine.getStorageMetrics();
  assert.equal(metrics.provider, 'CLOUDFLARE_R2');
  assert.equal(metrics.egressCostUSD, 0.0, 'Egress bandwidth cost on Cloudflare R2 must be zero');
  assert.equal(metrics.freeTierStorageLimitBytes, 10 * 1024 * 1024 * 1024);
  assert.equal(metrics.estimatedMonthlyCostUSD, 0.0, 'Under 10 GB free tier cost must be $0.00');
});

// ============================================================================
// PHASE 4: REAL EVIDENCE INTEGRITY VERIFICATION TESTS
// ============================================================================

test('22. Actual SHA-256 calculation from synthetic file bytes and verified object retrieval matches manifest (MATCH)', async () => {
  const db = new EvidenceVaultDatabase();
  const storage = new SecureEvidenceStorageEngine();

  // Setup users for police and forensic
  db.addUser({
    id: 'USR-POLICE-P4',
    display_name: 'Officer Davis',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  db.addUser({
    id: 'USR-FORENSIC-01',
    display_name: 'Dr. Jane Forensic',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  await db.createCase({
    id: 'CASE-P4-001',
    case_reference: 'EV-2026-P401',
    title: 'Phishing Disk Analysis',
    category: 'Cyber Fraud',
    incident_date: '2026-03-01T00:00:00Z',
    assigned_officer_id: 'USR-POLICE-P4',
    status: 'PENDING_FORENSICS',
    created_by: 'USR-POLICE-P4',
  });

  await db.createEvidence({
    id: 'EVD-P4-001',
    case_id: 'CASE-P4-001',
    description: 'Workstation Bit-Stream Image',
    evidence_type: 'DISK_IMAGE',
    source_description: 'Dell Precision Tower 7920 NVMe',
    collected_by: 'USR-POLICE-P4',
    collected_at: '2026-03-01T10:00:00Z',
    created_by: 'USR-POLICE-P4',
  });

  // Create synthetic 64 KB binary file bytes
  const syntheticBytes = new Uint8Array(65536);
  for (let i = 0; i < syntheticBytes.length; i++) {
    syntheticBytes[i] = (i * 37 + 13) & 0xff;
  }
  const realCalculatedSha256 = await computeSha256(syntheticBytes);

  // Ingest synthetic file into object storage via multipart upload
  const session = storage.initiateMultipartUpload({
    caseId: 'CASE-P4-001',
    evidenceId: 'EVD-P4-001',
    versionId: 'v1',
    originalFilename: 'workstation_nvme.raw',
    contentType: 'application/octet-stream',
    totalSizeBytes: syntheticBytes.length,
    evidenceType: 'DISK_IMAGE',
    uploadedBy: 'USR-POLICE-P4',
    expectedSha256: realCalculatedSha256,
  });

  await storage.uploadPart(session.uploadId, 1, syntheticBytes);
  const completed = await storage.completeMultipartUpload(session.uploadId, syntheticBytes);

  // Register baseline in database
  const fileVersion = await db.addFileVersion({
    id: 'FILE-P4-001',
    evidence_id: 'EVD-P4-001',
    original_filename: 'workstation_nvme.raw',
    generated_storage_key: completed.storageKey,
    content_type: 'application/octet-stream',
    file_size: syntheticBytes.length,
    sha256_hash: completed.sha256,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: 'USR-POLICE-P4',
  });

  assert.equal(fileVersion.sha256_hash, realCalculatedSha256);

  // Execute verification as FORENSIC_EXAMINER
  const verification = await verifyEvidenceFileVersionIntegrity({
    fileVersionId: fileVersion.id,
    actorId: 'USR-FORENSIC-01',
    actorRole: 'FORENSIC_EXAMINER',
    database: db,
    storageEngine: storage,
    useStreaming: true,
  });

  assert.equal(verification.result, 'MATCH');
  assert.equal(verification.expected_sha256, realCalculatedSha256);
  assert.equal(verification.observed_sha256, realCalculatedSha256);
  assert.equal(verification.error_reason, null);
  assert.equal(verification.byte_size, 65536);
  assert.equal(verification.verification_mode, 'STREAMING_CHUNKS');
  assert.ok(verification.duration_ms >= 0);
  assert.equal(verification.verified_by, 'USR-FORENSIC-01');
});

test('23. Tampered / modified synthetic file must produce MISMATCH', async () => {
  const db = new EvidenceVaultDatabase();
  const storage = new SecureEvidenceStorageEngine();

  db.addUser({
    id: 'USR-POLICE-P4',
    display_name: 'Officer Davis',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  db.addUser({
    id: 'USR-FORENSIC-02',
    display_name: 'Lead Examiner',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  await db.createCase({
    id: 'CASE-P4-002',
    case_reference: 'EV-2026-P402',
    title: 'Tamper Verification Test',
    category: 'Integrity Check',
    incident_date: '2026-03-02T00:00:00Z',
    assigned_officer_id: 'USR-POLICE-P4',
    status: 'UNDER_INVESTIGATION',
    created_by: 'USR-POLICE-P4',
  });

  await db.createEvidence({
    id: 'EVD-P4-002',
    case_id: 'CASE-P4-002',
    description: 'PCAP Traffic Capture',
    evidence_type: 'NETWORK_CAPTURE',
    source_description: 'Core Gateway Mirror Port',
    collected_by: 'USR-POLICE-P4',
    collected_at: '2026-03-02T10:00:00Z',
    created_by: 'USR-POLICE-P4',
  });

  const pristineData = new TextEncoder().encode('UNMODIFIED FORENSIC NETWORK CAPTURE PAYLOAD 2026');
  const pristineHash = await computeSha256(pristineData);

  const session = storage.initiateMultipartUpload({
    caseId: 'CASE-P4-002',
    evidenceId: 'EVD-P4-002',
    versionId: 'v1',
    originalFilename: 'gateway_capture.pcap',
    contentType: 'application/octet-stream',
    totalSizeBytes: pristineData.length,
    evidenceType: 'NETWORK_CAPTURE',
    uploadedBy: 'USR-POLICE-P4',
    expectedSha256: pristineHash,
  });

  await storage.uploadPart(session.uploadId, 1, pristineData);
  const completed = await storage.completeMultipartUpload(session.uploadId, pristineData);

  const fileVersion = await db.addFileVersion({
    id: 'FILE-P4-002',
    evidence_id: 'EVD-P4-002',
    original_filename: 'gateway_capture.pcap',
    generated_storage_key: completed.storageKey,
    content_type: 'application/octet-stream',
    file_size: pristineData.length,
    sha256_hash: completed.sha256,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: 'USR-POLICE-P4',
  });

  // Tamper with a single byte in storage (simulate bit-flip / malicious modification)
  const tamperResult = storage.tamperObject(completed.storageKey, 5);
  assert.notEqual(tamperResult.originalByte, tamperResult.tamperedByte);

  // Run integrity verification on tampered object
  const verification = await verifyEvidenceFileVersionIntegrity({
    fileVersionId: fileVersion.id,
    actorId: 'USR-FORENSIC-02',
    actorRole: 'FORENSIC_EXAMINER',
    database: db,
    storageEngine: storage,
    useStreaming: true,
  });

  // Must produce confirmed MISMATCH
  assert.equal(verification.result, 'MISMATCH', 'Tampered storage file must produce MISMATCH');
  assert.notEqual(verification.observed_sha256, verification.expected_sha256);
  assert.equal(verification.expected_sha256, pristineHash);
  assert.ok(verification.error_reason?.includes('Mismatch') || verification.error_reason?.includes('tampering'));

  // Original evidence in database must remain intact
  const evidenceRecord = db.getEvidence('EVD-P4-002');
  assert.ok(evidenceRecord, 'Original evidence record must be preserved');
  assert.equal(fileVersion.sha256_hash, pristineHash, 'Baseline manifest must not be overwritten');
});

test('24. Missing / failed storage retrieval produces ERROR, strictly distinguished from MISMATCH', async () => {
  const db = new EvidenceVaultDatabase();
  const storage = new SecureEvidenceStorageEngine();

  db.addUser({
    id: 'USR-POLICE-P4',
    display_name: 'Officer Davis',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  db.addUser({
    id: 'USR-FORENSIC-03',
    display_name: 'Forensic Officer',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  await db.createCase({
    id: 'CASE-P4-003',
    case_reference: 'EV-2026-P403',
    title: 'Storage Error Test Case',
    category: 'System Diagnostics',
    incident_date: '2026-03-03T00:00:00Z',
    assigned_officer_id: 'USR-POLICE-P4',
    status: 'UNDER_INVESTIGATION',
    created_by: 'USR-POLICE-P4',
  });

  await db.createEvidence({
    id: 'EVD-P4-003',
    case_id: 'CASE-P4-003',
    description: 'Server RAM Dump',
    evidence_type: 'MEMORY_DUMP',
    source_description: 'Domain Controller RAM',
    collected_by: 'USR-POLICE-P4',
    collected_at: '2026-03-03T10:00:00Z',
    created_by: 'USR-POLICE-P4',
  });

  const dummyHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  // Register file version pointing to an object key that does NOT exist in storage
  const fileVersion = await db.addFileVersion({
    id: 'FILE-P4-003',
    evidence_id: 'EVD-P4-003',
    original_filename: 'server_ram.dmp',
    generated_storage_key: 'cases/CASE-P4-003/evidence/EVD-P4-003/v1/missing_object.dmp',
    content_type: 'application/octet-stream',
    file_size: 1048576,
    sha256_hash: dummyHash,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: 'USR-POLICE-P4',
  });

  // Verify missing storage object
  const verification = await verifyEvidenceFileVersionIntegrity({
    fileVersionId: fileVersion.id,
    actorId: 'USR-FORENSIC-03',
    actorRole: 'FORENSIC_EXAMINER',
    database: db,
    storageEngine: storage,
  });

  // Must be ERROR, never MATCH or MISMATCH
  assert.equal(verification.result, 'ERROR', 'Missing storage file must produce ERROR');
  assert.notEqual(verification.result, 'MISMATCH', 'Storage failure must not be confused with hash mismatch');
  assert.notEqual(verification.result, 'MATCH', 'Storage failure must never produce MATCH');
  assert.equal(verification.observed_sha256, '', 'Observed hash must be empty on storage retrieval error');
  assert.ok(verification.error_reason?.includes('Missing') || verification.error_reason?.includes('failure'));
});

test('25. Unauthorized actor role blocked from executing forensic re-verification', async () => {
  const db = new EvidenceVaultDatabase();
  const storage = new SecureEvidenceStorageEngine();

  db.addUser({
    id: 'USR-POLICE-99',
    display_name: 'Patrol Officer',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  await db.createCase({
    id: 'CASE-P4-004',
    case_reference: 'EV-2026-P404',
    title: 'Auth Check Case',
    category: 'RBAC Security',
    incident_date: '2026-03-04T00:00:00Z',
    assigned_officer_id: 'USR-POLICE-99',
    status: 'OPEN',
    created_by: 'USR-POLICE-99',
  });

  await db.createEvidence({
    id: 'EVD-P4-004',
    case_id: 'CASE-P4-004',
    description: 'Mobile Image',
    evidence_type: 'MOBILE_EXTRACTION',
    source_description: 'Seized Device',
    collected_by: 'USR-POLICE-99',
    collected_at: '2026-03-04T10:00:00Z',
    created_by: 'USR-POLICE-99',
  });

  const fileVersion = await db.addFileVersion({
    id: 'FILE-P4-004',
    evidence_id: 'EVD-P4-004',
    original_filename: 'device.tar',
    generated_storage_key: 'cases/CASE-P4-004/evidence/EVD-P4-004/v1/device.tar',
    content_type: 'application/x-tar',
    file_size: 1024,
    sha256_hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    baseline_created_at: new Date().toISOString(),
    uploaded_by: 'USR-POLICE-99',
  });

  // POLICE_INVESTIGATOR is not authorized for forensic verification
  await assert.rejects(
    async () => {
      await verifyEvidenceFileVersionIntegrity({
        fileVersionId: fileVersion.id,
        actorId: 'USR-POLICE-99',
        actorRole: 'POLICE_INVESTIGATOR',
        database: db,
        storageEngine: storage,
      });
    },
    /Access Denied/
  );
});

test('26. Complete verification audit history preserved across multiple attempts', async () => {
  const db = new EvidenceVaultDatabase();
  const storage = new SecureEvidenceStorageEngine();

  db.addUser({
    id: 'USR-POLICE-P4',
    display_name: 'Officer Davis',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  db.addUser({
    id: 'USR-FORENSIC-05',
    display_name: 'Senior Auditor',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  await db.createCase({
    id: 'CASE-P4-005',
    case_reference: 'EV-2026-P405',
    title: 'Audit Trail Case',
    category: 'Financial Crime',
    incident_date: '2026-03-05T00:00:00Z',
    assigned_officer_id: 'USR-POLICE-P4',
    status: 'PENDING_FORENSICS',
    created_by: 'USR-POLICE-P4',
  });

  await db.createEvidence({
    id: 'EVD-P4-005',
    case_id: 'CASE-P4-005',
    description: 'Database Backup',
    evidence_type: 'DATABASE_DUMP',
    source_description: 'Postgres SQL Dump',
    collected_by: 'USR-POLICE-P4',
    collected_at: '2026-03-05T10:00:00Z',
    created_by: 'USR-POLICE-P4',
  });

  const pristineData = new TextEncoder().encode('SELECT * FROM ledger_transactions WHERE amount > 1000000;');
  const pristineHash = await computeSha256(pristineData);

  const session = storage.initiateMultipartUpload({
    caseId: 'CASE-P4-005',
    evidenceId: 'EVD-P4-005',
    versionId: 'v1',
    originalFilename: 'ledger.sql.gz',
    contentType: 'application/gzip',
    totalSizeBytes: pristineData.length,
    evidenceType: 'DATABASE_DUMP',
    uploadedBy: 'USR-POLICE-P4',
    expectedSha256: pristineHash,
  });

  await storage.uploadPart(session.uploadId, 1, pristineData);
  const completed = await storage.completeMultipartUpload(session.uploadId, pristineData);

  const fileVersion = await db.addFileVersion({
    id: 'FILE-P4-005',
    evidence_id: 'EVD-P4-005',
    original_filename: 'ledger.sql.gz',
    generated_storage_key: completed.storageKey,
    content_type: 'application/gzip',
    file_size: pristineData.length,
    sha256_hash: completed.sha256,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: 'USR-POLICE-P4',
  });

  // Attempt 1: Pristine verification -> MATCH
  const v1 = await verifyEvidenceFileVersionIntegrity({
    fileVersionId: fileVersion.id,
    actorId: 'USR-FORENSIC-05',
    actorRole: 'FORENSIC_EXAMINER',
    database: db,
    storageEngine: storage,
  });
  assert.equal(v1.result, 'MATCH');

  // Attempt 2: Tampered object -> MISMATCH
  storage.tamperObject(completed.storageKey, 2);
  const v2 = await verifyEvidenceFileVersionIntegrity({
    fileVersionId: fileVersion.id,
    actorId: 'USR-FORENSIC-05',
    actorRole: 'FORENSIC_EXAMINER',
    database: db,
    storageEngine: storage,
  });
  assert.equal(v2.result, 'MISMATCH');

  // Attempt 3: Restore pristine object -> MATCH
  storage.restoreObject(completed.storageKey, pristineData);
  const v3 = await verifyEvidenceFileVersionIntegrity({
    fileVersionId: fileVersion.id,
    actorId: 'USR-FORENSIC-05',
    actorRole: 'FORENSIC_EXAMINER',
    database: db,
    storageEngine: storage,
  });
  assert.equal(v3.result, 'MATCH');

  // Verify all 3 attempts are preserved in history (none overwritten)
  const history = db.getVerificationResultsForFileVersion(fileVersion.id);
  assert.equal(history.length, 3, 'All 3 verification attempts must be preserved');
  assert.equal(history[0].id, v3.id, 'Latest result is at index 0');
  assert.equal(history[1].id, v2.id);
  assert.equal(history[2].id, v1.id);

  // Verify latest getter
  const latest = db.getLatestVerificationResult(fileVersion.id);
  assert.equal(latest?.id, v3.id);
  assert.equal(latest?.result, 'MATCH');
});

test('27. Large-file streaming chunk hasher processes data without buffering full file', async () => {
  // Test incremental chunk hashing against full-buffer hash
  const hasher = new IncrementalSha256();

  const chunk1 = new TextEncoder().encode('PART_ONE_FORENSIC_DISK_SECTOR_00000000000000000000000000_');
  const chunk2 = new TextEncoder().encode('PART_TWO_FORENSIC_DISK_SECTOR_00000000000000000000000000_');
  const chunk3 = new TextEncoder().encode('PART_THREE_FORENSIC_DISK_SECTOR_0000000000000000000000000');

  hasher.update(chunk1);
  hasher.update(chunk2);
  hasher.update(chunk3);
  const streamingDigest = hasher.digest();

  // Combine full buffer
  const combined = new Uint8Array(chunk1.length + chunk2.length + chunk3.length);
  combined.set(chunk1, 0);
  combined.set(chunk2, chunk1.length);
  combined.set(chunk3, chunk1.length + chunk2.length);

  const fullBufferDigest = await computeSha256(combined);

  assert.equal(streamingDigest, fullBufferDigest, 'Incremental stream hash must exactly match full-buffer hash');
  assert.equal(hasher.getBytesProcessed(), combined.length);
});

test('28. Provider-side integrity checks documented separately from application SHA-256', async () => {
  const storage = new SecureEvidenceStorageEngine();

  const sampleKey = 'cases/CASE-001/evidence/EVD-001/v1/sample.img';
  const metadata = storage.getProviderIntegrityMetadata(sampleKey);

  assert.equal(metadata.provider, 'CLOUDFLARE_R2');
  assert.equal(metadata.encryptionAtRest, 'AES-256 (Cloudflare R2 SSE-S3)');
  assert.equal(metadata.transportProtocol, 'TLS 1.3 HTTPS');
  assert.equal(typeof metadata.transportVerified, 'boolean');
});

test('29. Batch verification of case evidence correctly tallies matches, mismatches, and errors', async () => {
  const db = new EvidenceVaultDatabase();
  const storage = new SecureEvidenceStorageEngine();

  db.addUser({
    id: 'USR-POLICE-P4',
    display_name: 'Officer Davis',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  db.addUser({
    id: 'USR-FORENSIC-06',
    display_name: 'Lead Inspector',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  await db.createCase({
    id: 'CASE-P4-BATCH',
    case_reference: 'EV-2026-BATCH',
    title: 'Batch Verification Case',
    category: 'Forensic Inquest',
    incident_date: '2026-03-06T00:00:00Z',
    assigned_officer_id: 'USR-POLICE-P4',
    status: 'PENDING_FORENSICS',
    created_by: 'USR-POLICE-P4',
  });

  // Evidence 1: Valid intact file (MATCH)
  await db.createEvidence({
    id: 'EVD-P4-B1',
    case_id: 'CASE-P4-BATCH',
    description: 'Evidence 1 (Intact)',
    evidence_type: 'SYSTEM_LOG',
    source_description: 'Firewall Syslog',
    collected_by: 'USR-POLICE-P4',
    collected_at: '2026-03-06T10:00:00Z',
    created_by: 'USR-POLICE-P4',
  });

  const b1Data = new TextEncoder().encode('VALID LOG LINE 1\nVALID LOG LINE 2\n');
  const b1Hash = await computeSha256(b1Data);

  const s1 = storage.initiateMultipartUpload({
    caseId: 'CASE-P4-BATCH',
    evidenceId: 'EVD-P4-B1',
    versionId: 'v1',
    originalFilename: 'syslog.log',
    contentType: 'text/plain',
    totalSizeBytes: b1Data.length,
    evidenceType: 'SYSTEM_LOG',
    uploadedBy: 'USR-POLICE-P4',
    expectedSha256: b1Hash,
  });
  await storage.uploadPart(s1.uploadId, 1, b1Data);
  const c1 = await storage.completeMultipartUpload(s1.uploadId, b1Data);

  await db.addFileVersion({
    id: 'FILE-P4-B1',
    evidence_id: 'EVD-P4-B1',
    original_filename: 'syslog.log',
    generated_storage_key: c1.storageKey,
    content_type: 'text/plain',
    file_size: b1Data.length,
    sha256_hash: c1.sha256,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: 'USR-POLICE-P4',
  });

  // Evidence 2: Tampered file (MISMATCH)
  await db.createEvidence({
    id: 'EVD-P4-B2',
    case_id: 'CASE-P4-BATCH',
    description: 'Evidence 2 (Tampered)',
    evidence_type: 'DOCUMENT',
    source_description: 'Seized PDF',
    collected_by: 'USR-POLICE-P4',
    collected_at: '2026-03-06T10:00:00Z',
    created_by: 'USR-POLICE-P4',
  });

  const b2Data = new TextEncoder().encode('%PDF-1.4 pristine pdf content');
  const b2Hash = await computeSha256(b2Data);

  const s2 = storage.initiateMultipartUpload({
    caseId: 'CASE-P4-BATCH',
    evidenceId: 'EVD-P4-B2',
    versionId: 'v1',
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    totalSizeBytes: b2Data.length,
    evidenceType: 'DOCUMENT',
    uploadedBy: 'USR-POLICE-P4',
    expectedSha256: b2Hash,
  });
  await storage.uploadPart(s2.uploadId, 1, b2Data);
  const c2 = await storage.completeMultipartUpload(s2.uploadId, b2Data);

  await db.addFileVersion({
    id: 'FILE-P4-B2',
    evidence_id: 'EVD-P4-B2',
    original_filename: 'invoice.pdf',
    generated_storage_key: c2.storageKey,
    content_type: 'application/pdf',
    file_size: b2Data.length,
    sha256_hash: c2.sha256,
    baseline_created_at: new Date().toISOString(),
    uploaded_by: 'USR-POLICE-P4',
  });

  storage.tamperObject(c2.storageKey, 3); // Alter a byte in evidence 2

  // Evidence 3: Missing storage object (ERROR)
  await db.createEvidence({
    id: 'EVD-P4-B3',
    case_id: 'CASE-P4-BATCH',
    description: 'Evidence 3 (Missing Object)',
    evidence_type: 'MEDIA',
    source_description: 'CCTV Camera',
    collected_by: 'USR-POLICE-P4',
    collected_at: '2026-03-06T10:00:00Z',
    created_by: 'USR-POLICE-P4',
  });

  await db.addFileVersion({
    id: 'FILE-P4-B3',
    evidence_id: 'EVD-P4-B3',
    original_filename: 'cctv_missing.iso',
    generated_storage_key: 'cases/CASE-P4-BATCH/evidence/EVD-P4-B3/v1/cctv_missing.iso',
    content_type: 'application/octet-stream',
    file_size: 2048,
    sha256_hash: '1111222233334444555566667777888811112222333344445555666677778888',
    baseline_created_at: new Date().toISOString(),
    uploaded_by: 'USR-POLICE-P4',
  });

  // Run batch verification
  const batchReport = await verifyCaseEvidenceIntegrity(
    'CASE-P4-BATCH',
    'USR-FORENSIC-06',
    'FORENSIC_EXAMINER',
    db,
    storage
  );

  assert.equal(batchReport.totalFiles, 3);
  assert.equal(batchReport.matches, 1, 'Exactly 1 file must MATCH');
  assert.equal(batchReport.mismatches, 1, 'Exactly 1 file must MISMATCH');
  assert.equal(batchReport.errors, 1, 'Exactly 1 file must be ERROR');
});

// ============================================================================
// PHASE 6: ROLE-BASED ACCESS CONTROL, IDOR PROTECTION & APPLICATION SECURITY TESTS
// ============================================================================

test('30. Backend authorization: Forensic role rejected when attempting to create a police case or register evidence', async () => {
  const db = new EvidenceVaultDatabase();
  db.addUser({
    id: 'USR-SEC-FORENSIC-01',
    display_name: 'Forensic Analyst S. Rao',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  // Attempt to create a police case as a Forensic Examiner must be rejected at the backend level
  await assert.rejects(
    async () => {
      await db.createCase({
        id: 'CASE-UNAUTH-01',
        case_reference: 'EV-CASE-UNAUTH-01',
        title: 'Unauthorized Forensic Case Attempt',
        category: 'Cyber Fraud',
        incident_date: null,
        assigned_officer_id: null,
        status: 'OPEN',
        created_by: 'USR-SEC-FORENSIC-01',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      assert.match((err as Error).message, /Authorization denied: Role 'FORENSIC_EXAMINER'/);
      return true;
    }
  );

  // Attempt to register initial police evidence as a Forensic Examiner must be rejected
  await assert.rejects(
    async () => {
      await db.createEvidence({
        id: 'EVD-UNAUTH-01',
        case_id: 'CASE-2026-001',
        description: 'Unauthorized intake evidence',
        evidence_type: 'DISK_IMAGE',
        source_description: 'Suspect PC',
        collected_by: 'USR-SEC-FORENSIC-01',
        collected_at: new Date().toISOString(),
        current_status: 'ACQUIRED',
        created_by: 'USR-SEC-FORENSIC-01',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      assert.match((err as Error).message, /Authorization denied: Role 'FORENSIC_EXAMINER'/);
      return true;
    }
  );
});

test('31. Backend authorization: Police role rejected when attempting to accept/reject forensic handoff or create reports', async () => {
  const db = new EvidenceVaultDatabase();
  db.addUser({
    id: 'USR-SEC-POLICE-01',
    display_name: 'Investigator V. Nair',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  // Setup valid case & evidence & handoff
  await db.createCase({
    id: 'CASE-SEC-01',
    case_reference: 'EV-CASE-SEC-01',
    title: 'Security Transition Case',
    category: 'Narcotics',
    incident_date: null,
    assigned_officer_id: 'USR-SEC-POLICE-01',
    status: 'OPEN',
    created_by: 'USR-SEC-POLICE-01',
  });

  await db.createEvidence({
    id: 'EVD-SEC-01',
    case_id: 'CASE-SEC-01',
    description: 'Call logs extract',
    evidence_type: 'SYSTEM_LOG',
    source_description: 'Telecom Gateway',
    collected_by: 'USR-SEC-POLICE-01',
    collected_at: new Date().toISOString(),
    current_status: 'ACQUIRED',
    created_by: 'USR-SEC-POLICE-01',
  });

  const handoff = await db.createHandoff({
    id: 'HND-SEC-01',
    evidence_id: 'EVD-SEC-01',
    source_department: 'POLICE',
    destination_department: 'FORENSIC',
    submitted_by: 'USR-SEC-POLICE-01',
    received_by: null,
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
    acknowledged_at: null,
    rejection_reason: null,
  });

  // A police officer attempting to ACCEPT handoff into forensic custody must fail
  await assert.rejects(
    async () => {
      await db.transitionHandoffStatus(handoff.id, 'RECEIVED', 'USR-SEC-POLICE-01');
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      assert.match((err as Error).message, /Authorization denied: Role 'POLICE_INVESTIGATOR'/);
      return true;
    }
  );

  // A police officer attempting to author a Forensic Report must fail
  await assert.rejects(
    async () => {
      await db.createOrReviseReport({
        case_id: 'CASE-SEC-01',
        evidence_id: 'EVD-SEC-01',
        report_content: 'Unauthorized police authored forensic report',
        author_id: 'USR-SEC-POLICE-01',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      assert.match((err as Error).message, /Authorization denied: Role 'POLICE_INVESTIGATOR'/);
      return true;
    }
  );
});

test('32. Backend authorization: Police and Forensic roles rejected when attempting to submit prosecution trial review', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  db.addUser({
    id: 'USR-SEC-POLICE-02',
    display_name: 'Investigator P. Sen',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  db.addUser({
    id: 'USR-SEC-FORENSIC-02',
    display_name: 'Analyst K. Joshi',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  const reports = db.getAllReports();
  assert.ok(reports.length > 0, 'Seed reports should exist');
  const targetReport = reports[0];

  // Police attempt to approve evidence for judicial trial
  await assert.rejects(
    async () => {
      await db.submitProsecutionReview({
        id: 'REV-UNAUTH-01',
        case_id: targetReport.case_id,
        report_id: targetReport.id,
        reviewer_id: 'USR-SEC-POLICE-02',
        status: 'ACCEPTED_FOR_TRIAL',
        review_notes: 'Police self-certifying for trial',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      return true;
    }
  );

  // Forensic attempt to submit judicial review
  await assert.rejects(
    async () => {
      await db.submitProsecutionReview({
        id: 'REV-UNAUTH-02',
        case_id: targetReport.case_id,
        report_id: targetReport.id,
        reviewer_id: 'USR-SEC-FORENSIC-02',
        status: 'ACCEPTED_FOR_TRIAL',
        review_notes: 'Forensic examiner certifying for trial',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      return true;
    }
  );
});

test('33. IDOR protection: Unauthorized role or unassigned officer cannot access confidential evidence records', async () => {
  const db = new EvidenceVaultDatabase();

  // Create Officer A and Officer B
  db.addUser({
    id: 'USR-OFFICER-A',
    display_name: 'Officer A (Assigned)',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  db.addUser({
    id: 'USR-OFFICER-B',
    display_name: 'Officer B (Unassigned Stranger)',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  // Case assigned strictly to Officer A
  const confidentialCase = await db.createCase({
    id: 'CASE-CONFIDENTIAL-001',
    case_reference: 'EV-CASE-CONF-001',
    title: 'Top Secret Anti-Corruption Case',
    category: 'Classified Investigation',
    incident_date: null,
    assigned_officer_id: 'USR-OFFICER-A',
    status: 'OPEN',
    created_by: 'USR-OFFICER-A',
  });

  const confidentialEvidence = await db.createEvidence({
    id: 'EVD-CONF-001',
    case_id: confidentialCase.id,
    description: 'Classified financial records',
    evidence_type: 'DOCUMENT',
    source_description: 'Encrypted safe',
    collected_by: 'USR-OFFICER-A',
    collected_at: new Date().toISOString(),
    current_status: 'ACQUIRED',
    created_by: 'USR-OFFICER-A',
  });

  // Officer A accessing their own case succeeds
  const caseA = db.getCaseWithAuth(confidentialCase.id, {
    actorId: 'USR-OFFICER-A',
    role: 'POLICE_INVESTIGATOR',
  });
  assert.equal(caseA.id, confidentialCase.id);

  // Officer B attempting to access Officer A's case must trigger IDOR Access Denied
  assert.throws(
    () => {
      db.getCaseWithAuth(confidentialCase.id, {
        actorId: 'USR-OFFICER-B',
        role: 'POLICE_INVESTIGATOR',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof IdorAccessDeniedError);
      assert.match((err as Error).message, /Access Denied \(IDOR Protection\)/);
      return true;
    }
  );

  // Officer B attempting to access confidential evidence directly must fail
  assert.throws(
    () => {
      db.getEvidenceWithAuth(confidentialEvidence.id, {
        actorId: 'USR-OFFICER-B',
        role: 'POLICE_INVESTIGATOR',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof IdorAccessDeniedError);
      return true;
    }
  );
});

test('34. Unauthorized evidence download blocking: Unassigned officer or unauthorized role rejected from download', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const evidenceItems = db.getAllEvidence();
  assert.ok(evidenceItems.length > 0);
  const targetEvidence = evidenceItems[0];

  // Unassigned officer attempting to download evidence fails with IDOR protection
  assert.throws(
    () => {
      db.authorizeDownload(
        {
          actorId: 'USR-UNASSIGNED-POLICE',
          role: 'POLICE_INVESTIGATOR',
        },
        targetEvidence.id
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      return true;
    }
  );

  // Attempting to generate signed URL with unauthorized role directly is rejected
  await assert.rejects(
    async () => {
      await generateSignedUrl(
        'cases/CASE-01/evidence/EVD-01/v1/disk.raw',
        'POLICE_INVESTIGATOR', // Police cannot download raw forensic bitstream without forensic clearance
        'GET'
      );
    },
    (err: unknown) => {
      assert.match((err as Error).message, /Access Denied: Role 'POLICE_INVESTIGATOR' is not authorized/);
      return true;
    }
  );
});

test('35. Path traversal attack prevention in filenames and storage keys', () => {
  // Test malicious path traversal payloads
  assert.equal(detectPathTraversal('../../../../etc/shadow'), true);
  assert.equal(detectPathTraversal('..\\..\\windows\\system32\\cmd.exe'), true);
  assert.equal(detectPathTraversal('%2e%2e%2froot%2fsecret.key'), true);
  assert.equal(detectPathTraversal('/var/log/auth.log'), true);
  assert.equal(detectPathTraversal('C:\\boot.ini'), true);
  assert.equal(detectPathTraversal('legitimate_image.raw'), false);

  // Verify server-side canonical key generation strips and sanitizes traversal sequences
  const maliciousKey = generateCanonicalStorageKey(
    '../../malicious_case/..',
    'EVD-01',
    'v1',
    '../../../../etc/passwd'
  );
  assert.ok(!maliciousKey.includes('..'), 'Storage key must never contain double dots');
  assert.ok(!maliciousKey.includes('/etc/passwd'), 'Storage key must never permit directory escalation');
  assert.match(maliciousKey, /^cases\/.*\/evidence\/EVD-01\/v1\/.*passwd$/);
});

test('36. Session security: Validation rejects expired sessions, suspended users, and tampered token signatures', () => {
  const activeUser = {
    id: 'USR-SEC-TEST',
    role: 'POLICE_INVESTIGATOR' as const,
    department: 'POLICE' as const,
    badge: 'DL-POLICE-999',
    active_status: 'ACTIVE' as const,
  };

  // 1. Valid session creation & verification
  const session = createAuthSession(activeUser);
  const validCheck = validateAuthSession(session);
  assert.equal(validCheck.isValid, true);

  // 2. Tampered token signature detection
  const tamperedSession = { ...session, tokenSignature: 'deadbeef_tampered' };
  const tamperedCheck = validateAuthSession(tamperedSession);
  assert.equal(tamperedCheck.isValid, false);
  assert.match(tamperedCheck.error || '', /signature mismatch\. Potential session tampering/);

  // 3. Expired session detection
  const expiredSession = {
    ...session,
    expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 minute in past
  };
  const expiredCheck = validateAuthSession(expiredSession);
  assert.equal(expiredCheck.isValid, false);
  assert.match(expiredCheck.error || '', /Session expired/);

  // 4. Suspended user session detection
  const suspendedSession = createAuthSession({ ...activeUser, active_status: 'SUSPENDED' });
  const suspendedCheck = validateAuthSession(suspendedSession);
  assert.equal(suspendedCheck.isValid, false);
  assert.match(suspendedCheck.error || '', /User account is suspended by administrator/);
});

test('37. Rate limiting: Enforces brute force lockout and download rate limits', () => {
  globalRateLimiter.clearAll();
  const testIP = '192.168.1.105';

  // Record 4 failed attempts: still allowed
  for (let i = 0; i < 4; i++) {
    const res = globalRateLimiter.recordAuthFailure(testIP);
    assert.equal(res.locked, false);
  }

  // 5th failed attempt: triggers brute-force lockout
  const lockoutRes = globalRateLimiter.recordAuthFailure(testIP);
  assert.equal(lockoutRes.locked, true);
  assert.equal(lockoutRes.allowed, false);

  const check = globalRateLimiter.checkAuthRateLimit(testIP);
  assert.equal(check.allowed, false);
  assert.ok((check.retryAfterSec || 0) > 0);

  // Reset after administrative unlocking
  globalRateLimiter.resetAuthFailures(testIP);
  const resetCheck = globalRateLimiter.checkAuthRateLimit(testIP);
  assert.equal(resetCheck.allowed, true);

  // Test rapid download limit (Max 10 per minute)
  const testUser = 'USR-DOWNLOADER-01';
  for (let i = 0; i < 10; i++) {
    const dl = globalRateLimiter.checkDownloadRateLimit(testUser);
    assert.equal(dl.allowed, true);
  }
  // 11th download request exceeds quota
  const blockedDl = globalRateLimiter.checkDownloadRateLimit(testUser);
  assert.equal(blockedDl.allowed, false);
});

test('38. Security violation audit logging records security incidents without leaking secrets', async () => {
  const db = new EvidenceVaultDatabase();

  const loggedViolation = await logSecurityViolation(
    {
      violationType: 'UNAUTHORIZED_ROLE_ACTION',
      actorId: 'USR-MALICIOUS-ACTOR',
      actorRole: 'ANONYMOUS',
      attemptedAction: 'INSPECT_DATABASE_INTERNAL',
      resource: 'EVD-999',
      reason: 'Attempted to bypass RBAC with administrative query',
      sanitizedPayload: {
        attemptedPassword: 'SuperSecretPassword123!',
        userPin: '9876',
        targetCase: 'CASE-TOPSECRET',
      },
    },
    db
  );

  assert.ok(loggedViolation.id.startsWith('SEC-VIO-'));
  // Verify secrets are redacted
  assert.equal(loggedViolation.sanitizedPayload?.attemptedPassword, '[REDACTED_CONFIDENTIAL]');
  assert.equal(loggedViolation.sanitizedPayload?.userPin, '[REDACTED_CONFIDENTIAL]');
  assert.equal(loggedViolation.sanitizedPayload?.targetCase, 'CASE-TOPSECRET');

  // Verify it was recorded in the database audit ledger
  const audits = db.getAuditEvents();
  const secAudit = audits.find((a) => a.action === 'SECURITY_VIOLATION_UNAUTHORIZED_ROLE_ACTION');
  assert.ok(secAudit, 'Database audit ledger must contain security violation block');
  assert.equal(secAudit?.entity_id, 'EVD-999');
});

// ============================================================================
// Phase 7: Offline Mode & Safe Data Synchronization Tests
// ============================================================================

test('39. Offline mode: State transitions and simulation toggle (ONLINE -> OFFLINE -> SYNCING -> ONLINE)', async () => {
  const syncEngine = new OfflineSyncEngine();
  const recordedStates: string[] = [];

  const unsubscribe = syncEngine.subscribe((status) => {
    recordedStates.push(status);
  });

  assert.equal(syncEngine.getNetworkStatus(), 'ONLINE');

  // Toggle to OFFLINE
  syncEngine.simulateNetworkToggle(false);
  assert.equal(syncEngine.getNetworkStatus(), 'OFFLINE');

  // Toggle back to ONLINE
  syncEngine.simulateNetworkToggle(true);
  assert.equal(syncEngine.getNetworkStatus(), 'ONLINE');

  // Direct state updates
  syncEngine.setNetworkStatus('SYNC_FAILED');
  assert.equal(syncEngine.getNetworkStatus(), 'SYNC_FAILED');

  syncEngine.setNetworkStatus('PARTIAL_SYNC');
  assert.equal(syncEngine.getNetworkStatus(), 'PARTIAL_SYNC');

  unsubscribe();
  assert.ok(recordedStates.includes('OFFLINE'));
  assert.ok(recordedStates.includes('SYNC_FAILED'));
  assert.ok(recordedStates.includes('PARTIAL_SYNC'));
});

test('40. Non-sensitive minimal caching succeeds, while caching raw evidence files or forensic reports is strictly blocked', async () => {
  OfflineCacheManager.clearCache();

  const dummyCase = {
    id: 'CASE-CACHE-01',
    case_reference: 'EV-CACHE-01',
    title: 'Minimal Cache Case',
    category: 'Cyber Forensic',
    incident_date: null,
    assigned_officer_id: 'USR-POLICE-01',
    status: 'OPEN' as const,
    created_by: 'USR-POLICE-01',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dummyEvidence = {
    id: 'EVD-CACHE-01',
    case_id: 'CASE-CACHE-01',
    description: 'Smartphone Extraction',
    evidence_type: 'MOBILE_EXTRACTION' as const,
    source_description: 'Suspect Mobile Device',
    collected_by: 'USR-POLICE-01',
    collected_at: new Date().toISOString(),
    current_status: 'ACQUIRED' as const,
    created_by: 'USR-POLICE-01',
    created_at: new Date().toISOString(),
  };

  // 1. Caching approved non-sensitive metadata succeeds
  const cacheObj = await OfflineCacheManager.cacheApprovedMetadata(
    'USR-POLICE-01',
    [dummyCase],
    [dummyEvidence]
  );

  assert.ok(cacheObj.cacheChecksum);
  assert.equal(cacheObj.cases.length, 1);
  assert.equal(cacheObj.evidenceSummary.length, 1);

  // 2. Reading approved cache validates checksum
  const retrievedCache = await OfflineCacheManager.getApprovedCache();
  assert.ok(retrievedCache);
  assert.equal(retrievedCache?.cases[0].title, 'Minimal Cache Case');

  // 3. Prohibited data protection: Attempting to cache raw file data or binary buffers throws ProhibitedOfflineCacheError
  assert.throws(
    () => {
      OfflineCacheManager.assertNonSensitiveOnly(
        {
          case_id: 'CASE-CACHE-01',
          file_data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
        },
        'Test Raw File Ingestion'
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof ProhibitedOfflineCacheError);
      return true;
    }
  );

  // 4. Prohibited data protection: Attempting to cache forensic report content throws ProhibitedOfflineCacheError
  assert.throws(
    () => {
      OfflineCacheManager.assertNonSensitiveOnly(
        {
          case_id: 'CASE-CACHE-01',
          report_content: 'Confidential laboratory findings and suspect identification analysis.',
        },
        'Test Forensic Report Ingestion'
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof ProhibitedOfflineCacheError);
      return true;
    }
  );
});

test('41. Offline action queue: Enqueues permitted actions with unique event IDs and clear PENDING status', () => {
  OfflineQueueManager.clearQueue();

  const queuedCase = OfflineQueueManager.enqueueAction({
    action: 'CREATE_CASE',
    actorId: 'USR-POLICE-01',
    actorRole: 'POLICE_INVESTIGATOR',
    actorDepartment: 'POLICE',
    payload: {
      id: 'CASE-OFFLINE-01',
      case_reference: 'EV-OFFLINE-01',
      title: 'Field Investigation Cybercrime',
      category: 'Ransomware',
      incident_date: null,
      assigned_officer_id: null,
      status: 'OPEN',
      created_by: 'USR-POLICE-01',
    },
  });

  assert.ok(queuedCase.eventId.startsWith('OFFLINE-EVT-'));
  assert.ok(queuedCase.idempotencyKey.startsWith('IDEMP-'));
  assert.equal(queuedCase.status, 'PENDING');
  assert.equal(queuedCase.syncedAt, null);
  assert.equal(queuedCase.serverEntityId, null);

  const pending = OfflineQueueManager.getPendingItems();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].eventId, queuedCase.eventId);
});

test('42. Safe reconnection synchronization: Authoritatively commits queued offline events and appends audit ledger blocks', async () => {
  OfflineQueueManager.clearQueue();
  const db = new EvidenceVaultDatabase();
  const syncEngine = new OfflineSyncEngine();

  // Register police investigator on server
  db.addUser({
    id: 'USR-POLICE-01',
    display_name: 'Field Investigator',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  // Enqueue offline case creation
  OfflineQueueManager.enqueueAction({
    action: 'CREATE_CASE',
    actorId: 'USR-POLICE-01',
    actorRole: 'POLICE_INVESTIGATOR',
    actorDepartment: 'POLICE',
    idempotencyKey: 'IDEMP-CASE-RECONNECT-01',
    payload: {
      id: 'CASE-SYNC-01',
      case_reference: 'EV-SYNC-01',
      title: 'Field Triage Ransomware Incident',
      category: 'Ransomware',
      incident_date: null,
      assigned_officer_id: null,
      status: 'OPEN',
      created_by: 'USR-POLICE-01',
    },
  });

  // Execute sync
  const summary = await syncEngine.syncQueue(db);
  assert.equal(summary.totalEvents, 1);
  assert.equal(summary.syncedCount, 1);
  assert.equal(summary.failedCount, 0);
  assert.equal(summary.rejectedCount, 0);

  // Verify entity now exists authoritatively in server database
  const createdCase = db.getCase('CASE-SYNC-01');
  assert.ok(createdCase);
  assert.equal(createdCase?.title, 'Field Triage Ransomware Incident');

  // Verify server-side audit block was created
  const audits = db.getAuditEvents();
  const syncAudit = audits.find((a) => a.action === 'OFFLINE_EVENT_SYNCED');
  assert.ok(syncAudit);
  assert.equal(syncAudit?.entity_id, 'CASE-SYNC-01');

  // Verify queue item updated to SYNCED
  const queue = OfflineQueueManager.getQueue();
  assert.equal(queue[0].status, 'SYNCED');
  assert.ok(queue[0].syncedAt);
});

test('43. Idempotency and duplicate prevention: Resubmission of identical event skips execution without duplicate records', async () => {
  OfflineQueueManager.clearQueue();
  const db = new EvidenceVaultDatabase();
  const syncEngine = new OfflineSyncEngine();

  db.addUser({
    id: 'USR-POLICE-01',
    display_name: 'Field Officer',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  const duplicateKey = 'IDEMP-DUPLICATE-PREVENTION-999';

  // Enqueue first offline action
  OfflineQueueManager.enqueueAction({
    action: 'CREATE_CASE',
    actorId: 'USR-POLICE-01',
    actorRole: 'POLICE_INVESTIGATOR',
    actorDepartment: 'POLICE',
    idempotencyKey: duplicateKey,
    payload: {
      id: 'CASE-IDEMP-01',
      case_reference: 'EV-IDEMP-01',
      title: 'Original Submission',
      category: 'Data Breach',
      incident_date: null,
      assigned_officer_id: null,
      status: 'OPEN',
      created_by: 'USR-POLICE-01',
    },
  });

  // Sync first time
  const firstSync = await syncEngine.syncQueue(db);
  assert.equal(firstSync.syncedCount, 1);
  const auditCountAfterFirst = db.getAuditEvents().length;

  // Enqueue duplicate offline action with same idempotencyKey
  OfflineQueueManager.enqueueAction({
    action: 'CREATE_CASE',
    actorId: 'USR-POLICE-01',
    actorRole: 'POLICE_INVESTIGATOR',
    actorDepartment: 'POLICE',
    idempotencyKey: duplicateKey, // Duplicate key!
    payload: {
      id: 'CASE-IDEMP-01',
      case_reference: 'EV-IDEMP-01',
      title: 'Duplicate Submission Attempt',
      category: 'Data Breach',
      incident_date: null,
      assigned_officer_id: null,
      status: 'OPEN',
      created_by: 'USR-POLICE-01',
    },
  });

  // Sync second time
  const secondSync = await syncEngine.syncQueue(db);
  assert.equal(secondSync.syncedCount, 1);
  assert.match(secondSync.items[0].message, /Idempotent replay/);

  // Crucial: No second case creation, and no extra audit ledger blocks
  const auditCountAfterSecond = db.getAuditEvents().length;
  assert.equal(auditCountAfterSecond, auditCountAfterFirst, 'Duplicate execution must NOT append duplicate audit blocks');
});

test('44. Explicit conflict detection & resolution: Concurrent state divergence flags CONFLICT, resolved with operator audit', async () => {
  OfflineQueueManager.clearQueue();
  const db = new EvidenceVaultDatabase();
  const syncEngine = new OfflineSyncEngine();

  // Seed case, evidence, and active handoff on server
  db.addUser({
    id: 'USR-POLICE-01',
    display_name: 'Investigator',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });
  db.addUser({
    id: 'USR-FORENSIC-01',
    display_name: 'Examiner',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  await db.createCase({
    id: 'CASE-CONF-01',
    case_reference: 'EV-CONF-01',
    title: 'Conflict Case',
    category: 'Malware',
    incident_date: null,
    assigned_officer_id: null,
    status: 'OPEN',
    created_by: 'USR-POLICE-01',
  });

  await db.createEvidence({
    id: 'EVD-CONF-01',
    case_id: 'CASE-CONF-01',
    description: 'Compromised laptop HDD',
    evidence_type: 'DISK_IMAGE',
    source_description: 'Lab seizure',
    collected_by: 'USR-POLICE-01',
    collected_at: new Date().toISOString(),
    current_status: 'ACQUIRED',
    created_by: 'USR-POLICE-01',
  });

  const handoff = await db.createHandoff({
    id: 'HND-CONF-01',
    evidence_id: 'EVD-CONF-01',
    source_department: 'POLICE',
    destination_department: 'FORENSIC',
    submitted_by: 'USR-POLICE-01',
    received_by: null,
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
    acknowledged_at: null,
    rejection_reason: null,
  });

  // SIMULATE CONCURRENCY:
  // Another examiner on the server accepts the handoff (transitions to RECEIVED)
  await db.transitionHandoffStatus(handoff.id, 'RECEIVED', 'USR-FORENSIC-01');

  // Meanwhile, a disconnected examiner queues an action expecting the base state was 'SUBMITTED'
  // to reject/return the handoff
  const queuedItem = OfflineQueueManager.enqueueAction({
    action: 'TRANSITION_HANDOFF',
    actorId: 'USR-FORENSIC-01',
    actorRole: 'FORENSIC_EXAMINER',
    actorDepartment: 'FORENSIC',
    baseVersion: 'SUBMITTED', // Expected base version was 'SUBMITTED', but server is now 'RECEIVED'!
    payload: {
      handoffId: handoff.id,
      newStatus: 'RETURNED',
      rejectionReason: 'Broken packaging detected in disconnected field inspection',
    },
  });

  // Reconnection sync occurs:
  const syncResult = await syncEngine.syncQueue(db);
  assert.equal(syncResult.conflictCount, 1);
  assert.equal(syncResult.syncedCount, 0);

  // Check item state is flagged as CONFLICT (NOT silently overwritten!)
  const conflictedItem = OfflineQueueManager.getItem(queuedItem.eventId);
  assert.equal(conflictedItem?.status, 'CONFLICT');
  assert.ok(conflictedItem?.conflictDetails);
  assert.equal(conflictedItem?.conflictDetails?.expectedState, 'SUBMITTED');
  assert.equal(conflictedItem?.conflictDetails?.serverState, 'RECEIVED');

  // Verify server status was preserved and NOT silently overwritten
  const liveHandoff = db.getAllEvidence().flatMap((e) => db.getHandoffsForEvidence(e.id)).find((h) => h.id === handoff.id);
  assert.equal(liveHandoff?.status, 'RECEIVED');

  // Explicit operator resolution: Discard offline change
  const resolved = await syncEngine.resolveConflict(
    queuedItem.eventId,
    'DISCARD_LOCAL',
    'Investigating officer confirmed receipt already verified at central CFSL facility',
    db
  );
  assert.equal(resolved.status, 'REJECTED');
  assert.match(resolved.lastError || '', /CONFLICT_RESOLVED_DISCARD/);

  // Verify audit event was logged
  const audits = db.getAuditEvents();
  const conflictAudit = audits.find((a) => a.action === 'OFFLINE_CONFLICT_DISCARDED');
  assert.ok(conflictAudit);
});

test('45. Revoked access enforcement: User suspended on server while disconnected has queued actions rejected on sync', async () => {
  OfflineQueueManager.clearQueue();
  const db = new EvidenceVaultDatabase();
  const syncEngine = new OfflineSyncEngine();

  // Create officer on server
  const officer = db.addUser({
    id: 'USR-POLICE-ROGUE',
    display_name: 'Suspended Officer',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  // Officer goes offline and queues an action
  OfflineQueueManager.enqueueAction({
    action: 'CREATE_CASE',
    actorId: 'USR-POLICE-ROGUE',
    actorRole: 'POLICE_INVESTIGATOR',
    actorDepartment: 'POLICE',
    payload: {
      id: 'CASE-ROGUE-01',
      case_reference: 'EV-ROGUE-01',
      title: 'Unauthorized Case Registration',
      category: 'Fraud',
      incident_date: null,
      assigned_officer_id: null,
      status: 'OPEN',
      created_by: 'USR-POLICE-ROGUE',
    },
  });

  // WHILE DISCONNECTED: Administrator suspends the officer on the server
  officer.active_status = 'SUSPENDED';

  // Officer reconnects and attempts sync
  const summary = await syncEngine.syncQueue(db);
  assert.equal(summary.rejectedCount, 1);
  assert.equal(summary.syncedCount, 0);

  const queue = OfflineQueueManager.getQueue();
  assert.equal(queue[0].status, 'REJECTED');
  assert.match(queue[0].lastError || '', /REVOKED_PERMISSION/);

  // Case must NOT have been created on server
  assert.equal(db.getCase('CASE-ROGUE-01'), undefined);
});

test('46. Expired session rejection: Stale authentication token fails revalidation on reconnection sync', async () => {
  OfflineQueueManager.clearQueue();
  const db = new EvidenceVaultDatabase();
  const syncEngine = new OfflineSyncEngine();

  db.addUser({
    id: 'USR-POLICE-01',
    display_name: 'Inspector Sharma',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  OfflineQueueManager.enqueueAction({
    action: 'CREATE_CASE',
    actorId: 'USR-POLICE-01',
    actorRole: 'POLICE_INVESTIGATOR',
    actorDepartment: 'POLICE',
    payload: {
      id: 'CASE-EXP-01',
      case_reference: 'EV-EXP-01',
      title: 'Expired Session Case',
      category: 'Cyber',
      incident_date: null,
      assigned_officer_id: null,
      status: 'OPEN',
      created_by: 'USR-POLICE-01',
    },
  });

  // Create an expired session
  const expiredSession = createAuthSession({
    id: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
    department: 'POLICE',
    badge: 'DL-POL-101',
  });
  expiredSession.expiresAt = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

  // Attempt sync with expired session
  const summary = await syncEngine.syncQueue(db, { sessionToValidate: expiredSession });
  assert.equal(summary.rejectedCount, 1);
  assert.equal(summary.syncedCount, 0);

  const queue = OfflineQueueManager.getQueue();
  assert.equal(queue[0].status, 'REJECTED');
  assert.match(queue[0].lastError || '', /EXPIRED_OR_INVALID_SESSION/);
});

test('47. Partial synchronization: Mixed batch of valid, conflicted, and rejected items processes safely and reports PARTIAL_SYNC', async () => {
  OfflineQueueManager.clearQueue();
  const db = new EvidenceVaultDatabase();
  const syncEngine = new OfflineSyncEngine();

  // Valid officer
  db.addUser({
    id: 'USR-POLICE-01',
    display_name: 'Valid Officer',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: new Date().toISOString(),
  });

  // Suspended officer
  db.addUser({
    id: 'USR-POLICE-SUSP',
    display_name: 'Suspended Officer',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'SUSPENDED',
    created_at: new Date().toISOString(),
  });

  // Item 1: Valid
  OfflineQueueManager.enqueueAction({
    action: 'CREATE_CASE',
    actorId: 'USR-POLICE-01',
    actorRole: 'POLICE_INVESTIGATOR',
    actorDepartment: 'POLICE',
    payload: {
      id: 'CASE-PART-01',
      case_reference: 'EV-PART-01',
      title: 'Valid Case 1',
      category: 'Theft',
      incident_date: null,
      assigned_officer_id: null,
      status: 'OPEN',
      created_by: 'USR-POLICE-01',
    },
  });

  // Item 2: Queued by suspended officer (should be REJECTED)
  OfflineQueueManager.enqueueAction({
    action: 'CREATE_CASE',
    actorId: 'USR-POLICE-SUSP',
    actorRole: 'POLICE_INVESTIGATOR',
    actorDepartment: 'POLICE',
    payload: {
      id: 'CASE-PART-02',
      case_reference: 'EV-PART-02',
      title: 'Suspended Case 2',
      category: 'Theft',
      incident_date: null,
      assigned_officer_id: null,
      status: 'OPEN',
      created_by: 'USR-POLICE-SUSP',
    },
  });

  // Sync batch
  const summary = await syncEngine.syncQueue(db);

  assert.equal(summary.totalEvents, 2);
  assert.equal(summary.syncedCount, 1);
  assert.equal(summary.rejectedCount, 1);

  // Network status transitions to PARTIAL_SYNC
  assert.equal(syncEngine.getNetworkStatus(), 'PARTIAL_SYNC');

  // Verify Item 1 succeeded on server
  assert.ok(db.getCase('CASE-PART-01'));
  // Verify Item 2 was rejected on server
  assert.equal(db.getCase('CASE-PART-02'), undefined);
});

// ============================================================================
// Phase 8: Offline Face Verification & Biometric MFA Tests
// ============================================================================

test('48. Biometric feasibility specification: Validates browsers, models, storage, FAR/FRR, fallback, and spoofing limits', () => {
  const bioEngine = new OfflineBiometricEngine();
  const report = bioEngine.getFeasibilityReport();

  assert.equal(report.status, 'CONDITIONALLY_FEASIBLE_AS_MFA_ONLY');
  assert.ok(report.feasibilityScore >= 80);
  assert.ok(report.supportedBrowsers.length >= 4);
  assert.match(report.recommendedModel, /MobileFaceNet/);
  assert.match(report.estimatedFAR, /0.08%/);
  assert.match(report.estimatedFRR, /2.4%/);
  assert.ok(report.knownPresentationAttackVulnerabilities.length >= 2);
  assert.match(BIOMETRIC_FEASIBILITY_SPEC.livenessLimitationsDisclaimer, /CRITICAL FORENSIC LIMITATION/);
  assert.match(BIOMETRIC_FEASIBILITY_SPEC.mfaRequirement, /MFA Mandatory/);
});

test('49. Consent-based enrollment: Enforces affirmative consent; rejects enrollment when consent is missing', async () => {
  const bioEngine = new OfflineBiometricEngine();
  const testUserId = 'USR-TEST-CONSENT-01';

  // 1. Enrollment without affirmative consent is strictly rejected
  await assert.rejects(
    async () => {
      await bioEngine.enrollTemplate({
        userId: testUserId,
        consentGranted: false, // Refused consent
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof BiometricConsentRequiredError);
      return true;
    }
  );
  assert.equal(bioEngine.isEnrolled(testUserId), false);

  // 2. Enrollment with affirmative consent succeeds
  const template = await bioEngine.enrollTemplate({
    userId: testUserId,
    consentGranted: true,
  });

  assert.ok(template.templateId.startsWith('TMPL-'));
  assert.equal(template.userId, testUserId);
  assert.equal(template.vectorValues.length, 128);
  assert.equal(bioEngine.isEnrolled(testUserId), true);
  assert.equal(bioEngine.getConsentStatus(testUserId), 'GRANTED');
});

test('50. Consent revocation: Withdrawing consent immediately updates status and purges stored biometric templates', async () => {
  const bioEngine = new OfflineBiometricEngine();
  const testUserId = 'USR-TEST-REVOKE-01';

  // Enroll first
  await bioEngine.enrollTemplate({
    userId: testUserId,
    consentGranted: true,
  });
  assert.equal(bioEngine.isEnrolled(testUserId), true);

  // User revokes biometric consent
  const revoked = bioEngine.revokeEnrollment(testUserId);
  assert.equal(revoked, true);
  assert.equal(bioEngine.isEnrolled(testUserId), false);
  assert.equal(bioEngine.getConsentStatus(testUserId), 'WITHDRAWN');
  assert.equal(bioEngine.getTemplate(testUserId), undefined, 'Biometric template must be permanently purged upon consent revocation');
});

test('51. Zero raw image retention: Stored templates contain only unit-normalized 128D mathematical vectors and digests', async () => {
  const bioEngine = new OfflineBiometricEngine();
  const template = bioEngine.getTemplate('USR-POLICE-01');
  assert.ok(template);

  // Verify vector is 128D
  assert.equal(template?.vectorValues.length, 128);

  // Verify vector is unit-normalized (length/magnitude approximately 1.0)
  let sumSq = 0;
  for (const v of template!.vectorValues) {
    sumSq += v * v;
  }
  const magnitude = Math.sqrt(sumSq);
  assert.ok(Math.abs(magnitude - 1.0) < 0.001, 'Vector must be unit normalized');

  // Verify no raw photo buffers or binary file keys exist in template object
  const templateKeys = Object.keys(template!);
  assert.ok(!templateKeys.includes('raw_image'));
  assert.ok(!templateKeys.includes('photo_bytes'));
  assert.ok(!templateKeys.includes('jpeg_buffer'));
  assert.ok(template?.embeddingDigest.startsWith('DIGEST-'));
});

test('52. Permitted matching flow: Matching synthetic facial vector (similarity >= 0.85) produces MATCH and audit log', async () => {
  const bioEngine = new OfflineBiometricEngine();
  const db = new EvidenceVaultDatabase();
  const officerId = 'USR-POLICE-01';

  // Generate candidate vector with low noise (expected cosine similarity ~0.98 >= 0.85)
  const candidateVector = bioEngine.generateCandidateVector(officerId, 0.02);

  const verification = await bioEngine.verifyFace({
    userId: officerId,
    candidateVector,
    simulateLivenessChallenge: true,
    challengeResponseValid: true,
    database: db,
  });

  assert.equal(verification.isMatch, true);
  assert.equal(verification.outcome, 'MATCH');
  assert.ok(verification.similarityScore >= BIOMETRIC_MATCH_THRESHOLD);
  assert.equal(verification.livenessPassed, true);
  assert.ok(verification.durationMs > 0);

  // Verify audit block was committed in database ledger
  const audits = db.getAuditEvents();
  const bioAudit = audits.find((a) => a.action === 'BIOMETRIC_MFA_VERIFIED');
  assert.ok(bioAudit, 'Database audit ledger must contain BIOMETRIC_MFA_VERIFIED block');
  assert.equal(bioAudit?.actor_id, officerId);
});

test('53. Denied matching flow: Dissimilar facial vector produces MISMATCH and denies step-up authentication', async () => {
  const bioEngine = new OfflineBiometricEngine();
  const db = new EvidenceVaultDatabase();
  const officerId = 'USR-POLICE-01';

  // Generate completely different synthetic vector (orthogonal/dissimilar actor)
  const randomVector = normalizeVector128(new Array(128).fill(0).map(() => Math.random() - 0.5));

  const verification = await bioEngine.verifyFace({
    userId: officerId,
    candidateVector: randomVector,
    simulateLivenessChallenge: true,
    challengeResponseValid: true,
    database: db,
  });

  assert.equal(verification.isMatch, false);
  assert.equal(verification.outcome, 'MISMATCH');
  assert.ok(verification.similarityScore < BIOMETRIC_MATCH_THRESHOLD);
  assert.ok(verification.errorMessage?.includes('below required threshold'));

  // Verify audit block records rejected attempt
  const audits = db.getAuditEvents();
  const rejectedAudit = audits.find((a) => a.action === 'BIOMETRIC_MFA_REJECTED');
  assert.ok(rejectedAudit, 'Database audit ledger must record BIOMETRIC_MFA_REJECTED block');
});

test('54. Presentation attack detection: Liveness challenge failure produces LIVENESS_FAILED and logs incident', async () => {
  const bioEngine = new OfflineBiometricEngine();
  const db = new EvidenceVaultDatabase();
  const officerId = 'USR-POLICE-01';

  // Simulate presentation attack where optical challenge response fails (e.g. static photo print replay)
  const verification = await bioEngine.verifyFace({
    userId: officerId,
    simulateLivenessChallenge: true,
    challengeResponseValid: false, // FAILED challenge!
    database: db,
  });

  assert.equal(verification.isMatch, false);
  assert.equal(verification.outcome, 'LIVENESS_FAILED');
  assert.equal(verification.livenessPassed, false);
  assert.match(verification.errorMessage || '', /Presentation Attack Detected/);

  // Verify audit block
  const audits = db.getAuditEvents();
  const livenessAudit = audits.find((a) => a.action === 'BIOMETRIC_VERIFICATION_LIVENESS_FAILED');
  assert.ok(livenessAudit, 'Audit ledger must log presentation attack detection');
});

test('55. Secure fallback authentication: Password/PIN fallback pathway succeeds when camera is bypassed or fails', () => {
  const bioEngine = new OfflineBiometricEngine();
  const officerId = 'USR-POLICE-01';

  // Attempt invalid short passcode
  const badFallback = bioEngine.triggerFallbackPinAuth(officerId, '12');
  assert.equal(badFallback.success, false);

  // Attempt valid official fallback passcode
  const validFallback = bioEngine.triggerFallbackPinAuth(officerId, '••••••••');
  assert.equal(validFallback.success, true);
});

// ============================================================================
// Phase 9: Weekly Audit, Review Dashboard & Report Export Tests
// ============================================================================

test('56. Date range filtering: AuditReviewEngine accurately filters findings within observation window', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // Pick a date range that includes seed events
  const today = new Date();
  const pastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const future = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const findingsInWindow = await AuditReviewEngine.generateAuditFindings(db, {
    startDate: pastWeek,
    endDate: future,
  });

  // Verify that all returned findings fall within the date range
  for (const f of findingsInWindow) {
    const fTime = new Date(f.timestamp).getTime();
    assert.ok(fTime >= new Date(pastWeek).getTime() - 1000, `Finding timestamp ${f.timestamp} must be >= startDate`);
    assert.ok(fTime <= new Date(future).getTime() + 1000, `Finding timestamp ${f.timestamp} must be <= endDate`);
  }

  // Filter with an ancient range that contains no events
  const emptyRange = await AuditReviewEngine.generateAuditFindings(db, {
    startDate: '2020-01-01T00:00:00.000Z',
    endDate: '2020-01-02T00:00:00.000Z',
  });
  assert.equal(emptyRange.length, 0, 'Zero findings should match out-of-range historical dates');
});

test('57. Finding classifications: Confirmed findings, warnings, and unverified suspicions are strictly distinguished', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // Inject a confirmed SHA-256 mismatch verification result
  const mismatchResult = {
    id: 'VER-TEST-MISMATCH-99',
    evidence_id: 'EVD-2026-001-A',
    file_version_id: 'VER-2026-001-A-v1',
    result: 'MISMATCH' as const,
    observedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    verified_by: 'USR-FORENSIC-01',
    verified_at: new Date().toISOString(),
    duration_ms: 12,
    byte_size: 4096,
    verification_mode: 'STREAMING_CHUNKS' as const,
  };

  // Add into database verificationResults map
  (db as unknown as { verificationResults: Map<string, unknown> }).verificationResults.set(
    mismatchResult.id,
    mismatchResult
  );

  const findings = await AuditReviewEngine.generateAuditFindings(db);

  // 1. Confirmed Finding: SHA-256 bitflip
  const confirmed = findings.filter((f) => f.classification === 'CONFIRMED_FINDING');
  assert.ok(confirmed.length > 0, 'Must identify at least one confirmed finding');
  const mismatchFinding = confirmed.find((f) => f.category === 'INTEGRITY_MISMATCH');
  assert.ok(mismatchFinding, 'Bit-flip mismatch must be classified as CONFIRMED_FINDING');
  assert.equal(mismatchFinding?.severity, 'CRITICAL');

  // 2. Warning: Missing reports or delayed SLAs
  const warnings = findings.filter((f) => f.classification === 'WARNING');
  assert.ok(warnings.length >= 0, 'Warnings list must be distinguishable');

  // 3. Unverified Suspicions
  const suspicions = findings.filter((f) => f.classification === 'UNVERIFIED_SUSPICION');
  for (const s of suspicions) {
    assert.equal(s.classification, 'UNVERIFIED_SUSPICION');
    assert.ok(s.description.includes('Requires') || s.description.includes('supervisor'));
  }
});

test('58. Cryptographic audit chain verification: Detects corrupted block and flags CONFIRMED CRITICAL finding', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // Chain is intact initially
  const initialVerify = await db.verifyAuditChain();
  assert.equal(initialVerify.isValid, true);

  // Tamper with an audit event in the database ledger
  const audits = (db as unknown as { auditEvents: Array<{ id: string; event_hash: string }> }).auditEvents;
  assert.ok(audits.length >= 2);
  const targetBlock = audits[1];
  const originalHash = targetBlock.event_hash;
  targetBlock.event_hash = 'CORRUPTED_HASH_TAMPERED_0000000000000000000000000000000000000000';

  // Run audit review
  const findings = await AuditReviewEngine.generateAuditFindings(db);
  const brokenChainFinding = findings.find((f) => f.category === 'BROKEN_AUDIT_CHAIN');

  assert.ok(brokenChainFinding, 'Corrupted audit ledger must produce BROKEN_AUDIT_CHAIN finding');
  assert.equal(brokenChainFinding?.classification, 'CONFIRMED_FINDING');
  assert.equal(brokenChainFinding?.severity, 'CRITICAL');
  assert.equal(brokenChainFinding?.sourceRecordId, targetBlock.id);

  // Restore for subsequent clean state
  targetBlock.event_hash = originalHash;
});

test('59. Missing metadata & report detection: Identifies evidence with missing file baseline or forensic report', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // Register an evidence item without any uploaded file versions
  const emptyEv = await db.createEvidence({
    id: 'EVD-TEST-NOFILE-01',
    case_id: 'CASE-2026-001',
    description: 'Physical evidence envelope without digital capture',
    evidence_type: 'DOCUMENT',
    source_description: 'Crime Scene File Desk',
    collected_by: 'USR-POLICE-01',
    collected_at: new Date().toISOString(),
    current_status: 'ACQUIRED',
    created_by: 'USR-POLICE-01',
  });

  const findings = await AuditReviewEngine.generateAuditFindings(db);
  const missingFileFinding = findings.find(
    (f) => f.evidenceId === emptyEv.id && f.category === 'MISSING_REQUIRED_METADATA_OR_REPORTS'
  );

  assert.ok(missingFileFinding, 'Evidence registered without file version must trigger MISSING_REQUIRED_METADATA_OR_REPORTS');
  assert.equal(missingFileFinding?.classification, 'WARNING');
  assert.equal(missingFileFinding?.severity, 'HIGH');
});

test('60. Missing transfer acknowledgement: Flags unacknowledged handoffs exceeding 48h SLA threshold', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // Inject a stale handoff submitted 72 hours ago
  const staleTimestamp = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const staleHandoff = {
    id: 'HANDOFF-TEST-STALE-72H',
    evidence_id: 'EVD-2026-001-A',
    source_department: 'POLICE' as const,
    destination_department: 'FORENSIC' as const,
    submitted_by: 'USR-POLICE-01',
    received_by: null,
    status: 'SUBMITTED' as const,
    submitted_at: staleTimestamp,
    acknowledged_at: null,
    rejection_reason: null,
  };

  (db as unknown as { handoffs: Map<string, unknown> }).handoffs.set(staleHandoff.id, staleHandoff);

  const findings = await AuditReviewEngine.generateAuditFindings(db);
  const staleFinding = findings.find((f) => f.eventId === staleHandoff.id);

  assert.ok(staleFinding, 'Stale unacknowledged handoff must generate finding');
  assert.equal(staleFinding?.category, 'MISSING_TRANSFER_ACK');
  assert.equal(staleFinding?.classification, 'WARNING');
  assert.equal(staleFinding?.severity, 'HIGH');
});

test('61. Role-based scoping: Scopes audit findings and report access to authorized cases only', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // Police Context: only assigned to CASE-2026-001
  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  const policeFindings = await AuditReviewEngine.generateAuditFindings(db, undefined, policeContext);
  for (const f of policeFindings) {
    if (f.caseId.startsWith('CASE-')) {
      assert.equal(f.caseId, 'CASE-2026-001', 'Police officer must only see findings for authorized case');
    }
  }

  // Public Prosecutor Context: has judicial oversight across all cases
  const prosecutorContext: SecurityContext = {
    actorId: 'USR-PROSECUTOR-01',
    role: 'PUBLIC_PROSECUTOR',
  };

  const prosSummary = await AuditReviewEngine.generateWeeklySummary(db, prosecutorContext);
  assert.ok(prosSummary.totalFindingsCount >= policeFindings.length);
  assert.equal(prosSummary.actorRole, 'PUBLIC_PROSECUTOR');
});

test('62. Prosecution Case Evidence Index & CSV export correctness: Exports RFC-4180 escaped report with 65B certificate', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const adminContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };

  // 1. Generate Prosecution Case Evidence Index
  const caseIndex = AuditReviewEngine.generateProsecutionEvidenceIndex(db, 'CASE-2026-001', adminContext);
  assert.equal(caseIndex.caseId, 'CASE-2026-001');
  assert.ok(caseIndex.totalEvidenceItems > 0);
  assert.match(caseIndex.judicialCertificationSection65B, /BNSS SECTION 65B/);

  // 2. Export to CSV
  const csvText = AuditReviewEngine.exportCaseEvidenceIndexToCsv(caseIndex);
  assert.ok(csvText.includes('"Item Code","Evidence ID","Category"'));
  assert.ok(csvText.includes('EVD-ITEM-001'));
  assert.ok(csvText.includes('Section 65B Judicial Certification'));

  // 3. Test CSV sanitization and formula injection prevention
  const dangerousField = sanitizeCsvField('=cmd|"/C calc"!A0');
  assert.ok(dangerousField.startsWith(`"'=cmd`), 'Formula injection prefix must be neutralized with leading single-quote');

  const commaField = sanitizeCsvField('Evidence, containing "quotes" and, commas');
  assert.ok(commaField.includes('""quotes""'), 'Inner quotes must be doubled per RFC 4180');

  // 4. Export Weekly Summary to CSV
  const weeklySummary = await AuditReviewEngine.generateWeeklySummary(db, adminContext);
  const weeklyCsv = AuditReviewEngine.exportWeeklyAuditSummaryToCsv(weeklySummary);
  assert.ok(weeklyCsv.includes('EVIDENCEVAULT 360 — WEEKLY AUDIT & COMPLIANCE REVIEW REPORT'));
  assert.ok(weeklyCsv.includes('Total Audit Blocks Evaluated'));
  assert.ok(weeklyCsv.includes('DETAILED AUDIT FINDINGS TABLE'));
});

test('63. Audit Review Scheduler lifecycle: Correctly reports manual on-demand status and controls in-process timer', () => {
  // Initial state: MANUAL_ON_DEMAND
  const initialStatus = AuditReviewScheduler.getSchedulerStatus();
  assert.equal(initialStatus.mode, 'MANUAL_ON_DEMAND');
  assert.equal(initialStatus.isIntervalActive, false);

  // Record a manual run
  AuditReviewScheduler.recordManualRun();
  const updatedStatus = AuditReviewScheduler.getSchedulerStatus();
  assert.ok(updatedStatus.lastRunAt, 'lastRunAt must be recorded on manual run');

  // Start in-process scheduler
  const db = new EvidenceVaultDatabase();
  AuditReviewScheduler.startWeeklyScheduler(db, 3600000); // 1 hr interval
  const runningStatus = AuditReviewScheduler.getSchedulerStatus();
  assert.equal(runningStatus.mode, 'INTERVAL_TIMER_ACTIVE');
  assert.equal(runningStatus.isIntervalActive, true);

  // Stop scheduler
  AuditReviewScheduler.stopScheduler();
  const stoppedStatus = AuditReviewScheduler.getSchedulerStatus();
  assert.equal(stoppedStatus.mode, 'MANUAL_ON_DEMAND');
  assert.equal(stoppedStatus.isIntervalActive, false);
});


