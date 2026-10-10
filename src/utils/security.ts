// ============================================================================
// EVIDENCEVAULT 360 — PHASE 6: ROLE-BASED ACCESS CONTROL & SECURITY ENGINE
// Comprehensive Backend Authorization, IDOR Protection, Session Security,
// Path Traversal Defense, Rate Limiting & Safe Audit Logging
// ============================================================================

import type {
  UserRole,
  Department,
  Case,
  EvidenceRecord,
  SecurityContext,
  AuthSession,
  SecurityViolationType,
  SecurityAuditLogEntry,
  UserActiveStatus,
} from '../types.ts';
import type { EvidenceVaultDatabase } from '../data/db.ts';

// ----------------------------------------------------------------------------
// Custom Security Error Classes
// ----------------------------------------------------------------------------
export class SecurityViolationError extends Error {
  public violationType: SecurityViolationType;
  public resource: string;

  constructor(message: string, violationType: SecurityViolationType, resource: string) {
    super(message);
    this.name = 'SecurityViolationError';
    this.violationType = violationType;
    this.resource = resource;
  }
}

export class IdorAccessDeniedError extends SecurityViolationError {
  constructor(resource: string, userId: string, role: UserRole) {
    super(
      `Access Denied (IDOR Protection): User '${userId}' with role '${role}' is not authorized to access resource '${resource}'.`,
      'IDOR_ACCESS_DENIED',
      resource
    );
    this.name = 'IdorAccessDeniedError';
  }
}

export class RateLimitExceededError extends SecurityViolationError {
  public retryAfterSeconds: number;

  constructor(action: string, retryAfterSeconds: number) {
    super(
      `Rate limit exceeded for '${action}'. Please wait ${retryAfterSeconds} seconds before retrying.`,
      'RATE_LIMIT_EXCEEDED',
      action
    );
    this.name = 'RateLimitExceededError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class InvalidSessionError extends SecurityViolationError {
  constructor(reason: string) {
    super(`Session authentication failure: ${reason}`, 'EXPIRED_OR_INVALID_SESSION', 'AUTH_SESSION');
    this.name = 'InvalidSessionError';
  }
}

export class PathTraversalError extends SecurityViolationError {
  constructor(maliciousPath: string) {
    super(
      `Security Alert: Malicious path traversal sequence detected in storage reference: '${maliciousPath}'.`,
      'PATH_TRAVERSAL_ATTEMPT',
      maliciousPath
    );
    this.name = 'PathTraversalError';
  }
}

export type { SecurityAuditLogEntry } from '../types.ts';

export class AdminAccessDeniedError extends SecurityViolationError {
  constructor(action: string, actorId: string, role: string, detailedReason?: string) {
    super(
      `Access Denied: Action '${action}' requires authorized 'SYSTEM_ADMIN' clearance. User '${actorId}' with role '${role}' is not authorized to access Admin Portal or Audit Logs.${detailedReason ? ` Reason: ${detailedReason}` : ''}`,
      'UNAUTHORIZED_ROLE_ACTION',
      'ADMIN_PORTAL'
    );
    this.name = 'AdminAccessDeniedError';
  }
}

// ----------------------------------------------------------------------------
// Configuration & Environment Secrets
// ----------------------------------------------------------------------------
const SESSION_TTL_MS = 60 * 60 * 1000; // 60 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_AUTH_FAILURES = 5; // Max 5 bad attempts per window
const MAX_DOWNLOADS_PER_MIN = 10;

// Fallback HMAC key for development/demo (in production loaded from VITE_JWT_SECRET)
const JWT_SECRET =
  (typeof process !== 'undefined' && process.env?.VITE_JWT_SECRET) ||
  'evidencevault360-synth-hmac-secret-key-32chars';

// ----------------------------------------------------------------------------
// In-Memory Rate Limiting Engine
// ----------------------------------------------------------------------------
interface RateLimitBucket {
  timestamps: number[];
  lockUntil: number | null;
}

class SecurityRateLimiter {
  private authFailures: Map<string, RateLimitBucket> = new Map();
  private downloadRequests: Map<string, RateLimitBucket> = new Map();

