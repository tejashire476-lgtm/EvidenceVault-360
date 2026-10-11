// ============================================================================
// EVIDENCEVAULT 360 — PROSECUTION-TO-FORENSIC CLARIFICATION WORKFLOW TEST SUITE
// ============================================================================
// Verifies:
// 1. Mandatory validation for clarification notes (rejection of empty submissions)
// 2. Public Prosecutor submission of clarification request (persistence + audit logging)
// 3. Departmental access control guarding clarification submissions
// 4. Visibility in Forensic Portal via getClarificationRequests
// 5. Departmental access control guarding clarification responses
// 6. Forensic Examiner technical response submission (status transition to RESPONDED)
// 7. Forensic response linking an amended report version (AMENDED)
// 8. Judicial review completion: Public Prosecutor post-clarification acceptance
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { EvidenceVaultDatabase, AuthorizationError, DatabaseIntegrityError } from '../db.ts';
import { seedDatabase } from '../seed.ts';

test('Clarification Workflow — 1: Empty clarification notes are strictly rejected', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const demoCaseId = 'CASE-2026-001';
  const reports = db.getReportsForEvidence('EVD-2026-001');
  assert.ok(reports.length > 0, 'Seed should contain reports for EVD-2026-001');

  // Attempting to request clarification with empty notes must throw DatabaseIntegrityError
  await assert.rejects(
    async () => {
      await db.submitProsecutionReview({
        id: 'REV-EMPTY-NOTES-01',
        case_id: demoCaseId,
        report_id: reports[0].id,
        reviewer_id: 'USR-PROSECUTOR-01',
        status: 'FURTHER_EVIDENCE_REQUESTED',
        review_notes: '   ', // whitespace only
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof DatabaseIntegrityError);
      assert.match(
        (err as DatabaseIntegrityError).message,
        /Clarification notes are required/
      );
      return true;
    }
  );
});

test('Clarification Workflow — 2: Authorized Public Prosecutor submits clarification request and audits event', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const demoCaseId = 'CASE-2026-001';
  const reports = db.getReportsForEvidence('EVD-2026-001');
  const targetReport = reports[0];

  const clarificationNote =
    'Please clarify the chain of custody between 02:00 and 04:00 UTC and specify which disk imaging algorithm was applied.';

  const review = await db.submitProsecutionReview({
    id: 'REV-CLARIFY-TEST-01',
    case_id: demoCaseId,
    report_id: targetReport.id,
    reviewer_id: 'USR-PROSECUTOR-01',
    status: 'FURTHER_EVIDENCE_REQUESTED',
    review_notes: clarificationNote,
  });

  // Verify created record
  assert.equal(review.id, 'REV-CLARIFY-TEST-01');
  assert.equal(review.case_id, demoCaseId);
  assert.equal(review.report_id, targetReport.id);
  assert.equal(review.reviewer_id, 'USR-PROSECUTOR-01');
  assert.equal(review.status, 'FURTHER_EVIDENCE_REQUESTED');
  assert.equal(review.clarification_status, 'PENDING');
  assert.equal(review.review_notes, clarificationNote);
  assert.ok(review.created_at);

  // Verify audit event
  const audits = db.getAuditEvents();
  const submitAudit = audits.find(
    (a) =>
      a.action === 'SUBMIT_CLARIFICATION_REQUEST' &&
      a.entity_id === 'REV-CLARIFY-TEST-01'
  );
  assert.ok(submitAudit, 'Must record SUBMIT_CLARIFICATION_REQUEST audit event');
  assert.equal(submitAudit.actor_id, 'USR-PROSECUTOR-01');
  assert.equal(submitAudit.status, 'SUCCESS');
});

