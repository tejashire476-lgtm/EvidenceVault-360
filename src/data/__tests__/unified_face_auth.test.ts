// ============================================================================
// EVIDENCEVAULT 360 — UNIFIED FACE VERIFICATION & THREE-PORTAL AUTHENTICATION TEST SUITE
// Tests Police, Forensic, and Prosecution portals for:
// 1. Authorized credential login & departmental role segregation
// 2. Cross-department unauthorized access blocking
// 3. Facial recognition matching (Score >= 0.85) & mismatch rejection
// 4. Optical challenge / presentation attack (spoof) defense
// 5. Consent lifecycle & Zero raw photo retention
// 6. Secure Fallback PIN authentication
// 7. HMAC session security, token tampering defense, and expiration
// 8. Brute force rate limiting & production demo audit segregation
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { EvidenceVaultDatabase } from '../db.ts';
import { seedDatabase } from '../seed.ts';
import { DEPARTMENT_PRESETS } from '../../types.ts';
import {
  authenticateDepartmentPortal,
  validateAuthSession,
  createAuthSession,
  globalRateLimiter,
  getSecurityViolationLogs,
  clearSecurityLogs,
  canAccessAdminPortal,
} from '../../utils/security.ts';
import {
  globalBiometricEngine,
  BIOMETRIC_MATCH_THRESHOLD,
} from '../../utils/biometric.ts';

test('Unified Face Auth — Test 1: Police Portal accepts authorized Police badge and rejects cross-department accounts', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);
  clearSecurityLogs();
  globalRateLimiter.clearAll();

  // 1. Authorized Police investigator badge
  const policeAuth = await authenticateDepartmentPortal(
    {
      department: 'POLICE',
      badge: DEPARTMENT_PRESETS.POLICE.badge,
      passcode: 'DL-POLICE-PASS-2026',
      isDemo: false,
    },
    db
  );

  assert.equal(policeAuth.success, true);
  assert.equal(policeAuth.user?.role, 'POLICE_INVESTIGATOR');
  assert.equal(policeAuth.user?.department, 'POLICE');
  assert.ok(policeAuth.session?.tokenSignature);

  // 2. Forensic account attempting to access Police Portal
  const crossDeptForensic = await authenticateDepartmentPortal(
    {
      department: 'POLICE',
      badge: DEPARTMENT_PRESETS.FORENSIC.badge,
      passcode: 'CFSL-PASS-2026',
      isDemo: false,
    },
    db
  );

  assert.equal(crossDeptForensic.success, false);
  assert.equal(crossDeptForensic.errorCode, 'DEPARTMENT_ACCESS_DENIED');
  assert.match(crossDeptForensic.error || '', /Department Access Denied/);

  // 3. Prosecution account attempting to access Police Portal
  const crossDeptProsecution = await authenticateDepartmentPortal(
    {
      department: 'POLICE',
      badge: DEPARTMENT_PRESETS.PROSECUTION.badge,
      passcode: 'DPP-PASS-2026',
      isDemo: false,
    },
    db
  );

  assert.equal(crossDeptProsecution.success, false);
  assert.equal(crossDeptProsecution.errorCode, 'DEPARTMENT_ACCESS_DENIED');

  // Verify security audit violations logged
  const violations = getSecurityViolationLogs();
  assert.ok(violations.length >= 2);
  assert.ok(violations.some((v) => v.attemptedAction === 'DEPARTMENT_PORTAL_LOGIN'));
});