  public checkAuthRateLimit(identifier: string): { allowed: boolean; remaining: number; retryAfterSec?: number } {
    const now = Date.now();
    const bucket = this.authFailures.get(identifier);

    if (!bucket) {
      return { allowed: true, remaining: MAX_AUTH_FAILURES };
    }

    if (bucket.lockUntil && bucket.lockUntil > now) {
      const retryAfterSec = Math.ceil((bucket.lockUntil - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    // Clean timestamps outside window
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    const count = bucket.timestamps.length;
    const remaining = Math.max(0, MAX_AUTH_FAILURES - count);

    return { allowed: count < MAX_AUTH_FAILURES, remaining };
  }

  public recordAuthFailure(identifier: string): { allowed: boolean; remaining: number; locked: boolean } {
    const now = Date.now();
    let bucket = this.authFailures.get(identifier);

    if (!bucket) {
      bucket = { timestamps: [], lockUntil: null };
      this.authFailures.set(identifier, bucket);
    }

    bucket.timestamps.push(now);
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (bucket.timestamps.length >= MAX_AUTH_FAILURES) {
      // Lock for 5 minutes
      bucket.lockUntil = now + 5 * 60 * 1000;
      return { allowed: false, remaining: 0, locked: true };
    }

    return { allowed: true, remaining: MAX_AUTH_FAILURES - bucket.timestamps.length, locked: false };
  }

  public resetAuthFailures(identifier: string): void {
    this.authFailures.delete(identifier);
  }

  public checkDownloadRateLimit(userId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = this.downloadRequests.get(userId);

    if (!bucket) {
      bucket = { timestamps: [], lockUntil: null };
      this.downloadRequests.set(userId, bucket);
    }

    bucket.timestamps = bucket.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (bucket.timestamps.length >= MAX_DOWNLOADS_PER_MIN) {
      return { allowed: false, remaining: 0 };
    }

    bucket.timestamps.push(now);
    return { allowed: true, remaining: MAX_DOWNLOADS_PER_MIN - bucket.timestamps.length };
  }

  public clearAll(): void {
    this.authFailures.clear();
    this.downloadRequests.clear();
  }
}

export const globalRateLimiter = new SecurityRateLimiter();

// ----------------------------------------------------------------------------
// Token & Session Security Engine
// ----------------------------------------------------------------------------
function computeHmacSignature(payload: string): string {
  // Deterministic signature simulation
  let hash = 0;
  const combined = payload + '::' + JWT_SECRET;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function createAuthSession(user: {
  id: string;
  role: UserRole;
  department: Department;
  badge: string;
  active_status?: UserActiveStatus;
}): AuthSession {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const sessionId = `SES-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const activeStatus = user.active_status || 'ACTIVE';

  const rawPayload = `${sessionId}:${user.id}:${user.role}:${expiresAt}:${activeStatus}`;
  const tokenSignature = computeHmacSignature(rawPayload);

  return {
    sessionId,
    userId: user.id,
    role: user.role,
    department: user.department,
    badge: user.badge,
    issuedAt,
    expiresAt,
    activeStatus,
    tokenSignature,
  };
}

export function validateAuthSession(session: AuthSession): { isValid: boolean; error?: string } {
  if (!session || !session.sessionId || !session.userId) {
    return { isValid: false, error: 'Malformed or missing session object.' };
  }

  // Check active status
  if (session.activeStatus === 'SUSPENDED') {
    return { isValid: false, error: 'User account is suspended by administrator.' };
  }
  if (session.activeStatus === 'INACTIVE') {
    return { isValid: false, error: 'User account is marked inactive.' };
  }

  // Check expiration
  const expTime = new Date(session.expiresAt).getTime();
  if (Date.now() > expTime) {
    return { isValid: false, error: `Session expired at ${session.expiresAt}.` };
  }

  // Validate HMAC signature
  const rawPayload = `${session.sessionId}:${session.userId}:${session.role}:${session.expiresAt}:${session.activeStatus}`;
  const expectedSig = computeHmacSignature(rawPayload);
  if (session.tokenSignature !== expectedSig) {
    return { isValid: false, error: 'Cryptographic signature mismatch. Potential session tampering detected.' };
  }

  return { isValid: true };
}

// ----------------------------------------------------------------------------
// Path Traversal & Input Sanitization Defenses
// ----------------------------------------------------------------------------
const MALICIOUS_PATH_PATTERNS = [
  /\.\./, // Double dots (..)
  /%2e%2e/i, // URL-encoded double dots (%2e%2e)
  /%2f/i, // Encoded forward slash
  /%5c/i, // Encoded backslash
  /\\/, // Backslash (\)
  /\0/, // Null byte
  /^(\/|[a-zA-Z]:)/, // Root or absolute drive paths
];

export function detectPathTraversal(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return MALICIOUS_PATH_PATTERNS.some((pattern) => pattern.test(input));
}

export function sanitizeRequestData<T>(data: T): T {
  if (typeof data === 'string') {
    // Strip control characters, HTML tags, and null bytes
    return data
      .replace(/\0/g, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .trim() as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeRequestData(item)) as unknown as T;
  }
  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      sanitized[key] = sanitizeRequestData(val);
    }
    return sanitized as T;
  }
  return data;
}

// ----------------------------------------------------------------------------
// Insecure Direct Object Reference (IDOR) & Case Access Guards
// ----------------------------------------------------------------------------
export function canAccessCase(
  user: { id: string; role: UserRole },
  caseRecord: Case
): { granted: boolean; reason?: string } {
  // 1. System administrators have universal audit access
  if (user.role === 'SYSTEM_ADMIN') {
    return { granted: true };
  }

  // 2. Police: Access assigned cases or cases they created
  if (user.role === 'POLICE_INVESTIGATOR') {
    const isAssigned = caseRecord.assigned_officer_id === user.id;
    const isCreator = caseRecord.created_by === user.id;
    if (isAssigned || isCreator) {
      return { granted: true };
    }
    return {
      granted: false,
      reason: `Case '${caseRecord.id}' is not assigned to officer '${user.id}'.`,
    };
  }

  // 3. Forensic: Access cases that have submitted evidence for forensic examination
  if (user.role === 'FORENSIC_EXAMINER') {
    // Must be in forensic workflow
    const eligibleStatuses = ['PENDING_FORENSICS', 'UNDER_INVESTIGATION', 'PROSECUTION_REVIEW'];
    if (eligibleStatuses.includes(caseRecord.status)) {
      return { granted: true };
    }
    return {
      granted: false,
      reason: `Case '${caseRecord.id}' status '${caseRecord.status}' is not open for forensic examination.`,
    };
  }

  // 4. Prosecution: Access cases submitted for prosecution review
  if (user.role === 'PUBLIC_PROSECUTOR') {
    const eligibleStatuses = ['PROSECUTION_REVIEW', 'UNDER_INVESTIGATION', 'OPEN'];
    if (eligibleStatuses.includes(caseRecord.status)) {
      return { granted: true };
    }
    return {
      granted: false,
      reason: `Case '${caseRecord.id}' has not been submitted for prosecution review.`,
    };
  }

  return { granted: false, reason: `Role '${user.role}' has no case access clearance.` };
}

export function canAccessEvidence(
  user: { id: string; role: UserRole },
  evidenceRecord: EvidenceRecord,
  db: EvidenceVaultDatabase
): { granted: boolean; reason?: string } {
  if (user.role === 'SYSTEM_ADMIN') return { granted: true };

  const parentCase = db.getCase(evidenceRecord.case_id);
  if (!parentCase) {
    return { granted: false, reason: `Parent case '${evidenceRecord.case_id}' not found.` };
  }

  // First verify case clearance
  const caseClearance = canAccessCase(user, parentCase);
  if (!caseClearance.granted) {
    return caseClearance;
  }

  // Forensic role can only access evidence in handoff states
  if (user.role === 'FORENSIC_EXAMINER') {
    const handoffs = db.getHandoffsForEvidence(evidenceRecord.id);
    const hasForensicCustody = handoffs.some((h) =>
      ['SUBMITTED', 'RECEIVED', 'UNDER_EXAMINATION', 'REPORT_READY'].includes(h.status)
    );
    if (!hasForensicCustody && evidenceRecord.current_status === 'ACQUIRED') {
      return {
        granted: false,
        reason: `Evidence '${evidenceRecord.id}' has not been transferred to the Forensic Department.`,
      };
    }
  }

  // Prosecution role can only access evidence ready for trial
  if (user.role === 'PUBLIC_PROSECUTOR') {
    const reports = db.getReportsForEvidence(evidenceRecord.id);
    const isReady =
      evidenceRecord.current_status === 'PROSECUTION_READY' ||
      reports.length > 0 ||
      parentCase.status === 'PROSECUTION_REVIEW';
    if (!isReady) {
      return {
        granted: false,
        reason: `Evidence '${evidenceRecord.id}' examination is incomplete or not yet admitted to prosecution.`,
      };
    }
  }

  return { granted: true };
}

// ----------------------------------------------------------------------------
// Download Authorization Guard & Safe URLs
// ----------------------------------------------------------------------------
export function authorizeEvidenceDownload(
  context: SecurityContext,
  evidenceRecord: EvidenceRecord,
  db: EvidenceVaultDatabase
): { authorized: boolean; error?: string } {
  // 1. Rate Limiting Check
  const rateLimit = globalRateLimiter.checkDownloadRateLimit(context.actorId);
  if (!rateLimit.allowed) {
    throw new RateLimitExceededError('DOWNLOAD_EVIDENCE', 60);
  }

  // 2. IDOR / Access Clearance Check
  const access = canAccessEvidence({ id: context.actorId, role: context.role }, evidenceRecord, db);
  if (!access.granted) {
    throw new IdorAccessDeniedError(evidenceRecord.id, context.actorId, context.role);
  }

  return { authorized: true };
}

// ----------------------------------------------------------------------------
// Dedicated Admin Clearance & Restricted Audit Guards
// ----------------------------------------------------------------------------
export function canAccessAdminPortal(
  userOrRole: { id?: string; role: UserRole } | UserRole | string,
  db?: EvidenceVaultDatabase
): boolean {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  const userId = typeof userOrRole === 'object' ? userOrRole.id : undefined;

  if (role !== 'SYSTEM_ADMIN') {
    return false;
  }

  if (db && userId) {
    const userInDb = db.getUser(userId);
    if (!userInDb || userInDb.role !== 'SYSTEM_ADMIN') {
      return false;
    }
    if (userInDb.active_status === 'SUSPENDED' || userInDb.active_status === 'INACTIVE') {
      return false;
    }
  }

  return true;
}

export function authorizeAdminClearance(
  context: SecurityContext,
  db: EvidenceVaultDatabase,
  actionName: string = 'ACCESS_ADMIN_PORTAL'
): void {
  const role = context.role;
  const userId = context.actorId;

  if (role !== 'SYSTEM_ADMIN') {
    throw new AdminAccessDeniedError(
      actionName,
      context.actorId,
      context.role,
      `Ordinary '${role}' users are not permitted to access Admin Portal or Audit Logs.`
    );
  }

  if (db && userId) {
    const userInDb = db.getUser(userId);
    if (!userInDb) {
      throw new AdminAccessDeniedError(
        actionName,
        context.actorId,
        context.role,
        `User record '${userId}' not found in authorization directory.`
      );
    }
    if (userInDb.role !== 'SYSTEM_ADMIN') {
      throw new AdminAccessDeniedError(
        actionName,
        context.actorId,
        context.role,
        `Privilege Escalation Blocked: Persisted database role is '${userInDb.role}', not 'SYSTEM_ADMIN'.`
      );
    }
    if (userInDb.active_status === 'SUSPENDED' || userInDb.active_status === 'INACTIVE') {
      throw new AdminAccessDeniedError(
        actionName,
        context.actorId,
        context.role,
        `Administrator account is currently ${userInDb.active_status}.`
      );
    }
  }
}

// ----------------------------------------------------------------------------
// Security Audit Logger & Sanitization (Never Leaks Secrets or Passwords)
// ----------------------------------------------------------------------------
const globalSecurityLog: SecurityAuditLogEntry[] = [];

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /pin/i,
  /passcode/i,
  /secret/i,
  /token/i,
  /credential/i,
  /privatekey/i,
  /data/i,
  /buffer/i,
];

export function sanitizePayloadForAudit(payload?: Record<string, unknown>): Record<string, unknown> {
  if (!payload) return {};
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEY_PATTERNS.some((p) => p.test(key))) {
      cleaned[key] = '[REDACTED_CONFIDENTIAL]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      cleaned[key] = sanitizePayloadForAudit(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export async function logSecurityViolation(
  entry: Omit<SecurityAuditLogEntry, 'id' | 'timestamp'>,
  db?: EvidenceVaultDatabase
): Promise<SecurityAuditLogEntry> {
  const timestamp = new Date().toISOString();
  const id = `SEC-VIO-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const sanitized: SecurityAuditLogEntry = {
    ...entry,
    id,
    timestamp,
    sanitizedPayload: sanitizePayloadForAudit(entry.sanitizedPayload),
  };

  globalSecurityLog.push(sanitized);

  if (db) {
    try {
      await db.recordAuditEvent(
        entry.actorId,
        `SECURITY_VIOLATION_${entry.violationType}`,
        'SecurityModule',
        entry.resource,
        {
          violationType: entry.violationType,
          attemptedAction: entry.attemptedAction,
          reason: entry.reason,
          ...sanitized.sanitizedPayload,
        }
      );
    } catch (err) {
      console.error('Failed to log security violation to database:', err);
    }
  }

  return sanitized;
}

export function getSecurityViolationLogs(): SecurityAuditLogEntry[] {
  return [...globalSecurityLog];
}

export function clearSecurityLogs(): void {
  globalSecurityLog.length = 0;
}
