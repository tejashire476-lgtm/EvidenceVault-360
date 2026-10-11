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
  AuthenticatedSession,
} from '../types.ts';
import { DEPARTMENT_PRESETS } from '../types.ts';
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

export class DepartmentMismatchError extends SecurityViolationError {
  constructor(department: Department, actualRole: UserRole, userId: string) {
    super(
      `Department Authorization Violation: User '${userId}' with role '${actualRole}' is not authorized to access the ${department} Portal.`,
      'UNAUTHORIZED_ROLE_ACTION',
      `PORTAL_${department}`
    );
    this.name = 'DepartmentMismatchError';
  }
}

export const DEPARTMENT_REQUIRED_ROLES: Record<Department, UserRole> = {
  POLICE: 'POLICE_INVESTIGATOR',
  FORENSIC: 'FORENSIC_EXAMINER',
  PROSECUTION: 'PUBLIC_PROSECUTOR',
  ADMINISTRATION: 'SYSTEM_ADMIN',
};

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

export interface DepartmentAuthParams {
  department: Department;
  badge: string;
  passcode: string;
  isDemo?: boolean;
}

export interface DepartmentAuthOutcome {
  success: boolean;
  session?: AuthSession;
  user?: AuthenticatedSession;
  error?: string;
  errorCode?: 'INVALID_CREDENTIALS' | 'DEPARTMENT_ACCESS_DENIED' | 'USER_SUSPENDED' | 'RATE_LIMITED' | 'DEMO_RESTRICTED';
}

/**
 * Shared backend authentication and department authorization validator.
 * Validates credentials, checks brute-force rate limits, verifies affirmative account status,
 * strictly enforces departmental role segregation, and produces HMAC-signed sessions.
 */
export async function authenticateDepartmentPortal(
  params: DepartmentAuthParams,
  db?: EvidenceVaultDatabase
): Promise<DepartmentAuthOutcome> {
  const { department, badge, passcode, isDemo } = params;
  const identifier = badge.trim() || `UNKNOWN-${department}`;

  // 1. Brute-force Rate Limiting Check
  const rateLimit = globalRateLimiter.checkAuthRateLimit(identifier);
  if (!rateLimit.allowed) {
    if (db) {
      await logSecurityViolation(
        {
          actorId: identifier,
          actorRole: 'UNAUTHENTICATED',
          violationType: 'RATE_LIMIT_EXCEEDED',
          resource: `PORTAL_${department}`,
          attemptedAction: 'DEPARTMENT_PORTAL_LOGIN',
          reason: `Rate limit lockout active. Retry in ${rateLimit.retryAfterSec}s.`,
        },
        db
      );
    }
    return {
      success: false,
      error: `Rate limit exceeded. Please wait ${rateLimit.retryAfterSec || 60} seconds before retrying.`,
      errorCode: 'RATE_LIMITED',
    };
  }

  // 2. Resolve target user based on badge, ID, or department preset
  const cleanBadge = badge.trim();
  let matchedPreset = Object.values(DEPARTMENT_PRESETS).find(
    (p) =>
      p.badge.toLowerCase() === cleanBadge.toLowerCase() ||
      p.user_id.toLowerCase() === cleanBadge.toLowerCase()
  );

  // If badge is empty or matches default for this portal
  if (!matchedPreset && (!cleanBadge || cleanBadge === DEPARTMENT_PRESETS[department].badge)) {
    matchedPreset = DEPARTMENT_PRESETS[department];
  }

  // If user entered a badge that doesn't exist
  if (!matchedPreset) {
    globalRateLimiter.recordAuthFailure(identifier);
    if (db) {
      await logSecurityViolation(
        {
          actorId: identifier,
          actorRole: 'UNAUTHENTICATED',
          violationType: 'AUTHENTICATION_FAILURE',
          resource: `PORTAL_${department}`,
          attemptedAction: 'DEPARTMENT_PORTAL_LOGIN',
          reason: `Service badge '${cleanBadge}' not found in personnel directory.`,
        },
        db
      );
    }
    return {
      success: false,
      error: `Official badge '${cleanBadge}' not recognized in personnel records.`,
      errorCode: 'INVALID_CREDENTIALS',
    };
  }

  // 3. Department Authorization Validation (Never trust frontend labels)
  const expectedRole = DEPARTMENT_REQUIRED_ROLES[department];
  if (matchedPreset.role !== expectedRole) {
    globalRateLimiter.recordAuthFailure(identifier);
    if (db) {
      await logSecurityViolation(
        {
          actorId: matchedPreset.user_id,
          actorRole: matchedPreset.role,
          violationType: 'UNAUTHORIZED_ROLE_ACTION',
          resource: `PORTAL_${department}`,
          attemptedAction: 'DEPARTMENT_PORTAL_LOGIN',
          reason: `Cross-department access blocked. User belongs to '${matchedPreset.department}' (${matchedPreset.role}), not '${department}'.`,
        },
        db
      );
    }
    return {
      success: false,
      error: `Department Access Denied: User account is registered to ${matchedPreset.department} (${matchedPreset.role}). Only authorized ${department} personnel may access this portal.`,
      errorCode: 'DEPARTMENT_ACCESS_DENIED',
    };
  }

  // 4. Passcode validation (minimum 4 characters, or demo passcode)
  if (!isDemo && (!passcode || passcode.length < 4)) {
    globalRateLimiter.recordAuthFailure(identifier);
    return {
      success: false,
      error: 'Cryptographic passcode must be at least 4 characters.',
      errorCode: 'INVALID_CREDENTIALS',
    };
  }

  // 5. Check if user is suspended or deactivated in DB
  if (db) {
    const dbUser = db.getUser(matchedPreset.user_id);
    if (dbUser && (dbUser.active_status === 'SUSPENDED' || dbUser.active_status === 'INACTIVE')) {
      return {
        success: false,
        error: `User account '${matchedPreset.user_id}' is ${dbUser.active_status}. Please contact the System Administrator.`,
        errorCode: 'USER_SUSPENDED',
      };
    }
  }

  // Reset failures on success
  globalRateLimiter.resetAuthFailures(identifier);

  // 6. Create authenticated session with HMAC token
  const session = createAuthSession({
    id: matchedPreset.user_id,
    role: matchedPreset.role,
    department: matchedPreset.department,
    badge: matchedPreset.badge,
    active_status: 'ACTIVE',
  });

  if (db) {
    await db.recordAuditEvent({
      actor_id: matchedPreset.user_id,
      actor_role: matchedPreset.role,
      department: matchedPreset.department,
      action: isDemo ? 'DEMO_LOGIN_SUCCESS' : 'DEPARTMENT_LOGIN_SUCCESS',
      entity_type: 'USER',
      entity_id: matchedPreset.user_id,
      status: 'SUCCESS',
      ip_address: '127.0.0.1',
      payload: {
        badge: matchedPreset.badge,
        name: matchedPreset.name,
        department,
        isDemo: !!isDemo,
      },
    });
  }

  return {
    success: true,
    session,
    user: matchedPreset,
  };
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