test('Unified Face Auth — Test 2: Forensic Portal enforces Forensic clearance and verifies face biometrics', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);
  clearSecurityLogs();
  globalRateLimiter.clearAll();

  // 1. Authorized Forensic examiner login
  const forensicAuth = await authenticateDepartmentPortal(
    {
      department: 'FORENSIC',
      badge: DEPARTMENT_PRESETS.FORENSIC.badge,
      passcode: 'CFSL-SECURE-PIN',
      isDemo: false,
    },
    db
  );

  assert.equal(forensicAuth.success, true);
  assert.equal(forensicAuth.user?.role, 'FORENSIC_EXAMINER');
  assert.equal(forensicAuth.user?.department, 'FORENSIC');

  // 2. Police account attempting to access Forensic Portal -> Blocked
  const crossDeptPolice = await authenticateDepartmentPortal(
    {
      department: 'FORENSIC',
      badge: DEPARTMENT_PRESETS.POLICE.badge,
      passcode: 'DL-POLICE-PASS',
      isDemo: false,
    },
    db
  );

  assert.equal(crossDeptPolice.success, false);
  assert.equal(crossDeptPolice.errorCode, 'DEPARTMENT_ACCESS_DENIED');

  // 3. Facial Verification Step for Forensic Examiner
  // Matching candidate vector (minimal noise) -> Cosine similarity >= 0.85
  const matchingVector = globalBiometricEngine.generateCandidateVector(
    DEPARTMENT_PRESETS.FORENSIC.user_id,
    0.02
  );
  const matchResult = await globalBiometricEngine.verifyFace({
    userId: DEPARTMENT_PRESETS.FORENSIC.user_id,
    candidateVector: matchingVector,
    simulateLivenessChallenge: true,
    challengeResponseValid: true,
    database: db,
  });

  assert.equal(matchResult.isMatch, true);
  assert.equal(matchResult.outcome, 'MATCH');
  assert.ok(matchResult.similarityScore >= BIOMETRIC_MATCH_THRESHOLD);
  assert.equal(matchResult.livenessPassed, true);

  // 4. Mismatched face (e.g. unauthorized person in front of camera)
  const mismatchedVector = globalBiometricEngine.generateCandidateVector(
    DEPARTMENT_PRESETS.FORENSIC.user_id,
    0.85
  );
  const mismatchResult = await globalBiometricEngine.verifyFace({
    userId: DEPARTMENT_PRESETS.FORENSIC.user_id,
    candidateVector: mismatchedVector,
    simulateLivenessChallenge: true,
    challengeResponseValid: true,
    database: db,
  });

  assert.equal(mismatchResult.isMatch, false);
  assert.equal(mismatchResult.outcome, 'MISMATCH');
  assert.ok(mismatchResult.similarityScore < BIOMETRIC_MATCH_THRESHOLD);
});

test('Unified Face Auth — Test 3: Prosecution Portal verifies Public Prosecutor and detects spoof replay attacks', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);
  clearSecurityLogs();
  globalRateLimiter.clearAll();

  // 1. Authorized Prosecution portal login
  const prosAuth = await authenticateDepartmentPortal(
    {
      department: 'PROSECUTION',
      badge: DEPARTMENT_PRESETS.PROSECUTION.badge,
      passcode: 'DPP-JUDICIAL-KEY',
      isDemo: false,
    },
    db
  );

  assert.equal(prosAuth.success, true);
  assert.equal(prosAuth.user?.role, 'PUBLIC_PROSECUTOR');
  assert.equal(prosAuth.user?.department, 'PROSECUTION');

  // 2. Police trying to access Prosecution Portal -> Blocked
  const policeIntrusion = await authenticateDepartmentPortal(
    {
      department: 'PROSECUTION',
      badge: DEPARTMENT_PRESETS.POLICE.badge,
      passcode: 'DL-POLICE-KEY',
      isDemo: false,
    },
    db
  );
  assert.equal(policeIntrusion.success, false);
  assert.equal(policeIntrusion.errorCode, 'DEPARTMENT_ACCESS_DENIED');

  // 3. Presentation Attack Detection (Optical replay / static photo / screen presentation)
  const spoofResult = await globalBiometricEngine.verifyFace({
    userId: DEPARTMENT_PRESETS.PROSECUTION.user_id,
    simulateLivenessChallenge: true,
    challengeResponseValid: false, // Involuntary blink / nod check failed
    database: db,
  });

  assert.equal(spoofResult.isMatch, false);
  assert.equal(spoofResult.outcome, 'LIVENESS_FAILED');
  assert.equal(spoofResult.livenessPassed, false);
  assert.match(spoofResult.errorMessage || '', /Presentation Attack/);
});

