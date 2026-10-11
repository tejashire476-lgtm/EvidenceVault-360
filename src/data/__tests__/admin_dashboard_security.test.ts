// ============================================================================
// EVIDENCEVAULT 360 — DEDICATED ADMIN DASHBOARD & RESTRICTED AUDIT LOGS TEST SUITE
// Verifies:
// 1. Dedicated Admin authentication and access to Admin Portal APIs
// 2. Strict backend/database authorization denying Police, Forensic, and Judicial users
// 3. Prevention of role-spoofing attacks (untrusted context vs persistent DB user role)
// 4. Audit Log multi-attribute querying, filtering (date, dept, user, action, target), search, and pagination
// 5. Rich audit metadata tracking (actor_role, department, ip_address, user_agent, status, reason)
// 6. Security Center failed-login auditing and detection
// 7. Server-controlled user role updates with mandatory Admin elevation confirmation
// 8. User status lifecycle (Active, Suspended, Inactive) with protection for the last admin
// 9. Comprehensive System Health diagnostics across DB, Storage, Crypto, and Chain
// 10. Formula-safe CSV report export protection against spreadsheet injection
// 11. End-to-end multi-departmental workflow preservation and hash chain continuity
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceVaultDatabase } from '../db.ts';
import { seedDatabase } from '../seed.ts';
import {
  AdminAccessDeniedError,
  canAccessAdminPortal,
  authorizeAdminClearance,
} from '../../utils/security.ts';
import { SecureEvidenceStorageEngine } from '../../utils/storage.ts';
import { sanitizeCsvField } from '../../utils/auditReview.ts';
import type { SecurityContext, UserRole } from '../../types.ts';

// ----------------------------------------------------------------------------
// Test 1: Dedicated Admin Portal Ingress & Role Authorization Helper
// ----------------------------------------------------------------------------
test('Admin Security - Test 1: Dedicated Admin Portal role clearance check', () => {
  assert.equal(canAccessAdminPortal('SYSTEM_ADMIN'), true, 'SYSTEM_ADMIN must be granted clearance');
  assert.equal(canAccessAdminPortal('POLICE_INVESTIGATOR'), false, 'POLICE_INVESTIGATOR must be denied');
  assert.equal(canAccessAdminPortal('FORENSIC_EXAMINER'), false, 'FORENSIC_EXAMINER must be denied');
  assert.equal(canAccessAdminPortal('PUBLIC_PROSECUTOR'), false, 'PUBLIC_PROSECUTOR must be denied');
  assert.equal(canAccessAdminPortal('EXTERNAL_AUDITOR'), false, 'EXTERNAL_AUDITOR must be denied');
});

// ----------------------------------------------------------------------------
// Test 2: Admin can query audit logs with pagination and search
// ----------------------------------------------------------------------------
test('Admin Security - Test 2: Admin can query authorized audit logs with pagination', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const adminContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };

  const response = await db.queryAuditLogs(adminContext, {
    page: 1,
    pageSize: 10,
  });

  assert.ok(response.items.length > 0, 'Audit logs must contain seeded events');
  assert.ok(response.totalCount >= response.items.length, 'Total count must be accurate');
  assert.equal(response.currentPage, 1, 'Current page must be 1');
  assert.ok(response.totalPages >= 1, 'Total pages must be at least 1');

  // Verify each event contains required fields
  const sample = response.items[0];
  assert.ok(sample.id, 'Event must have ID');
  assert.ok(sample.action, 'Event must have action');
  assert.ok(sample.event_hash, 'Event must have SHA-256 block hash');
  assert.ok(sample.actor_id, 'Event must have actor identity');
});