test('Clarification Workflow — 3: Non-prosecutors are blocked from submitting clarification requests', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const demoCaseId = 'CASE-2026-001';
  const reports = db.getReportsForEvidence('EVD-2026-001');

  // Police Investigator attempting to submit prosecution review
  await assert.rejects(
    async () => {
      await db.submitProsecutionReview({
        id: 'REV-BLOCKED-POLICE',
        case_id: demoCaseId,
        report_id: reports[0].id,
        reviewer_id: 'USR-POLICE-01',
        status: 'FURTHER_EVIDENCE_REQUESTED',
        review_notes: 'Police officer attempting prosecution review',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      return true;
    }
  );

  // Forensic Examiner attempting to submit prosecution review
  await assert.rejects(
    async () => {
      await db.submitProsecutionReview({
        id: 'REV-BLOCKED-FORENSIC',
        case_id: demoCaseId,
        report_id: reports[0].id,
        reviewer_id: 'USR-FORENSIC-01',
        status: 'FURTHER_EVIDENCE_REQUESTED',
        review_notes: 'Forensic examiner attempting prosecution review',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      return true;
    }
  );
});

test('Clarification Workflow — 4: Clarification request is queryable and visible in Forensic Portal', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const demoCaseId = 'CASE-2026-001';
  const reports = db.getReportsForEvidence('EVD-2026-001');

  await db.submitProsecutionReview({
    id: 'REV-FORENSIC-VISIBILITY-01',
    case_id: demoCaseId,
    report_id: reports[0].id,
    reviewer_id: 'USR-PROSECUTOR-01',
    status: 'FURTHER_EVIDENCE_REQUESTED',
    review_notes: 'Clarify tool calibration metadata.',
  });

  // Query clarification requests for the case
  const clarifications = db.getClarificationRequests(demoCaseId);
  assert.ok(clarifications.length >= 1);
  const found = clarifications.find((c) => c.id === 'REV-FORENSIC-VISIBILITY-01');
  assert.ok(found, 'Request must be present in getClarificationRequests');
  assert.equal(found.clarification_status, 'PENDING');
  assert.equal(found.review_notes, 'Clarify tool calibration metadata.');
});

test('Clarification Workflow — 5: Non-forensic users are blocked from responding to clarification', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const demoCaseId = 'CASE-2026-001';
  const reports = db.getReportsForEvidence('EVD-2026-001');

  const review = await db.submitProsecutionReview({
    id: 'REV-RESPONSE-GUARD-01',
    case_id: demoCaseId,
    report_id: reports[0].id,
    reviewer_id: 'USR-PROSECUTOR-01',
    status: 'FURTHER_EVIDENCE_REQUESTED',
    review_notes: 'Provide calibration certificates.',
  });

  // Police Investigator attempting to respond
  await assert.rejects(
    async () => {
      await db.respondToClarificationRequest(
        review.id,
        'Police response attempt',
        'USR-POLICE-01'
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      return true;
    }
  );

  // Prosecutor attempting to respond to own request
  await assert.rejects(
    async () => {
      await db.respondToClarificationRequest(
        review.id,
        'Prosecutor response attempt',
        'USR-PROSECUTOR-01'
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      return true;
    }
  );
});

test('Clarification Workflow — 6: Forensic Examiner responds to clarification with audit logging', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const demoCaseId = 'CASE-2026-001';
  const reports = db.getReportsForEvidence('EVD-2026-001');

  const review = await db.submitProsecutionReview({
    id: 'REV-EXAMINER-REPLY-01',
    case_id: demoCaseId,
    report_id: reports[0].id,
    reviewer_id: 'USR-PROSECUTOR-01',
    status: 'FURTHER_EVIDENCE_REQUESTED',
    review_notes: 'Confirm whether write-blocker was hardware or software based.',
  });

  const responseText =
    'CFSL Lab Confirmation: Tableau T8u Forensic USB 3.0 Hardware Write Blocker (Serial #WB-9912) was used throughout acquisition.';

  const result = await db.respondToClarificationRequest(
    review.id,
    responseText,
    'USR-FORENSIC-01'
  );

  assert.equal(result.review.id, review.id);
  assert.equal(result.review.clarification_status, 'RESPONDED');
  assert.equal(result.review.clarification_response, responseText);
  assert.equal(result.review.clarification_responder_id, 'USR-FORENSIC-01');
  assert.ok(result.review.clarification_responded_at);

  // Audit event verification
  const audits = db.getAuditEvents();
  const respondAudit = audits.find(
    (a) =>
      a.action === 'RESPOND_CLARIFICATION_REQUEST' &&
      a.entity_id === review.id
  );
  assert.ok(respondAudit, 'Must record RESPOND_CLARIFICATION_REQUEST audit event');
  assert.equal(respondAudit.actor_id, 'USR-FORENSIC-01');
  assert.equal(respondAudit.status, 'SUCCESS');
});

test('Clarification Workflow — 7: Forensic Examiner response can commit an amended report version', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const demoCaseId = 'CASE-2026-001';
  const initialReports = db.getReportsForEvidence('EVD-2026-001');
  const initialCount = initialReports.length;

  const review = await db.submitProsecutionReview({
    id: 'REV-AMENDED-REPORT-01',
    case_id: demoCaseId,
    report_id: initialReports[0].id,
    reviewer_id: 'USR-PROSECUTOR-01',
    status: 'FURTHER_EVIDENCE_REQUESTED',
    review_notes: 'Provide updated timeline in an amended report.',
  });

  const amendedContent =
    'Amended Forensic Analysis v2: Timeline updated to account for NTP server drift of +142ms.';

  const result = await db.respondToClarificationRequest(
    review.id,
    'Technical clarification provided along with formal report revision.',
    'USR-FORENSIC-01',
    amendedContent
  );

  assert.ok(result.amendedReport, 'Amended report must be created');
  assert.equal(result.amendedReport.status, 'AMENDED');
  assert.equal(result.amendedReport.report_content, amendedContent);
  assert.equal(result.review.resulting_report_id, result.amendedReport.id);

  const updatedReports = db.getReportsForEvidence('EVD-2026-001');
  assert.equal(updatedReports.length, initialCount + 1);
});

test('Clarification Workflow — 8: Public Prosecutor accepts evidence for trial presentation after clarification', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const demoCaseId = 'CASE-2026-001';
  const reports = db.getReportsForEvidence('EVD-2026-001');

  // Step 1: Prosecutor requests clarification
  const clarifyReview = await db.submitProsecutionReview({
    id: 'REV-LIFECYCLE-01',
    case_id: demoCaseId,
    report_id: reports[0].id,
    reviewer_id: 'USR-PROSECUTOR-01',
    status: 'FURTHER_EVIDENCE_REQUESTED',
    review_notes: 'Verify hash match on second mirror drive.',
  });
  assert.equal(clarifyReview.clarification_status, 'PENDING');

  // Step 2: Forensic Examiner clarifies
  const response = await db.respondToClarificationRequest(
    clarifyReview.id,
    'Second mirror drive SHA-256 confirmed identical (bit-stream match).',
    'USR-FORENSIC-01'
  );
  assert.equal(response.review.clarification_status, 'RESPONDED');

  // Step 3: Public Prosecutor accepts evidence for judicial trial presentation
  const finalTrialReview = await db.submitProsecutionReview({
    id: 'REV-LIFECYCLE-02',
    case_id: demoCaseId,
    report_id: reports[0].id,
    reviewer_id: 'USR-PROSECUTOR-01',
    status: 'ACCEPTED_FOR_TRIAL',
    review_notes:
      'Forensic clarification satisfactorily addressed all judicial inquiries. Admissible under Section 65B.',
  });

  assert.equal(finalTrialReview.status, 'ACCEPTED_FOR_TRIAL');

  // Step 4: Verify Case Evidence Index includes both clarification and final trial acceptance
  const index = db.generateCaseEvidenceIndex(demoCaseId);
  const reviewsInIndex = index.prosecutionReviews;
  assert.ok(reviewsInIndex.some((r) => r.id === 'REV-LIFECYCLE-01'));
  assert.ok(reviewsInIndex.some((r) => r.id === 'REV-LIFECYCLE-02'));
});