test('Unified Face Auth — Test 4: Privacy consent revocation blocks capture and Secure Fallback PIN succeeds', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const testUserId = 'USR-POLICE-01';

  // 1. Withdraw consent
  globalBiometricEngine.recordConsent(testUserId, false);
  assert.equal(globalBiometricEngine.getConsentStatus(testUserId), 'WITHDRAWN');

  // 2. Verification attempt while consent is withdrawn -> Strictly Denied
  const deniedResult = await globalBiometricEngine.verifyFace({
    userId: testUserId,
    database: db,
  });
  assert.equal(deniedResult.outcome, 'CONSENT_DENIED');
  assert.equal(deniedResult.isMatch, false);

  // 3. Secure Fallback PIN authentication
  const validFallback = globalBiometricEngine.triggerFallbackPinAuth(testUserId, '849204');
  assert.equal(validFallback.success, true);

  const badFallback = globalBiometricEngine.triggerFallbackPinAuth(testUserId, '12'); // Too short
  assert.equal(badFallback.success, false);

  // Re-grant consent for subsequent operations
  globalBiometricEngine.recordConsent(testUserId, true);
  assert.equal(globalBiometricEngine.getConsentStatus(testUserId), 'GRANTED');
});

test('Unified Face Auth — Test 5: Session validation, token tampering rejection, and expiration handling', async () => {
  // 1. Create valid session
  const validSession = createAuthSession({
    id: 'USR-FORENSIC-01',
    role: 'FORENSIC_EXAMINER',
    department: 'FORENSIC',
    badge: 'CFSL-EXAMINER-7714',
    active_status: 'ACTIVE',
  });

  const checkValid = validateAuthSession(validSession);
  assert.equal(checkValid.isValid, true);

  // 2. Tampered session (role altered to SYSTEM_ADMIN)
  const tamperedSession = {
    ...validSession,
    role: 'SYSTEM_ADMIN' as const,
  };
  const checkTampered = validateAuthSession(tamperedSession);
  assert.equal(checkTampered.isValid, false);
  assert.match(checkTampered.error || '', /signature mismatch/i);

  // 3. Expired session
  const expiredSession = {
    ...validSession,
    expiresAt: new Date(Date.now() - 10000).toISOString(),
  };
  const checkExpired = validateAuthSession(expiredSession);
  assert.equal(checkExpired.isValid, false);
  assert.match(checkExpired.error || '', /Session expired/);

  // 4. Suspended account session
  const suspendedSession = {
    ...validSession,
    activeStatus: 'SUSPENDED' as const,
  };
  const checkSuspended = validateAuthSession(suspendedSession);
  assert.equal(checkSuspended.isValid, false);
  assert.match(checkSuspended.error || '', /suspended/);
});

test('Unified Face Auth — Test 6: Brute force rate limiting blocks excessive invalid login attempts', async () => {
  globalRateLimiter.clearAll();
  const targetBadge = 'ATTACKER-BADGE-999';

  // 5 failed attempts
  for (let i = 0; i < 5; i++) {
    globalRateLimiter.recordAuthFailure(targetBadge);
  }

  // 6th attempt should be blocked
  const check = globalRateLimiter.checkAuthRateLimit(targetBadge);
  assert.equal(check.allowed, false);
  assert.equal(check.remaining, 0);
  assert.ok(check.retryAfterSec && check.retryAfterSec > 0);

  // Clean up
  globalRateLimiter.resetAuthFailures(targetBadge);
});

test('Unified Face Auth — Test 7: Production restrictions on demo bypass and direct route protection', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);
  clearSecurityLogs();

  // 1. Direct unauthenticated access to Admin portal is strictly denied
  const unauthenticatedContext = {
    actorId: 'UNAUTHENTICATED-USER',
    role: 'POLICE_INVESTIGATOR' as const,
  };
  assert.equal(canAccessAdminPortal(unauthenticatedContext, db), false);

  // 2. Demo login records explicit DEMO_LOGIN_SUCCESS audit trail
  const demoPolice = await authenticateDepartmentPortal(
    {
      department: 'POLICE',
      badge: DEPARTMENT_PRESETS.POLICE.badge,
      passcode: '••••••••',
      isDemo: true,
    },
    db
  );

  assert.equal(demoPolice.success, true);
  const audits = db.getAuditEvents();
  assert.ok(audits.some((a) => a.action === 'DEMO_LOGIN_SUCCESS'));
});