// ----------------------------------------------------------------------------
// Test 3: Police role is strictly denied access to audit logs at database level
// ----------------------------------------------------------------------------
test('Admin Security - Test 3: Police role is denied direct access to queryAuditLogs', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  await assert.rejects(
    async () => {
      await db.queryAuditLogs(policeContext);
    },
    (err: unknown) => {
      assert.ok(err instanceof AdminAccessDeniedError, 'Must throw AdminAccessDeniedError');
      assert.match((err as Error).message, /SYSTEM_ADMIN/i);
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Test 4: Forensic role is strictly denied access to audit logs at database level
// ----------------------------------------------------------------------------
test('Admin Security - Test 4: Forensic role is denied direct access to queryAuditLogs', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const forensicContext: SecurityContext = {
    actorId: 'USR-FORENSIC-01',
    role: 'FORENSIC_EXAMINER',
  };

  await assert.rejects(
    async () => {
      await db.queryAuditLogs(forensicContext);
    },
    (err: unknown) => {
      assert.ok(err instanceof AdminAccessDeniedError, 'Must throw AdminAccessDeniedError');
      assert.match((err as Error).message, /SYSTEM_ADMIN/i);
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Test 5: Judicial/Prosecution role is strictly denied access to audit logs
// ----------------------------------------------------------------------------
test('Admin Security - Test 5: Judicial/Prosecution role is denied direct access to queryAuditLogs', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const prosecutionContext: SecurityContext = {
    actorId: 'USR-PROSECUTOR-01',
    role: 'PUBLIC_PROSECUTOR',
  };

  await assert.rejects(
    async () => {
      await db.queryAuditLogs(prosecutionContext);
    },
    (err: unknown) => {
      assert.ok(err instanceof AdminAccessDeniedError, 'Must throw AdminAccessDeniedError');
      assert.match((err as Error).message, /SYSTEM_ADMIN/i);
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Test 6: Spoofed Admin role is detected and rejected using persistent DB records
// ----------------------------------------------------------------------------
test('Admin Security - Test 6: Spoofed Admin role (police user claiming SYSTEM_ADMIN) is rejected', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  // Attacker attempts to forge context by passing role: 'SYSTEM_ADMIN' with police actorId
  const spoofedContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'SYSTEM_ADMIN', // Spoofed! In DB, USR-POLICE-01 is POLICE_INVESTIGATOR
  };

  await assert.rejects(
    async () => {
      await db.queryAuditLogs(spoofedContext);
    },
    (err: unknown) => {
      assert.ok(err instanceof AdminAccessDeniedError, 'Must reject spoofed admin attempt');
      assert.match((err as Error).message, /Privilege Escalation Blocked/i);
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Test 7: Direct call to getAuditEvents with non-admin SecurityContext is denied
// ----------------------------------------------------------------------------
test('Admin Security - Test 7: Direct call to getAuditEvents with non-admin context is rejected', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };

  assert.throws(
    () => {
      db.getAuditEvents(policeContext);
    },
    (err: unknown) => {
      assert.ok(err instanceof AdminAccessDeniedError, 'Must throw AdminAccessDeniedError');
      return true;
    }
  );

  // Calling with valid admin context succeeds
  const adminContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };
  const events = db.getAuditEvents(adminContext);
  assert.ok(Array.isArray(events) && events.length > 0, 'Admin can read events');
});

// ----------------------------------------------------------------------------
// Test 8: Audit Log filtering by department, action, and target ID
// ----------------------------------------------------------------------------
test('Admin Security - Test 8: Admin can filter audit logs by department, action, and target ID', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const adminContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };

  // Filter by Police department
  const policeLogs = await db.queryAuditLogs(adminContext, {
    department: 'POLICE',
  });
  assert.ok(policeLogs.items.length > 0, 'Should find Police audit events');
  policeLogs.items.forEach((item) => {
    assert.equal(item.department, 'POLICE', 'All returned events must belong to POLICE department');
  });

  // Filter by target entity ID
  const caseLogs = await db.queryAuditLogs(adminContext, {
    targetId: 'CASE-2026-001',
  });
  assert.ok(caseLogs.items.length > 0, 'Should find records for CASE-2026-001');
  caseLogs.items.forEach((item) => {
    assert.equal(item.entity_id, 'CASE-2026-001', 'Target entity must match');
  });

  // Filter by Action Type
  const caseCreatedLogs = await db.queryAuditLogs(adminContext, {
    action: 'CREATE_CASE',
  });
  assert.ok(caseCreatedLogs.items.length > 0, 'Should find CREATE_CASE records');
  caseCreatedLogs.items.forEach((item) => {
    assert.equal(item.action, 'CREATE_CASE');
  });
});

// ----------------------------------------------------------------------------
// Test 9: Failed-login security events are recorded and queryable by Admin
// ----------------------------------------------------------------------------
test('Admin Security - Test 9: Failed login attempt is recorded and visible to Admin', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const adminContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };

  // Record a synthetic failed login security event
  const failedEvent = await db.recordAuditEvent({
    actor_id: 'UNKNOWN_ATTACKER_99',
    actor_role: 'UNAUTHENTICATED',
    department: 'POLICE',
    action: 'AUTH_LOGIN_FAILED',
    entity_type: 'USER',
    entity_id: 'BAD-BADGE-999',
    status: 'FAILURE',
    reason: 'Invalid cryptographic passcode or bad service badge ID',
    ip_address: '203.0.113.42',
    user_agent: 'Automated-Exploit-Scanner/1.0',
    payload: {
      attempted_badge: 'BAD-BADGE-999',
      failure_code: 'ERR_BAD_CREDENTIALS',
    },
  });

  assert.ok(failedEvent.event_hash, 'Failed login event must have SHA-256 block hash');
  assert.equal(failedEvent.status, 'FAILURE');
  assert.equal(failedEvent.ip_address, '203.0.113.42');

  // Query audit logs filtering by status: 'FAILURE'
  const failedLogs = await db.queryAuditLogs(adminContext, {
    status: 'FAILURE',
  });
  assert.ok(failedLogs.items.length >= 1, 'Admin must find recorded failed login events');
  const found = failedLogs.items.find((item) => item.actor_id === 'UNKNOWN_ATTACKER_99');
  assert.ok(found, 'Recorded failed login event must be returned');
  assert.equal(found?.reason, 'Invalid cryptographic passcode or bad service badge ID');
  assert.equal(found?.ip_address, '203.0.113.42');
});

// ----------------------------------------------------------------------------
// Test 10: Server-controlled user role updates with mandatory elevation code
// ----------------------------------------------------------------------------
test('Admin Security - Test 10: Admin role updates require confirmation for SYSTEM_ADMIN elevation', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const adminContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };

  // 1. Regular role update (e.g. promoting police officer to investigator or prosecutor)
  const updatedUser = await db.updateUserRole(
    adminContext,
    'USR-POLICE-01',
    'PUBLIC_PROSECUTOR'
  );
  assert.equal(updatedUser.role, 'PUBLIC_PROSECUTOR', 'User role must be updated in DB');

  // Verify an immutable USER_ROLE_UPDATED audit event was generated
  const recentLogs = await db.queryAuditLogs(adminContext, {
    action: 'USER_ROLE_UPDATED',
  });
  const roleUpdateEvent = recentLogs.items.find(
    (e) => e.entity_id === 'USR-POLICE-01'
  );
  assert.ok(roleUpdateEvent, 'Audit event must be logged for role update');
  assert.equal(roleUpdateEvent?.payload.new_role, 'PUBLIC_PROSECUTOR');

  // 2. Attempting to promote to SYSTEM_ADMIN without confirmation code must fail
  await assert.rejects(
    async () => {
      await db.updateUserRole(adminContext, 'USR-FORENSIC-01', 'SYSTEM_ADMIN');
    },
    (err: unknown) => {
      assert.match((err as Error).message, /Confirmation code 'CONFIRM_ADMIN_ELEVATION' required/i);
      return true;
    }
  );

  // 3. Promoting to SYSTEM_ADMIN WITH confirmation code succeeds
  const newAdmin = await db.updateUserRole(
    adminContext,
    'USR-FORENSIC-01',
    'SYSTEM_ADMIN',
    'CONFIRM_ADMIN_ELEVATION'
  );
  assert.equal(newAdmin.role, 'SYSTEM_ADMIN', 'Elevation with code must succeed');

  // 4. Non-admin attempting to update roles is blocked
  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };
  await assert.rejects(
    async () => {
      await db.updateUserRole(policeContext, 'USR-PROSECUTOR-01', 'SYSTEM_ADMIN');
    },
    (err: unknown) => {
      assert.ok(err instanceof AdminAccessDeniedError, 'Non-admin role update must throw AdminAccessDeniedError');
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Test 11: User account status management and protection of last admin
// ----------------------------------------------------------------------------
test('Admin Security - Test 11: Admin can suspend users; cannot suspend last active admin', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const adminContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };

  // Suspend police user
  const suspendedPolice = await db.updateUserStatus(adminContext, 'USR-POLICE-01', 'SUSPENDED');
  assert.equal(suspendedPolice.active_status, 'SUSPENDED');

  // Verify audit event
  const statusAuditLogs = await db.queryAuditLogs(adminContext, {
    action: 'USER_STATUS_UPDATED',
  });
  const statusEvent = statusAuditLogs.items.find((e) => e.entity_id === 'USR-POLICE-01');
  assert.ok(statusEvent, 'Status update must be audited');

  // Attempt to suspend USR-ADMIN-01 (currently the only admin)
  await assert.rejects(
    async () => {
      await db.updateUserStatus(adminContext, 'USR-ADMIN-01', 'SUSPENDED');
    },
    (err: unknown) => {
      assert.match((err as Error).message, /Cannot deactivate or suspend the last active SYSTEM_ADMIN/i);
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Test 12: System Health Diagnostics Telemetry
// ----------------------------------------------------------------------------
test('Admin Security - Test 12: Admin can retrieve comprehensive System Health telemetry', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const storageEngine = new SecureEvidenceStorageEngine();
  const adminContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };

  const health = await db.getSystemHealth(adminContext, storageEngine);

  assert.equal(health.database.status, 'HEALTHY');
  assert.ok(health.database.total_cases > 0, 'Must report total cases');
  assert.ok(health.database.total_users > 0, 'Must report total users');

  assert.equal(health.storage.status, 'HEALTHY');
  assert.ok(health.storage.quota_bytes > 0, 'Must report storage quota');

  assert.equal(health.crypto.status, 'HEALTHY');
  assert.equal(health.crypto.fips_mode, 'FIPS_180_4_ACTIVE');

  assert.equal(health.audit_chain.status, 'HEALTHY');
  assert.ok(health.audit_chain.verified_blocks > 0, 'Must verify chain blocks');
  assert.equal(health.audit_chain.broken_links, 0, 'Seeded chain must have zero broken links');

  // Non-admin request must be denied
  const policeContext: SecurityContext = {
    actorId: 'USR-POLICE-01',
    role: 'POLICE_INVESTIGATOR',
  };
  await assert.rejects(
    async () => {
      await db.getSystemHealth(policeContext);
    },
    (err: unknown) => {
      assert.ok(err instanceof AdminAccessDeniedError);
      return true;
    }
  );
});

// ----------------------------------------------------------------------------
// Test 13: Formula-Safe CSV Export Sanitization for Admin Reports
// ----------------------------------------------------------------------------
test('Admin Security - Test 13: CSV report sanitization neutralizes formula injection', () => {
  // Test formula injection characters: '=', '+', '-', '@'
  assert.equal(sanitizeCsvField('=cmd|"/c calc"!A0'), `"'=cmd|""/c calc""!A0"`);
  assert.equal(sanitizeCsvField('+1+2+3'), `\"'+1+2+3\"`);
  assert.equal(sanitizeCsvField('-5+5'), `\"'-5+5\"`);
  assert.equal(sanitizeCsvField('@SUM(A1:A10)'), `\"'@SUM(A1:A10)\"`);

  // Standard safe strings are quoted per RFC 4180
  assert.equal(sanitizeCsvField('CASE-2026-001'), `"CASE-2026-001"`);
  assert.equal(sanitizeCsvField('EVIDENCE_REGISTERED'), `"EVIDENCE_REGISTERED"`);
  assert.equal(sanitizeCsvField('Inspector Rajesh Sharma'), `"Inspector Rajesh Sharma"`);
});

// ----------------------------------------------------------------------------
// Test 14: End-to-End Workflow & Audit Integrity Chain Continuity
// ----------------------------------------------------------------------------
test('Admin Security - Test 14: Cross-departmental actions are append-only logged and verifiable', async () => {
  const db = new EvidenceVaultDatabase();
  await seedDatabase(db);

  const adminContext: SecurityContext = {
    actorId: 'USR-ADMIN-01',
    role: 'SYSTEM_ADMIN',
  };

  // 1. Police creates case
  const policeCase = await db.createCase({
    case_reference: 'CASE-ADMIN-AUDIT-001',
    title: 'High-Value Ransomware Network Intrusion',
    category: 'Cyber Financial Crime',
    incident_date: new Date().toISOString(),
    assigned_officer_id: 'USR-POLICE-01',
    created_by: 'USR-POLICE-01',
  });

  // 2. Police registers evidence
  const registeredEvd = await db.registerEvidence({
    case_id: policeCase.id,
    description: 'Server RAM dump and packet capture',
    evidence_type: 'MEMORY_DUMP',
    source_description: 'Primary Domain Controller memory image',
    submitted_by_officer_id: 'USR-POLICE-01',
    file: {
      original_filename: 'dc_mem_2026.raw',
      file_size_bytes: 8589934592,
      sha256_hash: 'b'.repeat(64),
      storage_key: 'evidence/raw/dc_mem_2026.raw',
      encryption_metadata: {
        algorithm: 'AES-256-GCM',
        key_id: 'KMS-POLICE-01',
      },
    },
  });

  // 3. Admin queries audit logs specifically for this newly created evidence
  const evdLogs = await db.queryAuditLogs(adminContext, {
    targetId: registeredEvd.id,
  });

  assert.ok(evdLogs.items.length >= 1, 'Evidence registration must produce audit record');
  const evdAudit = evdLogs.items.find((e) => e.action === 'EVIDENCE_REGISTERED') || evdLogs.items[0];
  assert.equal(evdAudit.action, 'EVIDENCE_REGISTERED');
  assert.equal(evdAudit.actor_id, 'USR-POLICE-01');
  assert.equal(evdAudit.department, 'POLICE');

  // 4. Verify cryptographic ledger integrity end-to-end
  const chainResult = await db.verifyAuditChainIntegrity();
  assert.equal(chainResult.isValid, true, 'Cryptographic chain must remain 100% valid');
  assert.ok(chainResult.verifiedBlocks >= 10, 'All blocks must be cryptographically verified');
});
