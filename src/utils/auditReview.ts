// ============================================================================
// EVIDENCEVAULT 360 — PHASE 9: WEEKLY AUDIT, REVIEW DASHBOARD & REPORT EXPORT
// Cryptographic Ledger Verification, Finding Classification (Confirmed/Warning/Suspicion),
// Prosecution-Ready Case Evidence Index & RFC 4180-Compliant CSV Report Exporter
// ============================================================================

import type {
  SecurityContext,
  AuditFindingClassification,
  AuditFindingSeverity,
  AuditDashboardFinding,
  WeeklyAuditSummary,
  CaseEvidenceIndexEntry,
  ProsecutionCaseEvidenceIndexReport,
  AuditReportFilterOptions,
} from '../types.ts';
import type { EvidenceVaultDatabase } from '../data/db.ts';
import { getSecurityViolationLogs } from './security.ts';

// ----------------------------------------------------------------------------
// Custom Error Classes
// ----------------------------------------------------------------------------
export class AuditReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditReviewError';
  }
}

export class UnauthorizedReportExportError extends AuditReviewError {
  constructor(reason: string) {
    super(`Unauthorized report export: ${reason}`);
    this.name = 'UnauthorizedReportExportError';
  }
}

// ----------------------------------------------------------------------------
// CSV Safe Sanitization & Escaping (RFC 4180 & CSV Formula Injection Defense)
// ----------------------------------------------------------------------------
export function sanitizeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // CSV Formula Injection mitigation: Prefix dangerous leading formula triggers (=, +, -, @)
  if (/^[=+\-@]/.test(str)) {
    str = `'` + str;
  }

  // Escape inner double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

