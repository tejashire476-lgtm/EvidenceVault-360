// ============================================================================
// EVIDENCEVAULT 360 — SHARED DATA ARCHITECTURE TYPES
// "One Case. Three Departments. Traceable Evidence."
// ============================================================================

// ----------------------------------------------------------------------------
// Department & RBAC User Definitions
// ----------------------------------------------------------------------------
export type Department = 'POLICE' | 'FORENSIC' | 'PROSECUTION' | 'ADMINISTRATION';

export type UserRole =
  | 'POLICE_INVESTIGATOR'
  | 'FORENSIC_EXAMINER'
  | 'PUBLIC_PROSECUTOR'
  | 'SYSTEM_ADMIN'
  | 'UNAUTHENTICATED';

export type UserActiveStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  display_name: string;
  role: UserRole;
  active_status: UserActiveStatus;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Case Management
// ----------------------------------------------------------------------------
export type CaseStatus =
  | 'OPEN'
  | 'UNDER_INVESTIGATION'
  | 'PENDING_FORENSICS'
  | 'PROSECUTION_REVIEW'
  | 'SEALED'
  | 'ARCHIVED';

export interface Case {
  id: string;
  case_reference: string; // Human-readable unique reference (e.g., 'EV-CASE-2026-001')
  title: string;
  category: string;
  incident_date: string | null;
  assigned_officer_id: string | null; // FK to User
  status: CaseStatus;
  created_by: string; // FK to User
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// Evidence Records & File Versions
// ----------------------------------------------------------------------------
export type EvidenceType =
  | 'DISK_IMAGE'
  | 'NETWORK_CAPTURE'
  | 'MEMORY_DUMP'
  | 'SYSTEM_LOG'
  | 'MOBILE_EXTRACTION'
  | 'DATABASE_DUMP'
  | 'DOCUMENT'
  | 'MEDIA';

export type EvidenceWorkflowStatus =
  | 'ACQUIRED'
  | 'SUBMITTED_TO_FORENSICS'
  | 'IN_FORENSIC_CUSTODY'
  | 'EXAMINED'
  | 'PROSECUTION_READY'
  | 'JUDICIAL_SEALED';

export interface EvidenceRecord {
  id: string;
  case_id: string; // FK to Case
  description: string;
  evidence_type: EvidenceType;
  source_description: string;
  collected_by: string; // FK to User
  collected_at: string;
  current_status: EvidenceWorkflowStatus;
  created_by: string; // FK to User
  created_at: string;
}

export interface EvidenceFileVersion {
  id: string;
  evidence_id: string; // FK to EvidenceRecord
  original_filename: string;
  generated_storage_key: string;
  content_type: string;
  file_size: number;
  sha256_hash: string;
  baseline_created_at: string;
  uploaded_by: string; // FK to User
  created_at: string;
}

// ----------------------------------------------------------------------------
// Evidence Department Handoffs
// ----------------------------------------------------------------------------
export type HandoffStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RECEIVED'
  | 'UNDER_EXAMINATION'
  | 'REPORT_READY'
  | 'RETURNED';

export interface EvidenceHandoff {
  id: string;
  evidence_id: string; // FK to EvidenceRecord
  source_department: Department;
  destination_department: Department;
  submitted_by: string; // FK to User
  received_by: string | null; // FK to User
  status: HandoffStatus;
  submitted_at: string;
  acknowledged_at: string | null;
  rejection_reason: string | null;
}

// ----------------------------------------------------------------------------
// Chain-of-Custody Events
// ----------------------------------------------------------------------------
export interface CustodyEvent {
  id: string;
  case_id: string; // FK to Case
  evidence_id: string; // FK to EvidenceRecord
  actor_id: string | null; // FK to User
  action: string;
  source: string;
  destination: string;
  timestamp: string;
  previous_event_id: string | null; // Pointer to previous custody event
  metadata: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Cryptographic Integrity Verification Results
// ----------------------------------------------------------------------------
export type VerificationResultStatus = 'MATCH' | 'MISMATCH' | 'ERROR';

export interface ProviderIntegrityCheck {
  provider: string; // e.g. 'CLOUDFLARE_R2'
  etag?: string; // Provider-side MD5 or compound multi-part ETag
  encryptionAtRest: string; // 'AES-256 (SSE-S3)'
  transportProtocol: string; // 'TLS 1.3 HTTPS'
  transportVerified: boolean;
}

export interface IntegrityVerificationResult {
  id: string;
  evidence_id: string; // FK to EvidenceRecord
  file_version_id: string; // FK to EvidenceFileVersion
  expected_sha256: string;
  observed_sha256: string;
  result: VerificationResultStatus;
  verified_by: string; // FK to User
  verified_by_role?: UserRole;
  verified_at: string;
  duration_ms: number;
  byte_size: number;
  verification_mode: 'STREAMING_CHUNKS' | 'BUFFER';
  storage_key?: string;
  error_reason?: string | null;
  provider_integrity?: ProviderIntegrityCheck;
}

// ----------------------------------------------------------------------------
// Forensic Reports (Version-Preserved)
// ----------------------------------------------------------------------------
export type ForensicReportStatus =
  | 'DRAFT'
  | 'FINALIZED'
  | 'SUBMITTED_TO_PROSECUTION'
  | 'AMENDED';

export interface ForensicReport {
  id: string;
  case_id: string; // FK to Case
  evidence_id: string; // FK to EvidenceRecord
  version_number: number;
  report_content: string;
  status: ForensicReportStatus;
  author_id: string; // FK to User
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// Prosecution Reviews
// ----------------------------------------------------------------------------
export type ProsecutionReviewStatus =
  | 'PENDING_REVIEW'
  | 'ACCEPTED_FOR_TRIAL'
  | 'FURTHER_EVIDENCE_REQUESTED'
  | 'DISMISSED';

export interface ProsecutionReview {
  id: string;
  case_id: string; // FK to Case
  report_id: string; // FK to ForensicReport
  reviewer_id: string; // FK to User
  status: ProsecutionReviewStatus;
  review_notes: string;
  created_at: string;
  updated_at: string;
  // Forensic Clarification Interaction Lifecycle
  clarification_status?: 'PENDING' | 'RESPONDED';
  clarification_response?: string;
  clarification_responder_id?: string;
  clarification_responded_at?: string;
  resulting_report_id?: string;
}

// ----------------------------------------------------------------------------
// Audit Events (Hash-Linked Tamper-Evident Ledger)
// ----------------------------------------------------------------------------
export interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  event_payload: Record<string, unknown>;
  payload?: Record<string, unknown>;
  previous_event_hash: string | null;
  event_hash: string;
  // Admin-accessible enriched audit metadata
  actor_role?: UserRole;
  department?: Department;
  ip_address?: string;
  user_agent?: string;
  status?: 'SUCCESS' | 'FAILURE';
  reason?: string | null;
}

export interface AuditChainVerificationResult {
  isValid: boolean;
  totalBlocks: number;
  verifiedBlocks: number;
  brokenBlockId?: string;
  brokenBlockIndex?: number;
  errorMessage?: string;
  verifiedAt: string;
}

export interface ComplianceAuditReport {
  id: string;
  generatedAt: string;
  generatedBy: string;
  totalCases: number;
  totalEvidence: number;
  totalReports: number;
  totalVerificationChecks: number;
  failedIntegrityChecks: number;
  pendingCustodyHandoffs: number;
  auditChainStatus: 'INTACT' | 'COMPROMISED';
  findings: string[];
}

export interface CaseEvidenceIndex {
  caseId: string;
  caseReference: string;
  caseTitle: string;
  caseStatus: CaseStatus;
  incidentDate: string | null;
  assignedOfficer: string | null;
  totalEvidenceCount: number;
  totalFileVersions: number;
  totalReportsCount: number;
  evidenceItems: {
    evidenceId: string;
    description: string;
    evidenceType: EvidenceType;
    status: EvidenceWorkflowStatus;
    handoffStatus: HandoffStatus | 'NO_HANDOFF';
    collectedBy: string;
    collectedAt: string;
    files: {
      id: string;
      filename: string;
      fileSize: number;
      sha256Hash: string;
    }[];
    reports: {
      reportId: string;
      versionNumber: number;
      status: ForensicReportStatus;
      authorId: string;
      createdAt: string;
      summary: string;
    }[];
    custodyChainLength: number;
  }[];
  prosecutionReviews: ProsecutionReview[];
  trialReadiness: 'READY_FOR_TRIAL' | 'INCOMPLETE_EVIDENCE' | 'FORENSICS_PENDING' | 'REJECTED';
  generatedAt: string;
}

export interface EvidenceCompletenessCheck {
  evidenceId: string;
  description: string;
  hasFileMetadata: boolean;
  hasForensicHandoff: boolean;
  handoffStatus: HandoffStatus | 'NONE';
  hasForensicReport: boolean;
  reportCount: number;
  isComplete: boolean;
  missingItems: string[];
}

// ----------------------------------------------------------------------------
// Phase 3: Large-File Secure Storage & Object Engine Types
// ----------------------------------------------------------------------------
export type StorageProviderType = 'CLOUDFLARE_R2' | 'LOCAL_OBJECT_STORE';

export interface StorageProviderConfig {
  provider: StorageProviderType;
  bucketName: string;
  accountId?: string;
  maxSizeBytes: number;
  signedUrlTtlSeconds: number;
  encryptionAlgorithm: string;
}

export interface MultipartUploadPart {
  partNumber: number;
  etag: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface MultipartUploadSession {
  uploadId: string;
  caseId: string;
  evidenceId: string;
  versionId: string;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  totalSizeBytes: number;
  evidenceType?: EvidenceType;
  expectedSha256?: string;
  parts: MultipartUploadPart[];
  status: 'INITIALIZED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';
  initiatedAt: string;
  completedAt?: string;
  uploadedBy: string;
}

export interface UploadProgressEvent {
  uploadId: string;
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSec: number;
  activeChunkIndex: number;
  totalChunks: number;
}

export interface StorageMetricsReport {
  provider: StorageProviderType;
  bucketName: string;
  totalStoredBytes: number;
  totalStoredFormatted: string;
  totalObjectsCount: number;
  classAOperations: number;
  classBOperations: number;
  freeTierStorageLimitBytes: number;
  estimatedMonthlyCostUSD: number;
  egressCostUSD: number;
  quotaLimitBytes: number;
  quotaUsedPercent: number;
  encryptionStandard: string;
  retentionPolicy: string;
  lastUpdated: string;
}

export interface SignedUrlResult {
  url: string;
  storageKey: string;
  expiresAt: string;
  authorizedRole: UserRole;
  method: 'GET' | 'PUT';
}

export interface FileValidationResult {
  isValid: boolean;
  sanitizedFilename: string;
  sanitizedStorageKey: string;
  errorMessage?: string;
  detectedMimeType: string;
  categoryLimitBytes: number;
}

// ----------------------------------------------------------------------------
// Navigation & Backward-Compatibility Types for Legacy Sample References
// ----------------------------------------------------------------------------
export type NavigationSection =
  | 'overview'
  | 'police'
  | 'forensic'
  | 'prosecution'
  | 'cases'
  | 'evidence-vault'
  | 'integrity-verification'
  | 'chain-of-custody'
  | 'audit-logs'
  | 'access-control'
  | 'settings';

export type CasePriority = 'High' | 'Medium' | 'Low';

export type LegacyCaseStatus = 'Open' | 'In Review' | 'Sealed' | 'Archived';

export interface CaseRecord {
  id: string;
  title: string;
  status: CaseStatus | LegacyCaseStatus;
  priority: CasePriority;
  leadInvestigator: string;
  department: string;
  createdAt: string;
  evidenceCount: number;
  description: string;
}

export interface LegacyCustodyEvent {
  id: string;
  evidenceId: string;
  caseId: string;
  timestamp: string;
  action: string;
  handler: string;
  handlerRole: string;
  workstationOrLocation: string;
  reason: string;
  signatureStatus: 'Recorded (Sample Only)' | 'Unsigned' | 'Awaiting Engine';
}

export type EvidenceCategory =
  | 'Disk Image'
  | 'Network Capture'
  | 'Memory Dump'
  | 'System Log'
  | 'Mobile Extraction'
  | 'Database Dump';

export type EvidenceStatus =
  | 'Acquired'
  | 'Under Analysis'
  | 'Pending Verification'
  | 'Sealed'
  | 'Integrity Alert';

export interface LegacyEvidenceRecord {
  id: string;
  fileName: string;
  caseId: string;
  category: EvidenceCategory;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  uploadedAt: string;
  uploadedBy: string;
  hashAlgorithm: string;
  originalHash: string;
  currentStatus: EvidenceStatus;
  integrityVerifiedInPhase1: boolean;
  storageLocation: string;
  notes: string;
}

export type AuditActionType =
  | 'RECORD_ACCESS'
  | 'CASE_QUERY'
  | 'SEARCH_EXECUTED'
  | 'EXPORT_ATTEMPT'
  | 'AUTH_CHALLENGE'
  | 'SETTINGS_VIEW'
  | 'METADATA_INSPECT';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: AuditActionType;
  resourceTarget: string;
  ipAddress: string;
  workstation: string;
  result: 'SUCCESS' | 'FLAGGED' | 'DENIED' | 'INFO';
  details: string;
}

export interface RoleDefinition {
  name: string;
  tagline: string;
  badgeColor: string;
  permissions: {
    name: string;
    description: string;
    granted: boolean;
  }[];
  userCount: number;
}

export interface SampleUser {
  id: string;
  name: string;
  badgeNumber: string;
  email: string;
  role: 'Administrator' | 'Investigator' | 'Auditor';
  status: 'Active' | 'Suspended';
  assignedCases: number;
}

// ============================================================================
// Phase 6: Role-Based Access Control, Session Security & Rate Limiting Types
// ============================================================================

export interface SecurityContext {
  actorId: string;
  role: UserRole;
  department?: Department;
  sessionId?: string;
  ipAddress?: string;
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  role: UserRole;
  department: Department;
  badge: string;
  issuedAt: string;
  expiresAt: string;
  activeStatus: UserActiveStatus;
  tokenSignature: string;
}

export type SecurityViolationType =
  | 'UNAUTHORIZED_ROLE_ACTION'
  | 'UNAUTHORIZED_ROLE'
  | 'AUTHENTICATION_FAILURE'
  | 'IDOR_ACCESS_DENIED'
  | 'PATH_TRAVERSAL_ATTEMPT'
  | 'EXPIRED_OR_INVALID_SESSION'
  | 'SUSPENDED_USER_ATTEMPT'
  | 'TAMPERED_TOKEN'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MALFORMED_REQUEST_DATA'
  | 'UNAUTHORIZED_DOWNLOAD_ATTEMPT';

export interface SecurityAuditLogEntry {
  id: string;
  violationType: SecurityViolationType;
  actorId: string | null;
  actorRole: string | null;
  attemptedAction: string;
  resource: string;
  reason: string;
  timestamp: string;
  ipAddress?: string;
  sanitizedPayload?: Record<string, unknown>;
}

// ============================================================================
// Phase 7: Offline Mode & Safe Data Synchronization Types
// ============================================================================

export type NetworkSyncStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'SYNCING'
  | 'SYNC_FAILED'
  | 'PARTIAL_SYNC';

export type OfflineActionType =
  | 'CREATE_CASE'
  | 'REGISTER_EVIDENCE'
  | 'CREATE_HANDOFF'
  | 'RECORD_CUSTODY'
  | 'TRANSITION_HANDOFF';

export type OfflineEventStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'SYNCED'
  | 'REJECTED'
  | 'CONFLICT';

export interface OfflineConflictDetails {
  expectedState: string;
  serverState: string;
  reason: string;
  detectedAt: string;
}

export interface OfflineQueueItem {
  eventId: string;
  idempotencyKey: string;
  action: OfflineActionType;
  actorId: string;
  actorRole: UserRole;
  actorDepartment: Department;
  sessionToken?: string;
  baseVersion?: string; // Optimistic concurrency: timestamp or status at queue time
  targetEntityId?: string;
  payload: Record<string, unknown>;
  queuedAt: string;
  status: OfflineEventStatus;
  retryCount: number;
  lastError?: string | null;
  syncedAt?: string | null;
  serverEntityId?: string | null;
  conflictDetails?: OfflineConflictDetails | null;
}

export interface SyncBatchSummary {
  batchId: string;
  initiatedAt: string;
  completedAt: string;
  totalEvents: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  rejectedCount: number;
  items: {
    eventId: string;
    action: OfflineActionType;
    status: OfflineEventStatus;
    message: string;
    serverEntityId?: string | null;
  }[];
}

export interface ApprovedOfflineCaseMetadata {
  id: string;
  case_reference: string;
  title: string;
  category: string;
  status: CaseStatus;
  assigned_officer_id: string | null;
  created_at: string;
}

export interface ApprovedOfflineEvidenceMetadata {
  id: string;
  case_id: string;
  description: string;
  evidence_type: EvidenceType;
  current_status: EvidenceWorkflowStatus;
  collected_at: string;
  sha256_hash?: string;
  // NOTE: Original files and reports are strictly excluded by policy
}

export interface ApprovedOfflineMetadataCache {
  cachedAt: string;
  cachedForUserId: string;
  cases: ApprovedOfflineCaseMetadata[];
  evidenceSummary: ApprovedOfflineEvidenceMetadata[];
  cacheChecksum: string;
  cacheNotice: string;
}

// ============================================================================
// Phase 8: Offline Face Verification & Biometric MFA Types
// ============================================================================

export type BiometricConsentStatus = 'GRANTED' | 'WITHDRAWN' | 'NOT_REQUESTED';

export type BiometricVerificationOutcome =
  | 'MATCH'
  | 'MISMATCH'
  | 'LIVENESS_FAILED'
  | 'CONSENT_DENIED'
  | 'TIMEOUT'
  | 'FALLBACK_TRIGGERED';

export interface BiometricTemplate {
  templateId: string;
  userId: string;
  algorithm: 'EVIDENCEVAULT_FACENET_EMBEDDING_128D';
  vectorValues: number[]; // 128D unit-normalized feature vector
  embeddingDigest: string; // SHA-256 HMAC digest of normalized 128D vector
  enrolledAt: string;
  consentTimestamp: string;
  consentVersion: string;
  hardwareSalt: string;
  qualityScore: number; // 0.0 - 1.0
}

export interface BiometricVerificationResult {
  attemptId: string;
  userId: string;
  outcome: BiometricVerificationOutcome;
  similarityScore: number; // 0.0 - 1.0 (cosine similarity)
  threshold: number; // e.g. 0.85
  isMatch: boolean;
  livenessPassed: boolean;
  livenessMethod: 'INTERACTIVE_CHALLENGE_RESPONSE' | 'SIMULATED_OPTICAL' | 'NONE';
  durationMs: number;
  verifiedAt: string;
  errorMessage?: string | null;
  fallbackAvailable: boolean;
}

export interface BiometricEnrollmentRequest {
  userId: string;
  consentGranted: boolean;
  syntheticIdentityRole?: UserRole;
  faceFeatures128D?: number[];
}

export interface BiometricFeasibilityReport {
  assessedAt: string;
  feasibilityScore: number; // e.g. 85 / 100
  status: 'CONDITIONALLY_FEASIBLE_AS_MFA_ONLY';
  supportedBrowsers: string[];
  recommendedModel: string;
  onDeviceStorageStrategy: string;
  knownPresentationAttackVulnerabilities: string[];
  estimatedFAR: string;
  estimatedFRR: string;
  judicialComplianceNotice: string;
}

// ============================================================================
// Phase 9: Weekly Audit, Review Dashboard & Report Export Types
// ============================================================================

export type AuditFindingClassification =
  | 'CONFIRMED_FINDING'     // Cryptographically verified discrepancy or confirmed security violation
  | 'WARNING'               // Operational delay, missing recommended report, or approaching SLA threshold
  | 'UNVERIFIED_SUSPICION'; // Statistical or behavioural anomaly requiring forensic examiner verification

export type AuditFindingCategory =
  | 'INTEGRITY_MISMATCH'
  | 'BROKEN_AUDIT_CHAIN'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'PERMISSION_OR_ROLE_CHANGE'
  | 'MISSING_TRANSFER_ACK'
  | 'DELAYED_WORKFLOW_STEP'
  | 'MISSING_REQUIRED_METADATA_OR_REPORTS';

export type AuditFindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AuditDashboardFinding {
  findingId: string;
  classification: AuditFindingClassification;
  severity: AuditFindingSeverity;
  category: AuditFindingCategory;
  title: string;
  description: string;
  caseId: string;
  eventId?: string;
  timestamp: string;
  sourceRecordType: 'EVIDENCE' | 'AUDIT_LEDGER' | 'HANDOFF' | 'SECURITY_VIOLATION' | 'REPORT' | 'PERMISSION';
  sourceRecordId: string;
  evidenceId?: string;
  recommendedAction: string;
}

export interface WeeklyAuditSummary {
  periodStartDate: string;
  periodEndDate: string;
  generatedAt: string;
  generatedBy: string;
  actorRole: UserRole;
  auditChainIntegrityStatus: 'INTACT' | 'COMPROMISED';
  totalAuditBlocksEvaluated: number;
  totalIntegrityChecksInPeriod: number;
  matchedIntegrityCount: number;
  mismatchedIntegrityCount: number;
  errorIntegrityCount: number;
  securityViolationAttempts: number;
  permissionChangesCount: number;
  pendingTransferHandoffs: number;
  totalFindingsCount: number;
  confirmedFindingsCount: number;
  warningsCount: number;
  unverifiedSuspicionsCount: number;
  findings: AuditDashboardFinding[];
  limitationsDisclaimer: string;
}

export interface CaseEvidenceIndexEntry {
  evidenceId: string;
  evidenceCode: string;
  caseId: string;
  caseReference: string;
  category: EvidenceType;
  description: string;
  collectedAt: string;
  collectedBy: string;
  baselineSha256: string;
  currentVerificationOutcome: 'MATCH' | 'MISMATCH' | 'ERROR' | 'UNVERIFIED';
  storageObjectKey: string;
  custodyTransferCount: number;
  hasForensicReport: boolean;
  courtAdmissibilityStatus: 'ADMISSIBLE_CERTIFIED_65B' | 'DEFECT_SUSPECTED' | 'PENDING_FORENSIC_REVIEW';
}

export interface ProsecutionCaseEvidenceIndexReport {
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  generatedByBadge: string;
  caseId: string;
  caseReference: string;
  caseTitle: string;
  totalEvidenceItems: number;
  verifiedIntegrityCount: number;
  unverifiedOrDefectiveCount: number;
  entries: CaseEvidenceIndexEntry[];
  judicialCertificationSection65B: string;
  reportLimitations: string;
}

export interface AuditReportFilterOptions {
  startDate?: string;
  endDate?: string;
  caseId?: string;
  category?: AuditFindingCategory;
  classification?: AuditFindingClassification;
  severity?: AuditFindingSeverity;
}

// ============================================================================
// Dedicated Admin Dashboard & Restricted Audit Logs Types
// ============================================================================
export type AdminDashboardTab =
  | 'OVERVIEW'
  | 'USERS'
  | 'AUDIT_LOGS'
  | 'SECURITY'
  | 'HEALTH'
  | 'REPORTS';

export interface AuditLogQueryFilter {
  startDate?: string;
  endDate?: string;
  department?: Department | 'ALL';
  userId?: string;
  action?: string;
  actionType?: string;
  targetId?: string;
  caseOrEvidenceId?: string;
  searchQuery?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogPaginatedResponse {
  events: AuditEvent[];
  items: AuditEvent[];
  total: number;
  totalCount: number;
  page: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

export interface SystemHealthReport {
  timestamp: string;
  database: {
    status: 'HEALTHY' | 'DEGRADED';
    totalCases: number;
    totalEvidence: number;
    totalUsers: number;
    totalAuditBlocks: number;
    total_cases?: number;
    total_users?: number;
  };
  storage: {
    status: 'CONNECTED' | 'DISCONNECTED' | 'HEALTHY';
    provider: string;
    totalObjects: number;
    totalBytes: number;
    encryptedAtRest: boolean;
    quota_bytes?: number;
  };
  cryptography: {
    status: 'OPERATIONAL' | 'DEGRADED' | 'HEALTHY';
    algorithm: string;
    streamingHasherReady: boolean;
    fips_mode?: string;
  };
  crypto?: {
    status: 'OPERATIONAL' | 'DEGRADED' | 'HEALTHY';
    algorithm: string;
    streamingHasherReady: boolean;
    fips_mode?: string;
  };
  auditChain: {
    status: 'INTACT' | 'COMPROMISED' | 'HEALTHY';
    totalBlocks: number;
    verifiedBlocks: number;
    lastVerifiedAt: string;
    broken_links?: number;
    verified_blocks?: number;
  };
  audit_chain?: {
    status: 'INTACT' | 'COMPROMISED' | 'HEALTHY';
    totalBlocks?: number;
    verifiedBlocks?: number;
    lastVerifiedAt?: string;
    broken_links?: number;
    verified_blocks?: number;
  };
}

export interface AuthenticatedSession {
  user_id: string;
  name: string;
  role: UserRole;
  department: Department;
  badge: string;
}

export const DEPARTMENT_PRESETS: Record<Department, AuthenticatedSession> = {
  POLICE: {
    user_id: 'USR-POLICE-01',
    name: 'Inspector Rajesh Sharma',
    role: 'POLICE_INVESTIGATOR',
    department: 'POLICE',
    badge: 'DL-POLICE-CID-4829',
  },
  FORENSIC: {
    user_id: 'USR-FORENSIC-01',
    name: 'Dr. Sunita Kulkarni',
    role: 'FORENSIC_EXAMINER',
    department: 'FORENSIC',
    badge: 'CFSL-EXAMINER-7714',
  },
  PROSECUTION: {
    user_id: 'USR-PROSECUTOR-01',
    name: 'Adv. Priya Mehta',
    role: 'PUBLIC_PROSECUTOR',
    department: 'PROSECUTION',
    badge: 'DPP-PROSECUTOR-1092',
  },
  ADMINISTRATION: {
    user_id: 'USR-ADMIN-01',
    name: 'Director Vikramaditya Roy',
    role: 'SYSTEM_ADMIN',
    department: 'ADMINISTRATION',
    badge: 'DIR-NAT-SECURITY-001',
  },
};

export const DEFAULT_ADMIN_USER: AuthenticatedSession = {
  user_id: 'USR-ADMIN-TEJAS',
  name: 'Tejas',
  role: 'SYSTEM_ADMIN',
  department: 'ADMINISTRATION',
  badge: 'EV-ADMIN-360',
};
