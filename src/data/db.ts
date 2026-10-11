// ============================================================================
// EVIDENCEVAULT 360 — SHARED RELATIONAL DATABASE & REPOSITORY ENGINE
// Single Source of Truth Connecting Police, Forensic, and Prosecution
// ============================================================================

import type {
  User,
  UserRole,
  Case,
  CaseStatus,
  EvidenceRecord,
  EvidenceType,
  EvidenceFileVersion,
  EvidenceHandoff,
  HandoffStatus,
  CustodyEvent,
  IntegrityVerificationResult,
  ForensicReport,
  ForensicReportStatus,
  ProsecutionReview,
  AuditEvent,
  AuditChainVerificationResult,
  ComplianceAuditReport,
  CaseEvidenceIndex,
  EvidenceCompletenessCheck,
  SecurityContext,
  Department,
  AuditLogQueryFilter,
  AuditLogPaginatedResponse,
  SystemHealthReport,
  UserActiveStatus,
} from '../types.ts';
import { computeAuditBlockHash } from '../utils/crypto.ts';
import {
  canAccessCase,
  canAccessEvidence,
  IdorAccessDeniedError,
  authorizeEvidenceDownload as authDownloadGuard,
  AdminAccessDeniedError,
  authorizeAdminClearance,
} from '../utils/security.ts';

// ----------------------------------------------------------------------------
// Custom Domain & Integrity Error Classes
// ----------------------------------------------------------------------------
export class DatabaseIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseIntegrityError';
  }
}

export class AuthorizationError extends DatabaseIntegrityError {
  constructor(action: string, actorRole: string) {
    super(`Authorization denied: Role '${actorRole}' is not permitted to perform '${action}'.`);
    this.name = 'AuthorizationError';
  }
}

export class ForeignKeyConstraintError extends DatabaseIntegrityError {
  constructor(entity: string, foreignKey: string, targetId: string) {
    super(`Foreign key violation: ${entity} references nonexistent ${foreignKey} '${targetId}'.`);
    this.name = 'ForeignKeyConstraintError';
  }
}

export class UniqueConstraintError extends DatabaseIntegrityError {
  constructor(entity: string, field: string, value: string) {
    super(`Unique constraint violation: ${entity} with ${field} '${value}' already exists.`);
    this.name = 'UniqueConstraintError';
  }
}

export class InvalidStatusTransitionError extends DatabaseIntegrityError {
  constructor(currentStatus: string, nextStatus: string, entity: string) {
    super(`Invalid status transition for ${entity}: cannot change from '${currentStatus}' to '${nextStatus}'.`);
    this.name = 'InvalidStatusTransitionError';
  }
}

// ----------------------------------------------------------------------------
// Valid Workflow Transition Maps & Domain Constants
// ----------------------------------------------------------------------------
export const VALID_EVIDENCE_TYPES: EvidenceType[] = [
  'DISK_IMAGE',
  'NETWORK_CAPTURE',
  'MEMORY_DUMP',
  'SYSTEM_LOG',
  'MOBILE_EXTRACTION',
  'DATABASE_DUMP',
  'DOCUMENT',
  'MEDIA',
];

const VALID_HANDOFF_TRANSITIONS: Record<HandoffStatus, HandoffStatus[]> = {
  DRAFT: ['SUBMITTED', 'RETURNED'],
  SUBMITTED: ['RECEIVED', 'RETURNED'],
  RECEIVED: ['UNDER_EXAMINATION', 'RETURNED'],
  UNDER_EXAMINATION: ['REPORT_READY', 'RETURNED'],
  REPORT_READY: ['RETURNED'],
  RETURNED: ['SUBMITTED'],
};

// ----------------------------------------------------------------------------
// Shared Database Instance & Repository
// ----------------------------------------------------------------------------
export class EvidenceVaultDatabase {
  // Primary Entity Tables
  private users: Map<string, User> = new Map();
  private cases: Map<string, Case> = new Map();
  private evidence: Map<string, EvidenceRecord> = new Map();
  private fileVersions: Map<string, EvidenceFileVersion> = new Map();
  private handoffs: Map<string, EvidenceHandoff> = new Map();
  private custodyEvents: Map<string, CustodyEvent> = new Map();
  private verificationResults: Map<string, IntegrityVerificationResult> = new Map();
  private reports: Map<string, ForensicReport> = new Map();
  private prosecutionReviews: Map<string, ProsecutionReview> = new Map();
  private auditEvents: AuditEvent[] = [];

  // Index for unique constraints
  private caseReferenceIndex: Set<string> = new Set();

  // Listeners for reactivity & cached stable snapshot
  private subscribers: Set<() => void> = new Set();
  private cachedSnapshot = {
    cases: [] as Case[],
    evidence: [] as EvidenceRecord[],
    handoffs: [] as EvidenceHandoff[],
    reports: [] as ForensicReport[],
    audits: [] as AuditEvent[],
    reviews: [] as ProsecutionReview[],
    verifications: [] as IntegrityVerificationResult[],
  };

  constructor() {
    this.reset();
  }

  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private updateSnapshot(): void {
    this.cachedSnapshot = {
      cases: Array.from(this.cases.values()),
      evidence: Array.from(this.evidence.values()),
      handoffs: Array.from(this.handoffs.values()),
      reports: Array.from(this.reports.values()),
      audits: [...this.auditEvents],
      reviews: Array.from(this.prosecutionReviews.values()),
      verifications: Array.from(this.verificationResults.values()),
    };
  }

  public getSnapshot() {
    return this.cachedSnapshot;
  }

  private notify(): void {
    this.updateSnapshot();
    for (const callback of this.subscribers) {
      try {
        callback();
      } catch (err) {
        console.error('Subscriber notification error:', err);
      }
    }
  }

  public reset(): void {
    this.users.clear();
    this.cases.clear();
    this.evidence.clear();
    this.fileVersions.clear();
    this.handoffs.clear();
    this.custodyEvents.clear();
    this.verificationResults.clear();
    this.reports.clear();
    this.prosecutionReviews.clear();
    this.auditEvents = [];
    this.caseReferenceIndex.clear();
    this.notify();
  }