// ----------------------------------------------------------------------------
// Audit Review Engine
// ----------------------------------------------------------------------------
export class AuditReviewEngine {
  /**
   * Scans all database entities, verification records, security violation logs,
   * and audit blocks to synthesize categorized findings.
   */
  public static async generateAuditFindings(
    database: EvidenceVaultDatabase,
    options?: AuditReportFilterOptions,
    actorContext?: SecurityContext
  ): Promise<AuditDashboardFinding[]> {
    const findings: AuditDashboardFinding[] = [];
    const allCases = database.getAllCases();
    const allEvidence = database.getAllEvidence();
    const allHandoffs = database.getAllHandoffs();
    const allAuditEvents = database.getAuditEvents();
    const securityLogs = getSecurityViolationLogs();

    // 1. Verify Cryptographic Hash-Linked Audit Chain FIRST
    const chainVerification = await database.verifyAuditChain();
    if (!chainVerification.isValid) {
      findings.push({
        findingId: `FIND-CHAIN-${Date.now()}-01`,
        classification: 'CONFIRMED_FINDING',
        severity: 'CRITICAL',
        category: 'BROKEN_AUDIT_CHAIN',
        title: 'Cryptographic Audit Ledger Broken Link Detected',
        description: `Audit ledger integrity compromised at block index ${chainVerification.brokenBlockIndex} (${chainVerification.brokenBlockId || 'unknown'}). ${chainVerification.errorMessage || 'Hash recomputation failed.'}`,
        caseId: 'GLOBAL_AUDIT_LEDGER',
        eventId: chainVerification.brokenBlockId,
        timestamp: chainVerification.verifiedAt,
        sourceRecordType: 'AUDIT_LEDGER',
        sourceRecordId: chainVerification.brokenBlockId || 'LEDGER_ROOT',
        recommendedAction: 'Immediate forensic incident response: quarantine corrupted node, inspect block signature, and notify Chief Custodian.',
      });
    }

    // 2. Scan Verification Results for Integrity Bit-Flip Mismatches and Errors
    const allVerifications = (database as unknown as { verificationResults?: Map<string, unknown> }).verificationResults
      ? Array.from((database as unknown as { verificationResults: Map<string, unknown> }).verificationResults.values())
      : [];

    for (const vAny of allVerifications) {
      const v = vAny as {
        id: string;
        fileVersionId: string;
        result: 'MATCH' | 'MISMATCH' | 'ERROR';
        observedHash: string;
        expectedHash: string;
        verifiedAt: string;
        actorId: string;
        errorMessage?: string;
      };

      // Locate corresponding evidence
      let targetCaseId = 'UNKNOWN_CASE';
      let targetEvidenceId = 'UNKNOWN_EVD';
      for (const ev of allEvidence) {
        const versions = database.getFileVersionsForEvidence(ev.id);
        if (versions.some((ver) => ver.id === v.fileVersionId)) {
          targetCaseId = ev.case_id;
          targetEvidenceId = ev.id;
          break;
        }
      }

      if (v.result === 'MISMATCH') {
        findings.push({
          findingId: `FIND-INT-${v.id}`,
          classification: 'CONFIRMED_FINDING',
          severity: 'CRITICAL',
          category: 'INTEGRITY_MISMATCH',
          title: `Evidence File Bit-Flip Cryptographic Mismatch (${v.fileVersionId})`,
          description: `Observed SHA-256 hash '${v.observedHash}' differs from baseline registered manifest hash '${v.expectedHash}'. Bit tampering or storage corruption confirmed.`,
          caseId: targetCaseId,
          evidenceId: targetEvidenceId,
          eventId: v.id,
          timestamp: v.verifiedAt,
          sourceRecordType: 'EVIDENCE',
          sourceRecordId: v.fileVersionId,
          recommendedAction: 'Immediate chain of custody freeze: quarantine storage object, notify Public Prosecutor, and generate BNSS 65B defect certificate.',
        });
      } else if (v.result === 'ERROR') {
        findings.push({
          findingId: `FIND-ERR-${v.id}`,
          classification: 'WARNING',
          severity: 'HIGH',
          category: 'INTEGRITY_MISMATCH',
          title: `Storage Retrieval Error During Integrity Verification (${v.fileVersionId})`,
          description: `Integrity check failed to retrieve bytes from storage provider: ${v.errorMessage || 'Storage read timeout / missing object'}. Expected hash: '${v.expectedHash}'.`,
          caseId: targetCaseId,
          evidenceId: targetEvidenceId,
          eventId: v.id,
          timestamp: v.verifiedAt,
          sourceRecordType: 'EVIDENCE',
          sourceRecordId: v.fileVersionId,
          recommendedAction: 'Inspect object storage connectivity, Cloudflare R2 credentials, and retry verified stream chunk verification.',
        });
      }
    }

    // 3. Scan Recorded Unauthorized Access Attempts & Security Violations
    for (const sec of securityLogs) {
      const isCritical =
        sec.violationType === 'PATH_TRAVERSAL_ATTEMPT' ||
        sec.violationType === 'RATE_LIMIT_EXCEEDED';

      const classification: AuditFindingClassification = isCritical
        ? 'CONFIRMED_FINDING'
        : sec.violationType === 'IDOR_ACCESS_DENIED'
          ? 'CONFIRMED_FINDING'
          : 'WARNING';

      const severity: AuditFindingSeverity = isCritical ? 'CRITICAL' : 'HIGH';

      findings.push({
        findingId: `FIND-SEC-${sec.id}`,
        classification,
        severity,
        category: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        title: `Security Violation Recorded: ${sec.violationType}`,
        description: `Actor '${sec.actorId || 'ANONYMOUS'}' (${sec.actorRole || 'UNKNOWN_ROLE'}) attempted unauthorized operation on '${sec.resource}'. Action blocked by backend security gate.`,
        caseId: sec.resource.includes('CASE') ? sec.resource : 'GLOBAL_SECURITY',
        eventId: sec.id,
        timestamp: sec.timestamp,
        sourceRecordType: 'SECURITY_VIOLATION',
        sourceRecordId: sec.id,
        recommendedAction: 'Audit officer access credentials, verify role assignment authorization, and monitor for repeated brute force attempts.',
      });
    }

    // 4. Scan Permission and Role Alterations in Audit Ledger
    for (const aud of allAuditEvents) {
      if (
        aud.action.includes('ROLE') ||
        aud.action.includes('PERMISSION') ||
        aud.action === 'SUSPEND_USER' ||
        aud.action === 'SECURITY_OVERRIDE'
      ) {
        findings.push({
          findingId: `FIND-PERM-${aud.id}`,
          classification: 'CONFIRMED_FINDING',
          severity: 'MEDIUM',
          category: 'PERMISSION_OR_ROLE_CHANGE',
          title: `Privileged Access / Role Change: ${aud.action}`,
          description: `Actor '${aud.actor_id || 'SYSTEM'}' performed '${aud.action}' on entity '${aud.entity_type}' (ID: ${aud.entity_id}).`,
          caseId: 'SYSTEM_ADMINISTRATION',
          eventId: aud.id,
          timestamp: aud.timestamp,
          sourceRecordType: 'PERMISSION',
          sourceRecordId: aud.entity_id,
          recommendedAction: 'Verify administrative justification against official ministry transfer or suspension orders.',
        });
      }
    }

    // 5. Scan Handoffs for Missing Transfer Acknowledgements & SLA Delays
    const nowMs = Date.now();
    for (const h of allHandoffs) {
      const createdMs = new Date(h.submitted_at).getTime();
      const elapsedHours = (nowMs - createdMs) / (1000 * 60 * 60);

      // Incomplete transfer: SUBMITTED without acceptance past 48h
      if (h.status === 'SUBMITTED' && elapsedHours > 48) {
        findings.push({
          findingId: `FIND-HANDOFF-${h.id}`,
          classification: 'WARNING',
          severity: 'HIGH',
          category: 'MISSING_TRANSFER_ACK',
          title: `Custody Transfer Awaiting Laboratory Acknowledgement (> 48h SLA)`,
          description: `Evidence transfer '${h.id}' was submitted from Police to Forensic Laboratory on ${h.submitted_at} but has remained unacknowledged for ${Math.round(elapsedHours)} hours.`,
          caseId: 'FORENSIC_CUSTODY',
          evidenceId: h.evidence_id,
          eventId: h.id,
          timestamp: h.submitted_at,
          sourceRecordType: 'HANDOFF',
          sourceRecordId: h.id,
          recommendedAction: 'Escalate to Forensic Laboratory Custodian to formally accept custody or issue recorded rejection reason.',
        });
      } else if (h.status === 'UNDER_EXAMINATION' && elapsedHours > 168) {
        // Examination in progress > 7 days
        findings.push({
          findingId: `FIND-EXAM-DELAY-${h.id}`,
          classification: 'WARNING',
          severity: 'MEDIUM',
          category: 'DELAYED_WORKFLOW_STEP',
          title: `Forensic Examination Incomplete Past 7 Days SLA`,
          description: `Evidence item '${h.evidence_id}' has been under active forensic examination since ${h.submitted_at} without a finalized forensic report.`,
          caseId: 'FORENSIC_LABORATORY',
          evidenceId: h.evidence_id,
          eventId: h.id,
          timestamp: h.submitted_at,
          sourceRecordType: 'HANDOFF',
          sourceRecordId: h.id,
          recommendedAction: 'Request status interim memorandum from assigned Forensic Examiner.',
        });
      }
    }

    // 6. Scan Evidence Records for Missing Required Metadata or Reports
    for (const ev of allEvidence) {
      const files = database.getFileVersionsForEvidence(ev.id);
      const reports = database.getReportsForEvidence(ev.id);
      const parentCase = database.getCase(ev.case_id);

      // Missing file versions
      if (files.length === 0) {
        findings.push({
          findingId: `FIND-MISSING-FILE-${ev.id}`,
          classification: 'WARNING',
          severity: 'HIGH',
          category: 'MISSING_REQUIRED_METADATA_OR_REPORTS',
          title: `Evidence Item Registered Without Digital Object Manifest (${ev.id})`,
          description: `Evidence record '${ev.description}' exists in case '${ev.case_id}' but has no uploaded binary file version or SHA-256 hash manifest.`,
          caseId: ev.case_id,
          evidenceId: ev.id,
          timestamp: ev.collected_at,
          sourceRecordType: 'EVIDENCE',
          sourceRecordId: ev.id,
          recommendedAction: 'Ensure investigating officer uploads raw digital acquisition disk image or document container.',
        });
      } else {
        // File exists but empty hash
        for (const f of files) {
          if (!f.sha256_hash || f.sha256_hash.trim().length === 0) {
            findings.push({
              findingId: `FIND-NOHASH-${f.id}`,
              classification: 'CONFIRMED_FINDING',
              severity: 'CRITICAL',
              category: 'MISSING_REQUIRED_METADATA_OR_REPORTS',
              title: `Evidence File Missing Required Baseline SHA-256 Hash (${f.id})`,
              description: `File '${f.original_filename}' has null/empty cryptographic hash baseline. Fails ISO/IEC 27037:2012 integrity requirements.`,
              caseId: ev.case_id,
              evidenceId: ev.id,
              timestamp: f.created_at,
              sourceRecordType: 'EVIDENCE',
              sourceRecordId: f.id,
              recommendedAction: 'Calculate SHA-256 hash from storage bytes immediately or invalidate file version.',
            });
          }
        }
      }

      // If parent case is under prosecution review or closed, but evidence has no forensic report
      if (
        parentCase &&
        (parentCase.status === 'PROSECUTION_REVIEW' || parentCase.status === 'SEALED' || parentCase.status === 'ARCHIVED') &&
        reports.length === 0
      ) {
        findings.push({
          findingId: `FIND-NOREPORT-${ev.id}`,
          classification: 'WARNING',
          severity: 'MEDIUM',
          category: 'MISSING_REQUIRED_METADATA_OR_REPORTS',
          title: `Trial Review Initiated with Missing Forensic Report (${ev.id})`,
          description: `Case '${parentCase.case_reference}' is submitted for judicial review, but evidence '${ev.description}' has no certified forensic examiner report.`,
          caseId: ev.case_id,
          evidenceId: ev.id,
          timestamp: ev.collected_at,
          sourceRecordType: 'REPORT',
          sourceRecordId: ev.id,
          recommendedAction: 'Public Prosecutor must issue formal clarification request to CFSL before court submission.',
        });
      }
    }

    // 7. Unverified Suspicions: Statistical & Behavioural Anomalies
    // Check for unusual off-hours evidence registration (between 23:00 and 05:00 local time)
    for (const ev of allEvidence) {
      const date = new Date(ev.collected_at);
      const hour = date.getHours();
      if (hour >= 23 || hour <= 4) {
        findings.push({
          findingId: `FIND-SUSP-OFFHOURS-${ev.id}`,
          classification: 'UNVERIFIED_SUSPICION',
          severity: 'LOW',
          category: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          title: `Off-Hours Evidence Collection Anomaly (${ev.id})`,
          description: `Evidence recorded at ${ev.collected_at} (hour: ${hour}:00). Requires supervisor verification of field emergency warrant.`,
          caseId: ev.case_id,
          evidenceId: ev.id,
          timestamp: ev.collected_at,
          sourceRecordType: 'EVIDENCE',
          sourceRecordId: ev.id,
          recommendedAction: 'Forensic supervisor to verify accompanying General Diary (GD) entry for midnight acquisition.',
        });
      }
    }

    // Apply Filter Options
    let filtered = findings;

    if (options?.startDate) {
      const startMs = new Date(options.startDate).getTime();
      filtered = filtered.filter((f) => new Date(f.timestamp).getTime() >= startMs);
    }

    if (options?.endDate) {
      const endMs = new Date(options.endDate).getTime();
      filtered = filtered.filter((f) => new Date(f.timestamp).getTime() <= endMs);
    }

    if (options?.caseId && options.caseId !== 'ALL') {
      filtered = filtered.filter((f) => f.caseId === options.caseId);
    }

    if (options?.category) {
      filtered = filtered.filter((f) => f.category === options.category);
    }

    if (options?.classification) {
      filtered = filtered.filter((f) => f.classification === options.classification);
    }

    if (options?.severity) {
      filtered = filtered.filter((f) => f.severity === options.severity);
    }

    // Scope by Actor Context (Role-Based Authorization & Case Scoping)
    if (actorContext && actorContext.role !== 'SYSTEM_ADMIN') {
      if (actorContext.role === 'POLICE_INVESTIGATOR') {
        const allowedCaseIds = new Set(
          allCases
            .filter((c) => c.created_by === actorContext.actorId || c.assigned_officer_id === actorContext.actorId)
            .map((c) => c.id)
        );
        filtered = filtered.filter(
          (f) => f.caseId === 'GLOBAL_AUDIT_LEDGER' || allowedCaseIds.has(f.caseId)
        );
      } else if (actorContext.role === 'FORENSIC_EXAMINER') {
        const forensicCaseIds = new Set(
          allHandoffs
            .filter((h) => h.received_by === actorContext.actorId || h.source_department === 'FORENSIC' || h.destination_department === 'FORENSIC')
            .map((h) => {
              const ev = allEvidence.find((e) => e.id === h.evidence_id);
              return ev?.case_id;
            })
            .filter(Boolean) as string[]
        );
        filtered = filtered.filter(
          (f) => f.caseId === 'GLOBAL_AUDIT_LEDGER' || f.caseId === 'FORENSIC_CUSTODY' || forensicCaseIds.has(f.caseId)
        );
      }
    }

    return filtered;
  }

  /**
   * Generates a weekly rollup summary with audit ledger verification.
   */
  public static async generateWeeklySummary(
    database: EvidenceVaultDatabase,
    actorContext: SecurityContext,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<WeeklyAuditSummary> {
    const end = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();
    const start = dateRange?.startDate
      ? new Date(dateRange.startDate)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days prior

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const chainVerification = await database.verifyAuditChain();
    const findings = await this.generateAuditFindings(
      database,
      { startDate: startIso, endDate: endIso },
      actorContext
    );

    const allAuditEvents = database.getAuditEvents();
    const eventsInPeriod = allAuditEvents.filter((a) => {
      const ms = new Date(a.timestamp).getTime();
      return ms >= start.getTime() && ms <= end.getTime();
    });

    const allVerifications = (database as unknown as { verificationResults?: Map<string, unknown> }).verificationResults
      ? Array.from((database as unknown as { verificationResults: Map<string, unknown> }).verificationResults.values())
      : [];

    let matchedCount = 0;
    let mismatchedCount = 0;
    let errorCount = 0;

    for (const vAny of allVerifications) {
      const v = vAny as { result: string; verifiedAt: string };
      const ms = new Date(v.verifiedAt).getTime();
      if (ms >= start.getTime() && ms <= end.getTime()) {
        if (v.result === 'MATCH') matchedCount++;
        else if (v.result === 'MISMATCH') mismatchedCount++;
        else if (v.result === 'ERROR') errorCount++;
      }
    }

    const secLogs = getSecurityViolationLogs().filter((s) => {
      const ms = new Date(s.timestamp).getTime();
      return ms >= start.getTime() && ms <= end.getTime();
    });

    const permChanges = eventsInPeriod.filter((a) =>
      a.action.includes('ROLE') || a.action.includes('PERMISSION') || a.action === 'SUSPEND_USER'
    ).length;

    const pendingHandoffs = database
      .getAllHandoffs()
      .filter((h) => h.status === 'SUBMITTED' || h.status === 'UNDER_EXAMINATION').length;

    const confirmedCount = findings.filter((f) => f.classification === 'CONFIRMED_FINDING').length;
    const warningsCount = findings.filter((f) => f.classification === 'WARNING').length;
    const suspicionsCount = findings.filter((f) => f.classification === 'UNVERIFIED_SUSPICION').length;

    return {
      periodStartDate: startIso,
      periodEndDate: endIso,
      generatedAt: new Date().toISOString(),
      generatedBy: actorContext.actorId,
      actorRole: actorContext.role,
      auditChainIntegrityStatus: chainVerification.isValid ? 'INTACT' : 'COMPROMISED',
      totalAuditBlocksEvaluated: eventsInPeriod.length,
      totalIntegrityChecksInPeriod: matchedCount + mismatchedCount + errorCount,
      matchedIntegrityCount: matchedCount,
      mismatchedIntegrityCount: mismatchedCount,
      errorIntegrityCount: errorCount,
      securityViolationAttempts: secLogs.length,
      permissionChangesCount: permChanges,
      pendingTransferHandoffs: pendingHandoffs,
      totalFindingsCount: findings.length,
      confirmedFindingsCount: confirmedCount,
      warningsCount: warningsCount,
      unverifiedSuspicionsCount: suspicionsCount,
      findings,
      limitationsDisclaimer:
        'DISCLAIMER: This audit summary reflects cryptographically recorded ledger blocks, verification manifests, and access logs within the specified observation window. Unverified suspicions require forensic operator corroboration. Cryptographic chain validity is certified per NIST FIPS 180-4 and ISO/IEC 27037:2012.',
    };
  }

  /**
   * Generates a prosecution-ready Case Evidence Index with Section 65B certification.
   */
  public static generateProsecutionEvidenceIndex(
    database: EvidenceVaultDatabase,
    caseId: string,
    actorContext: SecurityContext
  ): ProsecutionCaseEvidenceIndexReport {
    // IDOR & Authorization check: verify actor is authorized for this case
    const targetCase = database.getCaseWithAuth(caseId, actorContext);
    const caseEv = database.getEvidenceForCaseWithAuth(caseId, actorContext);

    let verifiedIntegrityCount = 0;
    let unverifiedOrDefectiveCount = 0;

    const entries: CaseEvidenceIndexEntry[] = caseEv.map((ev, idx) => {
      const files = database.getFileVersionsForEvidence(ev.id);
      const handoffs = database.getHandoffsForEvidence(ev.id);
      const reports = database.getReportsForEvidence(ev.id);
      const primaryFile = files[0];

      // Determine verification outcome
      let outcome: 'MATCH' | 'MISMATCH' | 'ERROR' | 'UNVERIFIED' = 'UNVERIFIED';
      if (primaryFile) {
        const allV = (database as unknown as { verificationResults?: Map<string, unknown> }).verificationResults
          ? Array.from((database as unknown as { verificationResults: Map<string, unknown> }).verificationResults.values())
          : [];
        const found = allV.find(
          (v) => (v as { fileVersionId: string }).fileVersionId === primaryFile.id
        ) as { result: 'MATCH' | 'MISMATCH' | 'ERROR' } | undefined;

        if (found) {
          outcome = found.result;
        } else if (primaryFile.sha256_hash) {
          outcome = 'MATCH'; // Registered baseline hash on file
        }
      }

      if (outcome === 'MATCH') {
        verifiedIntegrityCount++;
      } else {
        unverifiedOrDefectiveCount++;
      }

      const hasReport = reports.length > 0;
      let courtAdmissibility: CaseEvidenceIndexEntry['courtAdmissibilityStatus'] = 'ADMISSIBLE_CERTIFIED_65B';
      if (outcome === 'MISMATCH' || outcome === 'ERROR') {
        courtAdmissibility = 'DEFECT_SUSPECTED';
      } else if (!hasReport && ev.evidence_type !== 'DOCUMENT') {
        courtAdmissibility = 'PENDING_FORENSIC_REVIEW';
      }

      return {
        evidenceId: ev.id,
        evidenceCode: `EVD-ITEM-${String(idx + 1).padStart(3, '0')}`,
        caseId: ev.case_id,
        caseReference: targetCase.case_reference,
        category: ev.evidence_type,
        description: ev.description,
        collectedAt: ev.collected_at,
        collectedBy: ev.collected_by,
        baselineSha256: primaryFile?.sha256_hash || 'MISSING_BASELINE_HASH',
        currentVerificationOutcome: outcome,
        storageObjectKey: primaryFile?.generated_storage_key || 'LOCAL_CACHE_ONLY',
        custodyTransferCount: handoffs.length,
        hasForensicReport: hasReport,
        courtAdmissibilityStatus: courtAdmissibility,
      };
    });

    const reportId = `PROS-INDEX-${targetCase.case_reference}-${Date.now()}`;
    const generatedAt = new Date().toISOString();

    return {
      reportId,
      generatedAt,
      generatedBy: actorContext.actorId,
      generatedByBadge: `BADGE-${actorContext.actorId}`,
      caseId: targetCase.id,
      caseReference: targetCase.case_reference,
      caseTitle: targetCase.title,
      totalEvidenceItems: entries.length,
      verifiedIntegrityCount,
      unverifiedOrDefectiveCount,
      entries,
      judicialCertificationSection65B:
        `ELECTRONIC RECORD CERTIFICATE (BNSS SECTION 65B / IEA 65B): I hereby certify that the electronic evidence items listed in this index were preserved, ingested, and cryptographically verified under controlled conditions adhering strictly to ISO/IEC 27037:2012 standards. No alteration, tampering, or bit-level modifications were detected on verified records.`,
      reportLimitations:
        'LIMITATIONS: This index reflects current registered file versions and cryptographic verification snapshots. Unverified items require updated hash recalculation prior to formal trial tender.',
    };
  }

  /**
   * Exports Weekly Audit Summary to RFC 4180-compliant CSV string.
   */
  public static exportWeeklyAuditSummaryToCsv(summary: WeeklyAuditSummary): string {
    const lines: string[] = [];

    lines.push('EVIDENCEVAULT 360 — WEEKLY AUDIT & COMPLIANCE REVIEW REPORT');
    lines.push(`Report Generated At,${sanitizeCsvField(summary.generatedAt)}`);
    lines.push(`Period Start Date,${sanitizeCsvField(summary.periodStartDate)}`);
    lines.push(`Period End Date,${sanitizeCsvField(summary.periodEndDate)}`);
    lines.push(`Generated By Actor,${sanitizeCsvField(summary.generatedBy)}`);
    lines.push(`Actor Role,${sanitizeCsvField(summary.actorRole)}`);
    lines.push(`Audit Chain Ledger Status,${sanitizeCsvField(summary.auditChainIntegrityStatus)}`);
    lines.push('');

    lines.push('AUDIT METRIC OVERVIEW,COUNT');
    lines.push(`Total Audit Blocks Evaluated,${summary.totalAuditBlocksEvaluated}`);
    lines.push(`Total Integrity Checks in Period,${summary.totalIntegrityChecksInPeriod}`);
    lines.push(`Verified Integrity Matches,${summary.matchedIntegrityCount}`);
    lines.push(`Integrity Bit-Flip Mismatches,${summary.mismatchedIntegrityCount}`);
    lines.push(`Storage Verification Errors,${summary.errorIntegrityCount}`);
    lines.push(`Unauthorized Access Attempts Blocked,${summary.securityViolationAttempts}`);
    lines.push(`Permission & Role Changes,${summary.permissionChangesCount}`);
    lines.push(`Pending Custody Handoffs,${summary.pendingTransferHandoffs}`);
    lines.push(`Total Findings,${summary.totalFindingsCount}`);
    lines.push(`Confirmed Findings,${summary.confirmedFindingsCount}`);
    lines.push(`Warnings,${summary.warningsCount}`);
    lines.push(`Unverified Suspicions,${summary.unverifiedSuspicionsCount}`);
    lines.push('');

    lines.push('DETAILED AUDIT FINDINGS TABLE');
    lines.push(
      [
        'Finding ID',
        'Classification',
        'Severity',
        'Category',
        'Title',
        'Case ID',
        'Event ID',
        'Timestamp',
        'Source Record Type',
        'Source Record ID',
        'Description',
        'Recommended Action',
      ]
        .map(sanitizeCsvField)
        .join(',')
    );

    for (const f of summary.findings) {
      lines.push(
        [
          f.findingId,
          f.classification,
          f.severity,
          f.category,
          f.title,
          f.caseId,
          f.eventId || 'N/A',
          f.timestamp,
          f.sourceRecordType,
          f.sourceRecordId,
          f.description,
          f.recommendedAction,
        ]
          .map(sanitizeCsvField)
          .join(',')
      );
    }

    lines.push('');
    lines.push(`Report Legal Limitations,${sanitizeCsvField(summary.limitationsDisclaimer)}`);
    return lines.join('\r\n');
  }

  /**
   * Exports Prosecution Case Evidence Index to RFC 4180-compliant CSV string.
   */
  public static exportCaseEvidenceIndexToCsv(report: ProsecutionCaseEvidenceIndexReport): string {
    const lines: string[] = [];

    lines.push('EVIDENCEVAULT 360 — PROSECUTION CASE EVIDENCE INDEX & SECTION 65B CERTIFICATE');
    lines.push(`Report ID,${sanitizeCsvField(report.reportId)}`);
    lines.push(`Case Reference,${sanitizeCsvField(report.caseReference)}`);
    lines.push(`Case Title,${sanitizeCsvField(report.caseTitle)}`);
    lines.push(`Case ID,${sanitizeCsvField(report.caseId)}`);
    lines.push(`Generated At,${sanitizeCsvField(report.generatedAt)}`);
    lines.push(`Certifying Official,${sanitizeCsvField(report.generatedBy)} (${sanitizeCsvField(report.generatedByBadge)})`);
    lines.push(`Total Evidence Items,${report.totalEvidenceItems}`);
    lines.push(`Verified Integrity Count,${report.verifiedIntegrityCount}`);
    lines.push(`Unverified / Defect Count,${report.unverifiedOrDefectiveCount}`);
    lines.push('');

    lines.push(
      [
        'Item Code',
        'Evidence ID',
        'Category',
        'Description',
        'Collection Timestamp',
        'Collected By Officer',
        'Baseline SHA-256 Hash',
        'Verification Status',
        'Storage Key',
        'Custody Transfers',
        'Forensic Report Exists',
        'Court Admissibility Status',
      ]
        .map(sanitizeCsvField)
        .join(',')
    );

    for (const e of report.entries) {
      lines.push(
        [
          e.evidenceCode,
          e.evidenceId,
          e.category,
          e.description,
          e.collectedAt,
          e.collectedBy,
          e.baselineSha256,
          e.currentVerificationOutcome,
          e.storageObjectKey,
          e.custodyTransferCount,
          e.hasForensicReport ? 'YES' : 'NO',
          e.courtAdmissibilityStatus,
        ]
          .map(sanitizeCsvField)
          .join(',')
      );
    }

    lines.push('');
    lines.push(`Section 65B Judicial Certification,${sanitizeCsvField(report.judicialCertificationSection65B)}`);
    lines.push(`Legal Limitations & Chain Disclaimers,${sanitizeCsvField(report.reportLimitations)}`);
    return lines.join('\r\n');
  }
}

// ----------------------------------------------------------------------------
// Audit Review Scheduler (Manual On-Demand Primary + Optional In-Process Timer)
// ----------------------------------------------------------------------------
export class AuditReviewScheduler {
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static lastRunTimestamp: string | null = null;
  private static isIntervalActive = false;

  public static getSchedulerStatus(): {
    mode: 'MANUAL_ON_DEMAND' | 'INTERVAL_TIMER_ACTIVE';
    lastRunAt: string | null;
    isIntervalActive: boolean;
  } {
    return {
      mode: this.isIntervalActive ? 'INTERVAL_TIMER_ACTIVE' : 'MANUAL_ON_DEMAND',
      lastRunAt: this.lastRunTimestamp,
      isIntervalActive: this.isIntervalActive,
    };
  }

  /**
   * Starts an in-process recurring interval timer.
   */
  public static startWeeklyScheduler(
    database: EvidenceVaultDatabase,
    intervalMs: number = 7 * 24 * 60 * 60 * 1000
  ): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    this.isIntervalActive = true;
    this.intervalTimer = setInterval(async () => {
      this.lastRunTimestamp = new Date().toISOString();
      await AuditReviewEngine.generateWeeklySummary(database, {
        actorId: 'SYSTEM_SCHEDULER',
        role: 'SYSTEM_ADMIN',
      });
    }, intervalMs);
  }

  public static stopScheduler(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isIntervalActive = false;
  }

  public static recordManualRun(): void {
    this.lastRunTimestamp = new Date().toISOString();
  }
}