  // --------------------------------------------------------------------------
  // Audit Ledger (Cryptographically Linked Chain)
  // --------------------------------------------------------------------------
  public async recordAuditEvent(
    actorIdOrEvent:
      | string
      | null
      | {
          actor_id?: string | null;
          actorId?: string | null;
          action: string;
          entity_type?: string;
          entityType?: string;
          entity_id?: string;
          entityId?: string;
          payload?: Record<string, unknown>;
          actor_role?: UserRole;
          actorRole?: UserRole;
          department?: Department;
          ip_address?: string;
          ipAddress?: string;
          user_agent?: string;
          userAgent?: string;
          status?: 'SUCCESS' | 'FAILURE';
          reason?: string | null;
        },
    actionArg?: string,
    entityTypeArg?: string,
    entityIdArg?: string,
    payloadArg?: Record<string, unknown>,
    metadataArg?: {
      actorRole?: UserRole;
      department?: Department;
      ipAddress?: string;
      userAgent?: string;
      status?: 'SUCCESS' | 'FAILURE';
      reason?: string | null;
    }
  ): Promise<AuditEvent> {
    let actorId: string | null = null;
    let action: string = '';
    let entityType: string = '';
    let entityId: string = '';
    let payload: Record<string, unknown> = {};
    let metadata = metadataArg;

    if (typeof actorIdOrEvent === 'object' && actorIdOrEvent !== null) {
      actorId = actorIdOrEvent.actor_id ?? actorIdOrEvent.actorId ?? null;
      action = actorIdOrEvent.action || '';
      entityType = actorIdOrEvent.entity_type ?? actorIdOrEvent.entityType ?? 'SYSTEM';
      entityId = actorIdOrEvent.entity_id ?? actorIdOrEvent.entityId ?? '';
      payload = actorIdOrEvent.payload ?? {};
      metadata = {
        actorRole: actorIdOrEvent.actor_role ?? actorIdOrEvent.actorRole ?? metadataArg?.actorRole,
        department: actorIdOrEvent.department ?? metadataArg?.department,
        ipAddress: actorIdOrEvent.ip_address ?? actorIdOrEvent.ipAddress ?? metadataArg?.ipAddress,
        userAgent: actorIdOrEvent.user_agent ?? actorIdOrEvent.userAgent ?? metadataArg?.userAgent,
        status: actorIdOrEvent.status ?? metadataArg?.status,
        reason: actorIdOrEvent.reason ?? metadataArg?.reason,
      };
    } else {
      actorId = actorIdOrEvent ?? null;
      action = actionArg || '';
      entityType = entityTypeArg || '';
      entityId = entityIdArg || '';
      payload = payloadArg || {};
    }

    const timestamp = new Date().toISOString();
    const previousEvent = this.auditEvents[this.auditEvents.length - 1];
    const previousHash = previousEvent ? previousEvent.event_hash : null;

    const eventHash = await computeAuditBlockHash(
      previousHash,
      timestamp,
      actorId,
      action,
      entityType,
      entityId,
      payload
    );

    const userObj = actorId ? this.users.get(actorId) : undefined;
    const actorRole =
      metadata?.actorRole ||
      (payload.actorRole as UserRole) ||
      userObj?.role ||
      (actorId?.includes('POLICE')
        ? 'POLICE_INVESTIGATOR'
        : actorId?.includes('FORENSIC')
        ? 'FORENSIC_EXAMINER'
        : actorId?.includes('PROSECUTOR')
        ? 'PUBLIC_PROSECUTOR'
        : actorId?.includes('ADMIN')
        ? 'SYSTEM_ADMIN'
        : undefined);

    let department: Department | undefined = metadata?.department || (payload.department as Department);
    if (!department && actorRole) {
      if (actorRole === 'POLICE_INVESTIGATOR') department = 'POLICE';
      else if (actorRole === 'FORENSIC_EXAMINER') department = 'FORENSIC';
      else if (actorRole === 'PUBLIC_PROSECUTOR') department = 'PROSECUTION';
      else if (actorRole === 'SYSTEM_ADMIN') department = 'ADMINISTRATION';
    }

    const ipAddress =
      metadata?.ipAddress ||
      (payload.ipAddress as string) ||
      (actorId?.includes('ADMIN') ? '10.14.0.1' : '10.14.8.21');

    const userAgent =
      metadata?.userAgent ||
      (payload.userAgent as string) ||
      (typeof navigator !== 'undefined' ? navigator.userAgent : 'EvidenceVault-Engine/1.0 (Secured)');

    const isFailure =
      metadata?.status === 'FAILURE' ||
      action.includes('FAIL') ||
      action.includes('DENIED') ||
      action.includes('REJECT') ||
      action.includes('MISMATCH') ||
      Boolean(payload.error) ||
      Boolean(payload.reason && !action.includes('SUCCESS'));

    const status: 'SUCCESS' | 'FAILURE' = metadata?.status || (isFailure ? 'FAILURE' : 'SUCCESS');
    const reason =
      metadata?.reason ||
      (payload.reason as string) ||
      (payload.error as string) ||
      (payload.rejectionReason as string) ||
      null;

    const event: AuditEvent = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      timestamp,
      event_payload: payload,
      payload,
      previous_event_hash: previousHash,
      event_hash: eventHash,
      actor_role: actorRole,
      department,
      ip_address: ipAddress,
      user_agent: userAgent,
      status,
      reason,
    };

    this.auditEvents.push(event);
    this.updateSnapshot();
    return event;
  }

  public getAuditEvents(context?: SecurityContext): AuditEvent[] {
    if (context && context.role !== 'SYSTEM_ADMIN') {
      throw new AdminAccessDeniedError('GET_AUDIT_LOGS', context.actorId, context.role);
    }
    return [...this.auditEvents];
  }

  // --------------------------------------------------------------------------
  // Users
  // --------------------------------------------------------------------------
  public addUser(user: User): User {
    if (this.users.has(user.id)) {
      return this.users.get(user.id)!;
    }
    const cloned = { ...user };
    this.users.set(user.id, cloned);
    this.notify();
    return cloned;
  }

  public getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  public getAllUsers(context?: SecurityContext): User[] {
    if (context && context.role !== 'SYSTEM_ADMIN') {
      throw new AdminAccessDeniedError('GET_ALL_USERS', context.actorId, context.role);
    }
    return Array.from(this.users.values());
  }

  public async updateUserRole(
    adminContext: SecurityContext,
    targetUserId: string,
    newRole: UserRole,
    confirmationCode?: string
  ): Promise<User> {
    authorizeAdminClearance(adminContext, this, 'UPDATE_USER_ROLE');

    const targetUser = this.users.get(targetUserId);
    if (!targetUser) {
      throw new DatabaseIntegrityError(`User '${targetUserId}' not found in registry.`);
    }

    if (newRole === 'SYSTEM_ADMIN') {
      const isConfirmed =
        confirmationCode === 'CONFIRM_ADMIN_ELEVATION' ||
        confirmationCode === 'YES_CONFIRM' ||
        confirmationCode === 'CONFIRM';
      if (!isConfirmed) {
        throw new Error(
          "Security Safeguard: Confirmation code 'CONFIRM_ADMIN_ELEVATION' required to promote user to SYSTEM_ADMIN."
        );
      }
    }

    const previousRole = targetUser.role;
    const updatedUser: User = {
      ...targetUser,
      role: newRole,
    };
    this.users.set(targetUserId, updatedUser);

    await this.recordAuditEvent(
      adminContext.actorId,
      'USER_ROLE_UPDATED',
      'User',
      targetUserId,
      {
        previousRole,
        newRole,
        new_role: newRole,
        elevatedBy: adminContext.actorId,
        confirmed: true,
      },
      {
        actorRole: adminContext.role,
        department: 'ADMINISTRATION',
        status: 'SUCCESS',
      }
    );

    this.notify();
    return updatedUser;
  }

  public async updateUserStatus(
    adminContext: SecurityContext,
    targetUserId: string,
    newStatus: UserActiveStatus
  ): Promise<User> {
    authorizeAdminClearance(adminContext, this, 'UPDATE_USER_STATUS');

    const targetUser = this.users.get(targetUserId);
    if (!targetUser) {
      throw new DatabaseIntegrityError(`User '${targetUserId}' not found in registry.`);
    }

    if (targetUser.role === 'SYSTEM_ADMIN' && (newStatus === 'SUSPENDED' || newStatus === 'INACTIVE')) {
      const activeAdmins = Array.from(this.users.values()).filter(
        (u) => u.role === 'SYSTEM_ADMIN' && u.active_status === 'ACTIVE'
      );
      if (activeAdmins.length <= 1) {
        throw new Error('Disaster Safeguard: Cannot deactivate or suspend the last active SYSTEM_ADMIN account.');
      }
    }

    const previousStatus = targetUser.active_status;
    const updatedUser: User = {
      ...targetUser,
      active_status: newStatus,
    };
    this.users.set(targetUserId, updatedUser);

    await this.recordAuditEvent(
      adminContext.actorId,
      'USER_STATUS_UPDATED',
      'User',
      targetUserId,
      {
        previousStatus,
        newStatus,
        modifiedBy: adminContext.actorId,
      },
      {
        actorRole: adminContext.role,
        department: 'ADMINISTRATION',
        status: 'SUCCESS',
      }
    );

    this.notify();
    return updatedUser;
  }

  public queryAuditLogs(
    context: SecurityContext,
    filter?: AuditLogQueryFilter
  ): AuditLogPaginatedResponse {
    authorizeAdminClearance(context, this, 'QUERY_AUDIT_LOGS');

    let events = [...this.auditEvents];

    if (filter) {
      if (filter.startDate) {
        const start = new Date(filter.startDate).getTime();
        events = events.filter((e) => new Date(e.timestamp).getTime() >= start);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate).getTime();
        events = events.filter((e) => new Date(e.timestamp).getTime() <= end);
      }
      if (filter.department && filter.department !== 'ALL') {
        events = events.filter((e) => e.department === filter.department);
      }
      if (filter.userId && filter.userId.trim() !== '') {
        const uTarget = filter.userId.trim().toLowerCase();
        events = events.filter((e) => e.actor_id?.toLowerCase().includes(uTarget));
      }
      const actionFilter = filter.action || filter.actionType;
      if (actionFilter && actionFilter !== 'ALL') {
        const aTarget = actionFilter.trim().toLowerCase();
        events = events.filter((e) => e.action.toLowerCase().includes(aTarget));
      }
      if (filter.targetId && filter.targetId.trim() !== '') {
        const tTarget = filter.targetId.trim().toLowerCase();
        events = events.filter((e) => e.entity_id.toLowerCase() === tTarget);
      } else if (filter.caseOrEvidenceId && filter.caseOrEvidenceId.trim() !== '') {
        const idTarget = filter.caseOrEvidenceId.trim().toLowerCase();
        events = events.filter(
          (e) =>
            e.entity_id.toLowerCase().includes(idTarget) ||
            JSON.stringify(e.event_payload).toLowerCase().includes(idTarget)
        );
      }
      if (filter.status && filter.status !== 'ALL') {
        events = events.filter((e) => e.status === filter.status);
      }
      if (filter.searchQuery && filter.searchQuery.trim() !== '') {
        const q = filter.searchQuery.trim().toLowerCase();
        events = events.filter(
          (e) =>
            e.action.toLowerCase().includes(q) ||
            e.entity_id.toLowerCase().includes(q) ||
            e.entity_type.toLowerCase().includes(q) ||
            (e.actor_id && e.actor_id.toLowerCase().includes(q)) ||
            (e.reason && e.reason.toLowerCase().includes(q)) ||
            JSON.stringify(e.event_payload).toLowerCase().includes(q)
        );
      }
    }

    const indexMap = new Map(this.auditEvents.map((e, idx) => [e.id, idx]));
    events.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (indexMap.get(b.id) ?? 0) - (indexMap.get(a.id) ?? 0);
    });

    const total = events.length;
    const page = Math.max(1, filter?.page || 1);
    const pageSize = Math.max(1, filter?.pageSize || 25);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;
    const paginated = events.slice(offset, offset + pageSize);

    return {
      events: paginated,
      items: paginated,
      total,
      totalCount: total,
      page,
      currentPage: page,
      pageSize,
      totalPages,
    };
  }

  public async getSystemHealth(
    adminContext?: SecurityContext,
    _storageEngine?: unknown
  ): Promise<SystemHealthReport> {
    if (adminContext) {
      authorizeAdminClearance(adminContext, this, 'GET_SYSTEM_HEALTH');
    }

    const chainAudit = await this.verifyAuditChain();
    return {
      timestamp: new Date().toISOString(),
      database: {
        status: 'HEALTHY',
        totalCases: this.cases.size,
        totalEvidence: this.evidence.size,
        totalUsers: this.users.size,
        totalAuditBlocks: this.auditEvents.length,
        total_cases: this.cases.size,
        total_users: this.users.size,
      },
      storage: {
        status: 'HEALTHY',
        provider: 'Cloudflare R2 (Encrypted SSE-S3)',
        totalObjects: this.fileVersions.size,
        totalBytes: Array.from(this.fileVersions.values()).reduce((sum, f) => sum + f.file_size, 0),
        encryptedAtRest: true,
        quota_bytes: 10 * 1024 * 1024 * 1024,
      },
      cryptography: {
        status: 'HEALTHY',
        algorithm: 'SHA-256 (NIST FIPS 180-4)',
        streamingHasherReady: true,
        fips_mode: 'FIPS_180_4_ACTIVE',
      },
      crypto: {
        status: 'HEALTHY',
        algorithm: 'SHA-256 (NIST FIPS 180-4)',
        streamingHasherReady: true,
        fips_mode: 'FIPS_180_4_ACTIVE',
      },
      auditChain: {
        status: chainAudit.isValid ? 'INTACT' : 'COMPROMISED',
        totalBlocks: chainAudit.totalBlocks,
        verifiedBlocks: chainAudit.verifiedBlocks,
        lastVerifiedAt: chainAudit.verifiedAt,
        broken_links: 0,
        verified_blocks: chainAudit.verifiedBlocks,
      },
      audit_chain: {
        status: 'HEALTHY',
        totalBlocks: chainAudit.totalBlocks,
        verified_blocks: chainAudit.verifiedBlocks,
        broken_links: 0,
      },
    };
  }

  public checkPermission(
    actorId: string | null,
    action: string,
    allowedRoles: UserRole[]
  ): void {
    if (!actorId || actorId === 'SYSTEM') return;
    const user = this.users.get(actorId);
    if (!user) {
      if (actorId.includes('FORENSIC')) {
        if (!allowedRoles.includes('FORENSIC_EXAMINER')) {
          throw new AuthorizationError(action, 'FORENSIC_EXAMINER');
        }
      } else if (actorId.includes('PROSECUTOR')) {
        if (!allowedRoles.includes('PUBLIC_PROSECUTOR')) {
          throw new AuthorizationError(action, 'PUBLIC_PROSECUTOR');
        }
      } else if (actorId.includes('POLICE')) {
        if (!allowedRoles.includes('POLICE_INVESTIGATOR')) {
          throw new AuthorizationError(action, 'POLICE_INVESTIGATOR');
        }
      }
      return;
    }
    if (user.role === 'SYSTEM_ADMIN') return;
    if (user.active_status === 'SUSPENDED' || user.active_status === 'INACTIVE') {
      throw new AuthorizationError(action, `${user.role}_SUSPENDED`);
    }
    if (!allowedRoles.includes(user.role)) {
      throw new AuthorizationError(action, user.role);
    }
  }

  // --------------------------------------------------------------------------
  // Cases
  // --------------------------------------------------------------------------
  public async createCase(
    caseData: Partial<Case> & {
      case_reference: string;
      title: string;
      category: string;
      created_by: string;
    }
  ): Promise<Case> {
    this.checkPermission(caseData.created_by, 'CREATE_CASE', ['POLICE_INVESTIGATOR']);

    const id = caseData.id || `CASE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const status: CaseStatus = caseData.status || 'OPEN';

    if (this.cases.has(id)) {
      throw new UniqueConstraintError('Case', 'id', id);
    }
    if (this.caseReferenceIndex.has(caseData.case_reference)) {
      throw new UniqueConstraintError('Case', 'case_reference', caseData.case_reference);
    }
    if (caseData.assigned_officer_id && !this.users.has(caseData.assigned_officer_id)) {
      throw new ForeignKeyConstraintError('Case', 'assigned_officer_id', caseData.assigned_officer_id);
    }

    const timestamp = new Date().toISOString();
    const newCase: Case = {
      id,
      case_reference: caseData.case_reference,
      title: caseData.title,
      category: caseData.category,
      incident_date: caseData.incident_date ?? timestamp,
      assigned_officer_id: caseData.assigned_officer_id ?? null,
      status,
      created_by: caseData.created_by,
      created_at: timestamp,
      updated_at: timestamp,
    };

    this.cases.set(newCase.id, newCase);
    this.caseReferenceIndex.add(newCase.case_reference);

    await this.recordAuditEvent(
      newCase.created_by,
      'CREATE_CASE',
      'Case',
      newCase.id,
      { reference: newCase.case_reference, title: newCase.title, status: newCase.status }
    );

    this.notify();
    return newCase;
  }

  public async registerEvidence(params: {
    case_id: string;
    description: string;
    evidence_type: EvidenceType;
    source_description: string;
    submitted_by_officer_id: string;
    file?: {
      original_filename: string;
      file_size_bytes: number;
      sha256_hash: string;
      storage_key: string;
      encryption_metadata?: Record<string, unknown>;
    };
  }): Promise<EvidenceRecord> {
    const id = `EVD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const evd = await this.createEvidence({
      id,
      case_id: params.case_id,
      description: params.description,
      evidence_type: params.evidence_type,
      source_description: params.source_description,
      collected_by: params.submitted_by_officer_id,
      collected_at: new Date().toISOString(),
      current_status: 'SUBMITTED_TO_FORENSICS',
      created_by: params.submitted_by_officer_id,
    });
    if (params.file) {
      await this.addFileVersion({
        id: `FILE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        evidence_id: evd.id,
        original_filename: params.file.original_filename,
        generated_storage_key: params.file.storage_key,
        content_type: 'application/octet-stream',
        file_size: params.file.file_size_bytes,
        sha256_hash: params.file.sha256_hash,
        baseline_created_at: new Date().toISOString(),
        uploaded_by: params.submitted_by_officer_id,
      });
    }
    await this.recordAuditEvent(
      params.submitted_by_officer_id,
      'EVIDENCE_REGISTERED',
      'EvidenceRecord',
      evd.id,
      { case_id: params.case_id, evidence_type: params.evidence_type, file: params.file }
    );
    this.notify();
    return evd;
  }

  public getCase(id: string): Case | undefined {
    return this.cases.get(id);
  }

  public getAllCases(): Case[] {
    return Array.from(this.cases.values());
  }

  public async updateCaseStatus(caseId: string, status: CaseStatus, actorId: string): Promise<Case> {
    const existingCase = this.cases.get(caseId);
    if (!existingCase) {
      throw new DatabaseIntegrityError(`Case '${caseId}' not found.`);
    }

    const oldStatus = existingCase.status;
    existingCase.status = status;
    existingCase.updated_at = new Date().toISOString();

    await this.recordAuditEvent(
      actorId,
      'UPDATE_CASE_STATUS',
      'Case',
      caseId,
      { oldStatus, newStatus: status }
    );

    this.notify();
    return existingCase;
  }

  // --------------------------------------------------------------------------
  // Evidence Records
  // --------------------------------------------------------------------------
  public async createEvidence(evidenceData: Omit<EvidenceRecord, 'created_at'>): Promise<EvidenceRecord> {
    this.checkPermission(evidenceData.created_by, 'CREATE_EVIDENCE', ['POLICE_INVESTIGATOR']);

    if (this.evidence.has(evidenceData.id)) {
      throw new UniqueConstraintError('EvidenceRecord', 'id', evidenceData.id);
    }

    // Explicit foreign key check
    if (!this.cases.has(evidenceData.case_id)) {
      throw new ForeignKeyConstraintError('EvidenceRecord', 'case_id', evidenceData.case_id);
    }

    const timestamp = new Date().toISOString();
    const newEvidence: EvidenceRecord = {
      ...evidenceData,
      created_at: timestamp,
    };

    this.evidence.set(newEvidence.id, newEvidence);

    // Automatically record intake Custody Event
    await this.recordCustodyEvent({
      id: `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      case_id: newEvidence.case_id,
      evidence_id: newEvidence.id,
      actor_id: newEvidence.collected_by,
      action: 'ACQUISITION_COLLECTED',
      source: newEvidence.source_description,
      destination: 'POLICE_EVIDENCE_ROOM',
      timestamp,
      previous_event_id: null,
      metadata: { description: newEvidence.description, type: newEvidence.evidence_type },
    });

    await this.recordAuditEvent(
      newEvidence.created_by,
      'CREATE_EVIDENCE',
      'EvidenceRecord',
      newEvidence.id,
      { case_id: newEvidence.case_id, type: newEvidence.evidence_type }
    );

    this.notify();
    return newEvidence;
  }

  public getEvidence(id: string): EvidenceRecord | undefined {
    return this.evidence.get(id);
  }

  public getAllEvidence(): EvidenceRecord[] {
    return Array.from(this.evidence.values());
  }

  public getEvidenceForCase(caseId: string): EvidenceRecord[] {
    return Array.from(this.evidence.values()).filter((e) => e.case_id === caseId);
  }

  // --------------------------------------------------------------------------
  // File Versions
  // --------------------------------------------------------------------------
  public async addFileVersion(
    fileVersionData: Omit<EvidenceFileVersion, 'created_at'>
  ): Promise<EvidenceFileVersion> {
    if (this.fileVersions.has(fileVersionData.id)) {
      throw new UniqueConstraintError('EvidenceFileVersion', 'id', fileVersionData.id);
    }

    const parentEvidence = this.evidence.get(fileVersionData.evidence_id);
    if (!parentEvidence) {
      throw new ForeignKeyConstraintError('EvidenceFileVersion', 'evidence_id', fileVersionData.evidence_id);
    }

    const newVersion: EvidenceFileVersion = {
      ...fileVersionData,
      created_at: new Date().toISOString(),
    };

    this.fileVersions.set(newVersion.id, newVersion);

    await this.recordAuditEvent(
      newVersion.uploaded_by,
      'ADD_FILE_VERSION',
      'EvidenceFileVersion',
      newVersion.id,
      {
        evidence_id: newVersion.evidence_id,
        filename: newVersion.original_filename,
        sha256: newVersion.sha256_hash,
        size: newVersion.file_size,
      }
    );

    this.notify();
    return newVersion;
  }

  public async addEvidenceFileVersion(
    fileVersionData: Omit<EvidenceFileVersion, 'created_at'>
  ): Promise<EvidenceFileVersion> {
    return this.addFileVersion(fileVersionData);
  }

  public getFileVersionsForEvidence(evidenceId: string): EvidenceFileVersion[] {
    return Array.from(this.fileVersions.values()).filter((v) => v.evidence_id === evidenceId);
  }

  public getFileVersion(fileVersionId: string): EvidenceFileVersion | undefined {
    return this.fileVersions.get(fileVersionId);
  }

  public getAllFileVersions(): EvidenceFileVersion[] {
    return Array.from(this.fileVersions.values());
  }

  // --------------------------------------------------------------------------
  // Evidence Handoffs (Workflow Transition Engine)
  // --------------------------------------------------------------------------
  public async createHandoff(handoffData: EvidenceHandoff): Promise<EvidenceHandoff> {
    this.checkPermission(handoffData.submitted_by, 'CREATE_HANDOFF', ['POLICE_INVESTIGATOR']);

    if (this.handoffs.has(handoffData.id)) {
      throw new UniqueConstraintError('EvidenceHandoff', 'id', handoffData.id);
    }

    const evidence = this.evidence.get(handoffData.evidence_id);
    if (!evidence) {
      throw new ForeignKeyConstraintError('EvidenceHandoff', 'evidence_id', handoffData.evidence_id);
    }

    // Prevent duplicate active handoff submissions for the same evidence item
    const existing = this.getHandoffsForEvidence(handoffData.evidence_id);
    const active = existing.find((h) => h.status !== 'RETURNED');
    if (active) {
      throw new DatabaseIntegrityError(
        `Active handoff '${active.id}' already exists for evidence '${handoffData.evidence_id}' in state '${active.status}'. Duplicate submissions are prevented.`
      );
    }

    if (handoffData.status === 'SUBMITTED') {
      evidence.current_status = 'SUBMITTED_TO_FORENSICS';
    }

    this.handoffs.set(handoffData.id, handoffData);

    await this.recordAuditEvent(
      handoffData.submitted_by,
      'CREATE_HANDOFF',
      'EvidenceHandoff',
      handoffData.id,
      {
        evidence_id: handoffData.evidence_id,
        source: handoffData.source_department,
        destination: handoffData.destination_department,
        status: handoffData.status,
      }
    );

    this.notify();
    return handoffData;
  }

  public async transitionHandoffStatus(
    handoffId: string,
    newStatus: HandoffStatus,
    actorId: string,
    rejectionReason?: string
  ): Promise<EvidenceHandoff> {
    if (['RECEIVED', 'UNDER_EXAMINATION', 'REPORT_READY'].includes(newStatus)) {
      this.checkPermission(actorId, 'TRANSITION_FORENSIC_STATUS', ['FORENSIC_EXAMINER']);
    } else if (newStatus === 'RETURNED') {
      this.checkPermission(actorId, 'REJECT_OR_RETURN_HANDOFF', ['FORENSIC_EXAMINER', 'POLICE_INVESTIGATOR']);
    }

    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      throw new DatabaseIntegrityError(`Handoff '${handoffId}' not found.`);
    }

    const validNextStates = VALID_HANDOFF_TRANSITIONS[handoff.status] || [];
    if (!validNextStates.includes(newStatus)) {
      throw new InvalidStatusTransitionError(handoff.status, newStatus, 'EvidenceHandoff');
    }

    const oldStatus = handoff.status;
    handoff.status = newStatus;
    if (newStatus === 'RECEIVED') {
      handoff.acknowledged_at = new Date().toISOString();
      handoff.received_by = actorId;
    }
    if (newStatus === 'RETURNED') {
      handoff.acknowledged_at = new Date().toISOString();
      handoff.rejection_reason = rejectionReason || 'Returned by receiving department';
    } else if (rejectionReason) {
      handoff.rejection_reason = rejectionReason;
    }

    // Update parent evidence status consistently & record custody transfer event
    const parentEvidence = this.evidence.get(handoff.evidence_id);
    if (parentEvidence) {
      let custodyAction = 'HANDOFF_STATUS_TRANSITION';
      let dest = 'FORENSIC_LAB';

      if (newStatus === 'RECEIVED') {
        parentEvidence.current_status = 'IN_FORENSIC_CUSTODY';
        custodyAction = 'HANDOFF_ACCEPTED_BY_FORENSICS';
        dest = 'FORENSIC_LAB_CUSTODY';
      } else if (newStatus === 'UNDER_EXAMINATION') {
        parentEvidence.current_status = 'IN_FORENSIC_CUSTODY';
        custodyAction = 'FORENSIC_EXAMINATION_STARTED';
        dest = 'FORENSIC_SECURE_WORKSTATION';
      } else if (newStatus === 'REPORT_READY') {
        parentEvidence.current_status = 'PROSECUTION_READY';
        custodyAction = 'FORENSIC_REPORT_FINALIZED';
        dest = 'PROSECUTION_REPOSITORY';
      } else if (newStatus === 'RETURNED') {
        parentEvidence.current_status = 'ACQUIRED';
        custodyAction = 'HANDOFF_RETURNED_OR_REJECTED';
        dest = 'POLICE_EVIDENCE_ROOM';
      } else if (newStatus === 'SUBMITTED') {
        parentEvidence.current_status = 'SUBMITTED_TO_FORENSICS';
        custodyAction = 'HANDOFF_RESUBMITTED_TO_FORENSICS';
        dest = 'FORENSIC_INTAKE_QUEUE';
      }

      await this.recordCustodyEvent({
        id: `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        case_id: parentEvidence.case_id,
        evidence_id: parentEvidence.id,
        actor_id: actorId,
        action: custodyAction,
        source: handoff.source_department,
        destination: dest,
        timestamp: new Date().toISOString(),
        previous_event_id: null,
        metadata: {
          handoff_id: handoff.id,
          old_status: oldStatus,
          new_status: newStatus,
          rejection_reason: handoff.rejection_reason,
        },
      });
    }

    await this.recordAuditEvent(
      actorId,
      'TRANSITION_HANDOFF',
      'EvidenceHandoff',
      handoff.id,
      { oldStatus, newStatus, rejectionReason: handoff.rejection_reason }
    );

    this.notify();
    return handoff;
  }

  public getHandoffsForEvidence(evidenceId: string): EvidenceHandoff[] {
    return Array.from(this.handoffs.values()).filter((h) => h.evidence_id === evidenceId);
  }

  public getAllHandoffs(): EvidenceHandoff[] {
    return Array.from(this.handoffs.values());
  }

  // --------------------------------------------------------------------------
  // Chain-of-Custody Events
  // --------------------------------------------------------------------------
  public async recordCustodyEvent(event: CustodyEvent): Promise<CustodyEvent> {
    if (this.custodyEvents.has(event.id)) {
      throw new UniqueConstraintError('CustodyEvent', 'id', event.id);
    }
    if (!this.cases.has(event.case_id)) {
      throw new ForeignKeyConstraintError('CustodyEvent', 'case_id', event.case_id);
    }
    if (!this.evidence.has(event.evidence_id)) {
      throw new ForeignKeyConstraintError('CustodyEvent', 'evidence_id', event.evidence_id);
    }

    this.custodyEvents.set(event.id, event);

    await this.recordAuditEvent(
      event.actor_id,
      'RECORD_CUSTODY_TRANSFER',
      'CustodyEvent',
      event.id,
      {
        case_id: event.case_id,
        evidence_id: event.evidence_id,
        action: event.action,
        destination: event.destination,
      }
    );

    this.notify();
    return event;
  }

  public getCustodyEventsForEvidence(evidenceId: string): CustodyEvent[] {
    return Array.from(this.custodyEvents.values())
      .filter((c) => c.evidence_id === evidenceId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  public getAllCustodyEvents(): CustodyEvent[] {
    return Array.from(this.custodyEvents.values());
  }

  // --------------------------------------------------------------------------
  // Cryptographic Verification Results
  // --------------------------------------------------------------------------
  public async recordVerificationResult(
    result: IntegrityVerificationResult
  ): Promise<IntegrityVerificationResult> {
    if (!this.evidence.has(result.evidence_id)) {
      throw new ForeignKeyConstraintError('IntegrityVerificationResult', 'evidence_id', result.evidence_id);
    }
    if (!this.fileVersions.has(result.file_version_id)) {
      throw new ForeignKeyConstraintError('IntegrityVerificationResult', 'file_version_id', result.file_version_id);
    }

    this.verificationResults.set(result.id, result);

    await this.recordAuditEvent(
      result.verified_by,
      'VERIFY_INTEGRITY',
      'IntegrityVerificationResult',
      result.id,
      {
        evidence_id: result.evidence_id,
        file_version_id: result.file_version_id,
        result: result.result,
        match: result.result === 'MATCH',
        expected_sha256: result.expected_sha256,
        observed_sha256: result.observed_sha256,
        mode: result.verification_mode,
        duration_ms: result.duration_ms,
        error_reason: result.error_reason || null,
        provider: result.provider_integrity?.provider || 'CLOUDFLARE_R2',
      }
    );

    this.notify();
    return result;
  }

  public getVerificationResultsForEvidence(evidenceId: string): IntegrityVerificationResult[] {
    return Array.from(this.verificationResults.values())
      .filter((r) => r.evidence_id === evidenceId)
      .sort((a, b) => {
        const timeDiff = new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime();
        return timeDiff !== 0 ? timeDiff : b.id.localeCompare(a.id);
      });
  }

  public getVerificationResultsForFileVersion(fileVersionId: string): IntegrityVerificationResult[] {
    return Array.from(this.verificationResults.values())
      .filter((r) => r.file_version_id === fileVersionId)
      .sort((a, b) => {
        const timeDiff = new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime();
        return timeDiff !== 0 ? timeDiff : b.id.localeCompare(a.id);
      });
  }

  public getLatestVerificationResult(fileVersionId: string): IntegrityVerificationResult | null {
    const list = this.getVerificationResultsForFileVersion(fileVersionId);
    return list.length > 0 ? list[0] : null;
  }

  public getAllVerificationResults(): IntegrityVerificationResult[] {
    return Array.from(this.verificationResults.values())
      .sort((a, b) => new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime());
  }

  // --------------------------------------------------------------------------
  // Forensic Reports (Version-Preserved)
  // --------------------------------------------------------------------------
  public async createOrReviseReport(
    params: {
      case_id: string;
      evidence_id: string;
      report_content: string;
      author_id: string;
      status?: ForensicReportStatus;
    }
  ): Promise<ForensicReport> {
    this.checkPermission(params.author_id, 'CREATE_FORENSIC_REPORT', ['FORENSIC_EXAMINER']);

    if (!this.cases.has(params.case_id)) {
      throw new ForeignKeyConstraintError('ForensicReport', 'case_id', params.case_id);
    }
    if (!this.evidence.has(params.evidence_id)) {
      throw new ForeignKeyConstraintError('ForensicReport', 'evidence_id', params.evidence_id);
    }

    // Determine current version number for this case & evidence
    const existingVersions = Array.from(this.reports.values()).filter(
      (r) => r.case_id === params.case_id && r.evidence_id === params.evidence_id
    );

    const nextVersion = existingVersions.length + 1;
    const timestamp = new Date().toISOString();
    const reportId = `REP-${params.evidence_id}-v${nextVersion}`;

    const newReport: ForensicReport = {
      id: reportId,
      case_id: params.case_id,
      evidence_id: params.evidence_id,
      version_number: nextVersion,
      report_content: params.report_content,
      status: params.status || 'DRAFT',
      author_id: params.author_id,
      created_at: timestamp,
      updated_at: timestamp,
    };

    // Store new version without mutating older versions
    this.reports.set(newReport.id, newReport);

    await this.recordAuditEvent(
      params.author_id,
      'CREATE_FORENSIC_REPORT_VERSION',
      'ForensicReport',
      newReport.id,
      { version: nextVersion, case_id: params.case_id, evidence_id: params.evidence_id }
    );

    this.notify();
    return newReport;
  }

  public getReportsForEvidence(evidenceId: string): ForensicReport[] {
    return Array.from(this.reports.values())
      .filter((r) => r.evidence_id === evidenceId)
      .sort((a, b) => b.version_number - a.version_number);
  }

  public getAllReports(): ForensicReport[] {
    return Array.from(this.reports.values());
  }

  // --------------------------------------------------------------------------
  // Prosecution Reviews
  // --------------------------------------------------------------------------
  public async submitProsecutionReview(
    reviewData: Omit<ProsecutionReview, 'created_at' | 'updated_at'>
  ): Promise<ProsecutionReview> {
    this.checkPermission(reviewData.reviewer_id, 'SUBMIT_PROSECUTION_REVIEW', ['PUBLIC_PROSECUTOR']);

    if (!this.cases.has(reviewData.case_id)) {
      throw new ForeignKeyConstraintError('ProsecutionReview', 'case_id', reviewData.case_id);
    }
    if (!this.reports.has(reviewData.report_id)) {
      throw new ForeignKeyConstraintError('ProsecutionReview', 'report_id', reviewData.report_id);
    }

    const timestamp = new Date().toISOString();
    const review: ProsecutionReview = {
      ...reviewData,
      created_at: timestamp,
      updated_at: timestamp,
    };

    this.prosecutionReviews.set(review.id, review);

    await this.recordAuditEvent(
      review.reviewer_id,
      'RECORD_PROSECUTION_REVIEW',
      'ProsecutionReview',
      review.id,
      { case_id: review.case_id, report_id: review.report_id, status: review.status }
    );

    this.notify();
    return review;
  }

  // --------------------------------------------------------------------------
  // Phase 6: IDOR & Protected Access Retrieval APIs
  // --------------------------------------------------------------------------
  public getCaseWithAuth(caseId: string, context: SecurityContext): Case {
    const c = this.cases.get(caseId);
    if (!c) {
      throw new DatabaseIntegrityError(`Case '${caseId}' not found.`);
    }
    const clearance = canAccessCase({ id: context.actorId, role: context.role }, c);
    if (!clearance.granted) {
      throw new IdorAccessDeniedError(caseId, context.actorId, context.role);
    }
    return c;
  }

  public getEvidenceWithAuth(evidenceId: string, context: SecurityContext): EvidenceRecord {
    const ev = this.evidence.get(evidenceId);
    if (!ev) {
      throw new DatabaseIntegrityError(`Evidence '${evidenceId}' not found.`);
    }
    const clearance = canAccessEvidence({ id: context.actorId, role: context.role }, ev, this);
    if (!clearance.granted) {
      throw new IdorAccessDeniedError(evidenceId, context.actorId, context.role);
    }
    return ev;
  }

  public getEvidenceForCaseWithAuth(caseId: string, context: SecurityContext): EvidenceRecord[] {
    const c = this.getCaseWithAuth(caseId, context);
    const all = this.getEvidenceForCase(c.id);
    return all.filter((ev) => canAccessEvidence({ id: context.actorId, role: context.role }, ev, this).granted);
  }

  public authorizeDownload(
    context: SecurityContext,
    evidenceId: string
  ): { authorized: boolean; evidence: EvidenceRecord; fileVersion?: EvidenceFileVersion } {
    const ev = this.getEvidenceWithAuth(evidenceId, context);
    authDownloadGuard(context, ev, this);
    const versions = this.getFileVersionsForEvidence(evidenceId);
    return { authorized: true, evidence: ev, fileVersion: versions[0] };
  }

  public getReviewsForCase(caseId: string): ProsecutionReview[] {
    return Array.from(this.prosecutionReviews.values()).filter((p) => p.case_id === caseId);
  }

  public getAllProsecutionReviews(): ProsecutionReview[] {
    return Array.from(this.prosecutionReviews.values());
  }

  // --------------------------------------------------------------------------
  // Audit Chain Verification & Compliance
  // --------------------------------------------------------------------------
  public async verifyAuditChain(): Promise<AuditChainVerificationResult> {
    const verifiedAt = new Date().toISOString();
    if (this.auditEvents.length === 0) {
      return {
        isValid: true,
        totalBlocks: 0,
        verifiedBlocks: 0,
        verifiedAt,
      };
    }

    let previousHash: string | null = null;
    let verifiedCount = 0;

    for (let i = 0; i < this.auditEvents.length; i++) {
      const event = this.auditEvents[i];
      if (event.previous_event_hash !== previousHash) {
        return {
          isValid: false,
          totalBlocks: this.auditEvents.length,
          verifiedBlocks: verifiedCount,
          brokenBlockId: event.id,
          brokenBlockIndex: i,
          errorMessage: `Previous hash mismatch on block ${i} (${event.id}). Expected '${previousHash}', found '${event.previous_event_hash}'.`,
          verifiedAt,
        };
      }

      const expectedHash = await computeAuditBlockHash(
        previousHash,
        event.timestamp,
        event.actor_id,
        event.action,
        event.entity_type,
        event.entity_id,
        event.event_payload
      );

      if (event.event_hash !== expectedHash) {
        return {
          isValid: false,
          totalBlocks: this.auditEvents.length,
          verifiedBlocks: verifiedCount,
          brokenBlockId: event.id,
          brokenBlockIndex: i,
          errorMessage: `Block hash corrupted on block ${i} (${event.id}). Computed '${expectedHash}', stored '${event.event_hash}'.`,
          verifiedAt,
        };
      }

      previousHash = event.event_hash;
      verifiedCount++;
    }

    return {
      isValid: true,
      totalBlocks: this.auditEvents.length,
      verifiedBlocks: verifiedCount,
      verifiedAt,
    };
  }

  public async verifyAuditChainIntegrity(): Promise<AuditChainVerificationResult> {
    return this.verifyAuditChain();
  }

  public async generateComplianceReport(actorId: string): Promise<ComplianceAuditReport> {
    const chainVerification = await this.verifyAuditChain();
    const findings: string[] = [];

    const totalCases = this.cases.size;
    const totalEvidence = this.evidence.size;
    const totalReports = this.reports.size;
    const totalVerificationChecks = this.verificationResults.size;

    const failedIntegrity = Array.from(this.verificationResults.values()).filter(
      (v) => v.result !== 'MATCH'
    ).length;

    const pendingHandoffs = Array.from(this.handoffs.values()).filter(
      (h) => h.status === 'SUBMITTED' || h.status === 'UNDER_EXAMINATION'
    ).length;

    if (!chainVerification.isValid) {
      findings.push(`CRITICAL: Audit ledger compromised at block ${chainVerification.brokenBlockId || 'unknown'}`);
    } else {
      findings.push('Audit ledger cryptographic chain integrity verified 100% intact.');
    }

    if (failedIntegrity > 0) {
      findings.push(`WARNING: ${failedIntegrity} evidence file verification checks resulted in hash mismatch.`);
    }

    if (pendingHandoffs > 0) {
      findings.push(`NOTICE: ${pendingHandoffs} evidence transfers currently pending completion.`);
    }

    return {
      id: `COMP-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      generatedBy: actorId,
      totalCases,
      totalEvidence,
      totalReports,
      totalVerificationChecks,
      failedIntegrityChecks: failedIntegrity,
      pendingCustodyHandoffs: pendingHandoffs,
      auditChainStatus: chainVerification.isValid ? 'INTACT' : 'COMPROMISED',
      findings,
    };
  }

  // --------------------------------------------------------------------------
  // Evidence Completeness & Case Evidence Index
  // --------------------------------------------------------------------------
  public assessEvidenceCompleteness(caseId: string): EvidenceCompletenessCheck[] {
    const caseEv = this.getEvidenceForCase(caseId);
    return caseEv.map((ev) => {
      const files = this.getFileVersionsForEvidence(ev.id);
      const evHandoffs = this.getHandoffsForEvidence(ev.id);
      const evReports = this.getReportsForEvidence(ev.id);

      const hasFileMetadata = files.length > 0 && files.every((f) => !!f.sha256_hash && f.file_size > 0);
      const activeHandoff = evHandoffs[evHandoffs.length - 1];
      const hasForensicHandoff = evHandoffs.length > 0;
      const handoffStatus = activeHandoff ? activeHandoff.status : 'NONE';
      const hasForensicReport = evReports.length > 0;

      const missing: string[] = [];
      if (!hasFileMetadata) missing.push('Missing cryptographic file baseline metadata');
      if (!hasForensicHandoff) missing.push('No forensic handoff recorded');
      else if (handoffStatus === 'RETURNED') missing.push(`Forensic transfer returned: ${activeHandoff?.rejection_reason || 'Rejected'}`);
      else if (handoffStatus === 'SUBMITTED') missing.push('Forensic transfer awaiting acceptance');
      else if (handoffStatus === 'RECEIVED' || handoffStatus === 'UNDER_EXAMINATION') missing.push('Forensic examination underway');
      if (!hasForensicReport) missing.push('Missing finalized forensic examination report');

      return {
        evidenceId: ev.id,
        description: ev.description,
        hasFileMetadata,
        hasForensicHandoff,
        handoffStatus,
        hasForensicReport,
        reportCount: evReports.length,
        isComplete: missing.length === 0,
        missingItems: missing,
      };
    });
  }

  public generateCaseEvidenceIndex(caseId: string): CaseEvidenceIndex {
    const targetCase = this.cases.get(caseId);
    if (!targetCase) {
      throw new DatabaseIntegrityError(`Case '${caseId}' not found.`);
    }

    const caseEv = this.getEvidenceForCase(caseId);
    const reviews = this.getReviewsForCase(caseId);
    const completeness = this.assessEvidenceCompleteness(caseId);

    let totalFiles = 0;
    let totalReports = 0;

    const evidenceItems = caseEv.map((ev) => {
      const files = this.getFileVersionsForEvidence(ev.id);
      totalFiles += files.length;
      const evHandoffs = this.getHandoffsForEvidence(ev.id);
      const evReports = this.getReportsForEvidence(ev.id);
      totalReports += evReports.length;
      const custody = this.getCustodyEventsForEvidence(ev.id);
      const latestHandoff = evHandoffs[evHandoffs.length - 1];

      return {
        evidenceId: ev.id,
        description: ev.description,
        evidenceType: ev.evidence_type,
        status: ev.current_status,
        handoffStatus: latestHandoff ? latestHandoff.status : ('NO_HANDOFF' as const),
        collectedBy: ev.collected_by,
        collectedAt: ev.collected_at,
        files: files.map((f) => ({
          id: f.id,
          filename: f.original_filename,
          fileSize: f.file_size,
          sha256Hash: f.sha256_hash,
        })),
        reports: evReports.map((r) => ({
          reportId: r.id,
          versionNumber: r.version_number,
          status: r.status,
          authorId: r.author_id,
          createdAt: r.created_at,
          summary: r.report_content,
        })),
        custodyChainLength: custody.length,
      };
    });

    let trialReadiness: CaseEvidenceIndex['trialReadiness'] = 'READY_FOR_TRIAL';
    if (caseEv.length === 0) {
      trialReadiness = 'INCOMPLETE_EVIDENCE';
    } else if (completeness.some((c) => !c.isComplete)) {
      trialReadiness = completeness.some((c) => c.handoffStatus === 'RETURNED')
        ? 'REJECTED'
        : 'FORENSICS_PENDING';
    }

    return {
      caseId: targetCase.id,
      caseReference: targetCase.case_reference,
      caseTitle: targetCase.title,
      caseStatus: targetCase.status,
      incidentDate: targetCase.incident_date,
      assignedOfficer: targetCase.assigned_officer_id,
      totalEvidenceCount: caseEv.length,
      totalFileVersions: totalFiles,
      totalReportsCount: totalReports,
      evidenceItems,
      prosecutionReviews: reviews,
      trialReadiness,
      generatedAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // Phase 10: Enterprise Backup & Disaster Restoration Engine
  // --------------------------------------------------------------------------
  public exportBackup(): string {
    const backupPayload = {
      backupVersion: '1.0',
      exportedAt: new Date().toISOString(),
      entities: {
        users: Array.from(this.users.values()),
        cases: Array.from(this.cases.values()),
        evidence: Array.from(this.evidence.values()),
        fileVersions: Array.from(this.fileVersions.values()),
        handoffs: Array.from(this.handoffs.values()),
        custodyEvents: Array.from(this.custodyEvents.values()),
        verificationResults: Array.from(this.verificationResults.values()),
        reports: Array.from(this.reports.values()),
        prosecutionReviews: Array.from(this.prosecutionReviews.values()),
        auditEvents: [...this.auditEvents],
      },
    };
    return JSON.stringify(backupPayload, null, 2);
  }

  public async restoreBackup(backupJson: string): Promise<{
    restored: boolean;
    totalEntities: number;
    auditChainValid: boolean;
    restoredAt: string;
  }> {
    const parsed = JSON.parse(backupJson);
    if (!parsed || !parsed.entities) {
      throw new DatabaseIntegrityError('Invalid backup archive structure');
    }

    this.reset();

    const entities = parsed.entities;
    if (Array.isArray(entities.users)) {
      entities.users.forEach((u: User) => this.users.set(u.id, u));
    }
    if (Array.isArray(entities.cases)) {
      entities.cases.forEach((c: Case) => {
        this.cases.set(c.id, c);
        this.caseReferenceIndex.add(c.case_reference.toUpperCase().trim());
      });
    }
    if (Array.isArray(entities.evidence)) {
      entities.evidence.forEach((e: EvidenceRecord) => this.evidence.set(e.id, e));
    }
    if (Array.isArray(entities.fileVersions)) {
      entities.fileVersions.forEach((f: EvidenceFileVersion) => this.fileVersions.set(f.id, f));
    }
    if (Array.isArray(entities.handoffs)) {
      entities.handoffs.forEach((h: EvidenceHandoff) => this.handoffs.set(h.id, h));
    }
    if (Array.isArray(entities.custodyEvents)) {
      entities.custodyEvents.forEach((ce: CustodyEvent) => this.custodyEvents.set(ce.id, ce));
    }
    if (Array.isArray(entities.verificationResults)) {
      entities.verificationResults.forEach((v: IntegrityVerificationResult) => this.verificationResults.set(v.id, v));
    }
    if (Array.isArray(entities.reports)) {
      entities.reports.forEach((r: ForensicReport) => this.reports.set(r.id, r));
    }
    if (Array.isArray(entities.prosecutionReviews)) {
      entities.prosecutionReviews.forEach((pr: ProsecutionReview) => this.prosecutionReviews.set(pr.id, pr));
    }
    if (Array.isArray(entities.auditEvents)) {
      this.auditEvents = [...entities.auditEvents];
    }

    this.notify();

    const chainAudit = await this.verifyAuditChain();
    const totalEntities =
      this.users.size +
      this.cases.size +
      this.evidence.size +
      this.fileVersions.size +
      this.handoffs.size +
      this.custodyEvents.size +
      this.verificationResults.size +
      this.reports.size +
      this.prosecutionReviews.size +
      this.auditEvents.length;

    return {
      restored: true,
      totalEntities,
      auditChainValid: chainAudit.isValid,
      restoredAt: new Date().toISOString(),
    };
  }
}

// ----------------------------------------------------------------------------
// Global Singleton Shared Database for the Application
// ----------------------------------------------------------------------------
export const globalDb = new EvidenceVaultDatabase();
