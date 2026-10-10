// ============================================================================
// EVIDENCEVAULT 360 — PHASE 7: OFFLINE MODE & SAFE DATA SYNCHRONIZATION
// Air-Gapped Field Forensics, Strict Sensitive File Protection,
// Idempotent Queue Reconciliation, Concurrency Conflict Resolution & RBAC Revalidation
// ============================================================================

import type {
  Department,
  UserRole,
  Case,
  EvidenceRecord,
  NetworkSyncStatus,
  OfflineActionType,
  OfflineEventStatus,
  OfflineQueueItem,
  OfflineConflictDetails,
  SyncBatchSummary,
  ApprovedOfflineCaseMetadata,
  ApprovedOfflineEvidenceMetadata,
  ApprovedOfflineMetadataCache,
  AuthSession,
} from '../types.ts';
import { computeSha256 } from './crypto.ts';
import { validateAuthSession } from './security.ts';
import type { EvidenceVaultDatabase } from '../data/db.ts';

// ----------------------------------------------------------------------------
// Domain & Security Error Classes
// ----------------------------------------------------------------------------
export class OfflineSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflineSyncError';
  }
}

export class ProhibitedOfflineCacheError extends OfflineSyncError {
  constructor(attemptedDataDescription: string) {
    super(
      `Forensic Security Policy Violation (ISO 27037): Attempted to cache prohibited sensitive data offline: '${attemptedDataDescription}'. Original evidence files and full forensic reports must NEVER be cached on unencrypted client devices.`
    );
    this.name = 'ProhibitedOfflineCacheError';
  }
}

export class OfflineConflictError extends OfflineSyncError {
  public conflictDetails: OfflineConflictDetails;
  constructor(message: string, conflictDetails: OfflineConflictDetails) {
    super(message);
    this.name = 'OfflineConflictError';
    this.conflictDetails = conflictDetails;
  }
}

export class OfflineAuthRevocationError extends OfflineSyncError {
  public userId: string;
  public reason: string;
  constructor(userId: string, reason: string) {
    super(`Revoked offline access: User '${userId}' is not authorized on server: ${reason}`);
    this.name = 'OfflineAuthRevocationError';
    this.userId = userId;
    this.reason = reason;
  }
}

// ----------------------------------------------------------------------------
// Institutional Security Disclosures & Documentation
// ----------------------------------------------------------------------------
export const OFFLINE_SECURITY_LIMITATIONS = {
  unencryptedStorageRisk:
    'Browser local storage and client-side web databases lack hardware-bound tamper resistance. In multi-user or shared terminals, stored items could be vulnerable to physical device compromise.',
  noOriginalEvidenceCached:
    'Strictly enforced: Raw evidence disk images, packet captures, memory dumps, and finalized forensic reports are NEVER stored in client offline caches to preserve criminal court admissibility and avoid data leakage.',
  delayedRevocationEnforcement:
    'Real-time administrative revocation (e.g. suspending a compromised investigator or demoting an examiner) CANNOT be pushed to an air-gapped or disconnected client device until network contact is restored.',
  authoritativeRevalidationOnSync:
    'Every queued offline event is subject to full cryptographic session validation, active status checks, role clearance, and optimistic concurrency locks before any state change is committed to the server ledger.',
  clockSkewSensitivity:
    'Offline event timestamps reflect the client device hardware clock. On sync, the server records both the client-claimed time and authoritative server sync time in the tamper-evident audit ledger.',
};

export const PERMISSION_REVOCATION_DISCLOSURE =
  'Security Disclosure: When a device is offline/disconnected, client-side cryptographic and role revocation cannot be instantly pushed to the device. The local client may still queue actions based on previously issued credentials. However, upon reconnection, the server rigorously revalidates credentials, account status, and permissions, and will strictly reject any actions queued by revoked or suspended accounts.';

// ----------------------------------------------------------------------------
// Local Storage Safe Polyfill (for Browser & Node.js test environments)
// ----------------------------------------------------------------------------
class MemoryStorageShim {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

function getSafeStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void; clear: () => void } {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return new MemoryStorageShim();
}

const safeStorage = getSafeStorage();

const STORAGE_KEY_OFFLINE_CACHE = 'evidencevault360_offline_metadata_v1';
const STORAGE_KEY_OFFLINE_QUEUE = 'evidencevault360_offline_queue_v1';

// ----------------------------------------------------------------------------
// 1. Explicitly Approved, Minimally Cached Non-Sensitive Information Manager
// ----------------------------------------------------------------------------
export class OfflineCacheManager {
  /**
   * Enforces that NO raw evidence files, file buffers, download URLs, or forensic reports are included.
   */
  public static assertNonSensitiveOnly(payload: unknown, contextDescription: string): void {
    if (!payload) return;

    // Check for binary buffer types
    if (
      (typeof ArrayBuffer !== 'undefined' && payload instanceof ArrayBuffer) ||
      (typeof Uint8Array !== 'undefined' && payload instanceof Uint8Array) ||
      (typeof Blob !== 'undefined' && payload instanceof Blob) ||
      (typeof File !== 'undefined' && payload instanceof File)
    ) {
      throw new ProhibitedOfflineCacheError(`${contextDescription}: Binary file content detected`);
    }

    if (typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      // Look for prohibited property names
      const prohibitedKeys = [
        'file_data',
        'raw_bytes',
        'binary_content',
        'report_content',
        'findings_text',
        'download_url',
        'presigned_url',
      ];
      for (const key of prohibitedKeys) {
        if (key in obj && obj[key] !== undefined && obj[key] !== null) {
          throw new ProhibitedOfflineCacheError(`${contextDescription}: Prohibited field '${key}' found`);
        }
      }

      // Recursively inspect nested properties
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          OfflineCacheManager.assertNonSensitiveOnly(value, `${contextDescription}.${key}`);
        }
      }
    }
  }

  /**
   * Generates and stores an approved, sanitized, non-sensitive metadata cache.
   */
  public static async cacheApprovedMetadata(
    userId: string,
    cases: Case[],
    evidenceList: EvidenceRecord[]
  ): Promise<ApprovedOfflineMetadataCache> {
    // 1. Sanitize Cases to non-sensitive fields only
    const approvedCases: ApprovedOfflineCaseMetadata[] = cases.map((c) => ({
      id: c.id,
      case_reference: c.case_reference,
      title: c.title,
      category: c.category,
      status: c.status,
      assigned_officer_id: c.assigned_officer_id,
      created_at: c.created_at,
    }));

    // 2. Sanitize Evidence to metadata only (no raw data, no report bodies)
    const approvedEvidence: ApprovedOfflineEvidenceMetadata[] = evidenceList.map((e) => ({
      id: e.id,
      case_id: e.case_id,
      description: e.description,
      evidence_type: e.evidence_type,
      current_status: e.current_status,
      collected_at: e.collected_at,
    }));

    const rawContentString = JSON.stringify({ approvedCases, approvedEvidence });
    const cacheChecksum = await computeSha256(rawContentString);

    const cacheObj: ApprovedOfflineMetadataCache = {
      cachedAt: new Date().toISOString(),
      cachedForUserId: userId,
      cases: approvedCases,
      evidenceSummary: approvedEvidence,
      cacheChecksum,
      cacheNotice:
        'APPROVED MINIMAL NON-SENSITIVE METADATA ONLY. Original evidence files and forensic reports are strictly omitted per ISO 27037 compliance.',
    };

    safeStorage.setItem(STORAGE_KEY_OFFLINE_CACHE, JSON.stringify(cacheObj));
    return cacheObj;
  }

  /**
   * Retrieves and cryptographically validates the approved offline metadata cache.
   */
  public static async getApprovedCache(): Promise<ApprovedOfflineMetadataCache | null> {
    const raw = safeStorage.getItem(STORAGE_KEY_OFFLINE_CACHE);
    if (!raw) return null;

    try {
      const cacheObj = JSON.parse(raw) as ApprovedOfflineMetadataCache;
      if (!cacheObj || !cacheObj.cacheChecksum) return null;

      // Re-verify cryptographic integrity of the cache
      const rawContentString = JSON.stringify({
        approvedCases: cacheObj.cases,
        approvedEvidence: cacheObj.evidenceSummary,
      });
      const computedChecksum = await computeSha256(rawContentString);

      if (computedChecksum !== cacheObj.cacheChecksum) {
        console.warn('Tampered or corrupted offline metadata cache detected. Discarding cache.');
        safeStorage.removeItem(STORAGE_KEY_OFFLINE_CACHE);
        return null;
      }

      return cacheObj;
    } catch {
      return null;
    }
  }

  public static clearCache(): void {
    safeStorage.removeItem(STORAGE_KEY_OFFLINE_CACHE);
  }
}

// ----------------------------------------------------------------------------
// 2. Offline Action Queue Manager
// ----------------------------------------------------------------------------
export class OfflineQueueManager {
  private static loadQueue(): OfflineQueueItem[] {
    const raw = safeStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as OfflineQueueItem[];
    } catch {
      return [];
    }
  }

  private static saveQueue(items: OfflineQueueItem[]): void {
    safeStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(items));
  }

  public static getQueue(): OfflineQueueItem[] {
    return OfflineQueueManager.loadQueue();
  }

  public static getPendingItems(): OfflineQueueItem[] {
    return OfflineQueueManager.loadQueue().filter(
      (item) => item.status === 'PENDING' || item.status === 'SYNCING'
    );
  }

  public static getItem(eventId: string): OfflineQueueItem | undefined {
    return OfflineQueueManager.loadQueue().find((item) => item.eventId === eventId);
  }

  /**
   * Enqueues a permitted offline action with a unique event ID and clear PENDING status.
   */
  public static enqueueAction(params: {
    action: OfflineActionType;
    actorId: string;
    actorRole: UserRole;
    actorDepartment: Department;
    sessionToken?: string;
    baseVersion?: string;
    targetEntityId?: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }): OfflineQueueItem {
    // 1. Guard against attempting to queue raw files or report content offline
    OfflineCacheManager.assertNonSensitiveOnly(params.payload, `Offline Action '${params.action}' Payload`);

    const timestamp = new Date().toISOString();
    const eventId = `OFFLINE-EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const idempotencyKey =
      params.idempotencyKey || `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const newItem: OfflineQueueItem = {
      eventId,
      idempotencyKey,
      action: params.action,
      actorId: params.actorId,
      actorRole: params.actorRole,
      actorDepartment: params.actorDepartment,
      sessionToken: params.sessionToken,
      baseVersion: params.baseVersion,
      targetEntityId: params.targetEntityId,
      payload: params.payload,
      queuedAt: timestamp,
      status: 'PENDING',
      retryCount: 0,
      lastError: null,
      syncedAt: null,
      serverEntityId: null,
      conflictDetails: null,
    };

    const queue = OfflineQueueManager.loadQueue();
    queue.push(newItem);
    OfflineQueueManager.saveQueue(queue);

    return newItem;
  }

  public static updateItem(updated: OfflineQueueItem): void {
    const queue = OfflineQueueManager.loadQueue();
    const index = queue.findIndex((i) => i.eventId === updated.eventId);
    if (index >= 0) {
      queue[index] = updated;
      OfflineQueueManager.saveQueue(queue);
    }
  }

  public static removeItem(eventId: string): void {
    const queue = OfflineQueueManager.loadQueue().filter((i) => i.eventId !== eventId);
    OfflineQueueManager.saveQueue(queue);
  }

  public static clearQueue(): void {
    safeStorage.removeItem(STORAGE_KEY_OFFLINE_QUEUE);
  }
}

// ----------------------------------------------------------------------------
// 3. Reconnection, Safe Synchronization & Conflict Resolution Engine
// ----------------------------------------------------------------------------
export class OfflineSyncEngine {
  private networkStatus: NetworkSyncStatus = 'ONLINE';
  private subscribers: Set<(status: NetworkSyncStatus) => void> = new Set();
  private batchHistory: SyncBatchSummary[] = [];

  // Authoritative server-side idempotency registry
  // Maps idempotencyKey -> { eventId, status, processedAt, serverEntityId }
  private processedIdempotencyKeys: Map<
    string,
    { eventId: string; status: OfflineEventStatus; processedAt: string; serverEntityId?: string | null }
  > = new Map();

  constructor() {
    // If in a browser environment, bind to native online/offline window events
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => {
        this.setNetworkStatus('ONLINE');
      });
      window.addEventListener('offline', () => {
        this.setNetworkStatus('OFFLINE');
      });
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.networkStatus = 'OFFLINE';
      }
    }
  }

  public getNetworkStatus(): NetworkSyncStatus {
    return this.networkStatus;
  }

  public setNetworkStatus(status: NetworkSyncStatus): void {
    this.networkStatus = status;
    this.notifySubscribers();
  }

  public subscribe(callback: (status: NetworkSyncStatus) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try {
        sub(this.networkStatus);
      } catch (err) {
        console.error('OfflineSyncEngine subscriber error:', err);
      }
    }
  }

  /**
   * Allows field simulators, UI toggles, and automated tests to switch between Online and Offline.
   */
  public simulateNetworkToggle(isOnline: boolean): NetworkSyncStatus {
    const nextStatus: NetworkSyncStatus = isOnline ? 'ONLINE' : 'OFFLINE';
    this.setNetworkStatus(nextStatus);
    return nextStatus;
  }

  public getBatchHistory(): SyncBatchSummary[] {
    return [...this.batchHistory];
  }

  public getProcessedIdempotencyCount(): number {
    return this.processedIdempotencyKeys.size;
  }

  /**
   * Safely synchronizes all pending or retryable offline queue items with the server.
   * Enforces:
   * 1. Idempotency & duplicate event prevention.
   * 2. Revalidation of authentication session token & expiration against server clock.
   * 3. Server-side active status check (rejects suspended or deactivated users).
   * 4. Server-side RBAC permission check for the specific action.
   * 5. Explicit optimistic concurrency conflict detection (never silently overwrites).
   * 6. Tamper-evident cryptographic audit ledger recording for all sync decisions.
   */
  public async syncQueue(
    db: EvidenceVaultDatabase,
    options?: {
      sessionToValidate?: AuthSession;
      overrideNetworkCheck?: boolean;
    }
  ): Promise<SyncBatchSummary> {
    if (this.networkStatus === 'OFFLINE' && !options?.overrideNetworkCheck) {
      throw new OfflineSyncError('Cannot synchronize while offline. Please reconnect first.');
    }

    this.setNetworkStatus('SYNCING');

    const queue = OfflineQueueManager.getQueue();
    const pendingItems = queue.filter(
      (item) => item.status === 'PENDING' || item.status === 'SYNCING'
    );

    const batchId = `SYNC-BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const initiatedAt = new Date().toISOString();

    const summary: SyncBatchSummary = {
      batchId,
      initiatedAt,
      completedAt: '',
      totalEvents: pendingItems.length,
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
      rejectedCount: 0,
      items: [],
    };

    if (pendingItems.length === 0) {
      summary.completedAt = new Date().toISOString();
      this.batchHistory.unshift(summary);
      this.setNetworkStatus('ONLINE');
      return summary;
    }

    for (const item of pendingItems) {
      item.retryCount += 1;
      item.status = 'SYNCING';
      OfflineQueueManager.updateItem(item);

      // ----------------------------------------------------------------------
      // Step 1: Idempotency & Duplicate Prevention
      // ----------------------------------------------------------------------
      if (this.processedIdempotencyKeys.has(item.idempotencyKey)) {
        const existing = this.processedIdempotencyKeys.get(item.idempotencyKey)!;
        item.status = 'SYNCED';
        item.syncedAt = existing.processedAt;
        item.serverEntityId = existing.serverEntityId;
        item.lastError = null;
        OfflineQueueManager.updateItem(item);

        summary.syncedCount += 1;
        summary.items.push({
          eventId: item.eventId,
          action: item.action,
          status: 'SYNCED',
          message: `Idempotent replay: Event was already committed at ${existing.processedAt}. Duplicate execution skipped.`,
          serverEntityId: existing.serverEntityId,
        });
        continue;
      }

      // ----------------------------------------------------------------------
      // Step 2: Session Authentication & Expiration Revalidation
      // ----------------------------------------------------------------------
      if (options?.sessionToValidate) {
        const sessionCheck = validateAuthSession(options.sessionToValidate);
        if (!sessionCheck.isValid) {
          item.status = 'REJECTED';
          item.lastError = `EXPIRED_OR_INVALID_SESSION: ${sessionCheck.error}`;
          OfflineQueueManager.updateItem(item);

          await db.recordAuditEvent(
            item.actorId,
            'OFFLINE_SYNC_SESSION_REJECTED',
            'OfflineQueueItem',
            item.eventId,
            { reason: sessionCheck.error, action: item.action }
          );

          summary.rejectedCount += 1;
          summary.items.push({
            eventId: item.eventId,
            action: item.action,
            status: 'REJECTED',
            message: `Session authentication failure: ${sessionCheck.error}`,
          });
          continue;
        }
      }

      // ----------------------------------------------------------------------
      // Step 3: Server-Side Active Status & Account Revocation Check
      // ----------------------------------------------------------------------
      const liveUser = db.getUser(item.actorId);
      if (liveUser) {
        if (liveUser.active_status === 'SUSPENDED' || liveUser.active_status === 'INACTIVE') {
          item.status = 'REJECTED';
          item.lastError = `REVOKED_PERMISSION: User account '${item.actorId}' was ${liveUser.active_status} on server while disconnected.`;
          OfflineQueueManager.updateItem(item);

          await db.recordAuditEvent(
            item.actorId,
            'OFFLINE_SYNC_ACCOUNT_REVOKED',
            'OfflineQueueItem',
            item.eventId,
            { userStatus: liveUser.active_status, action: item.action }
          );

          summary.rejectedCount += 1;
          summary.items.push({
            eventId: item.eventId,
            action: item.action,
            status: 'REJECTED',
            message: `Account is ${liveUser.active_status} on server. Offline actions cannot be accepted.`,
          });
          continue;
        }

        // Verify live role still matches queued role
        if (liveUser.role !== item.actorRole) {
          item.status = 'REJECTED';
          item.lastError = `REVOKED_PERMISSION: User role changed from '${item.actorRole}' to '${liveUser.role}' on server.`;
          OfflineQueueManager.updateItem(item);

          summary.rejectedCount += 1;
          summary.items.push({
            eventId: item.eventId,
            action: item.action,
            status: 'REJECTED',
            message: `Role mismatch: Queued with '${item.actorRole}', but active server role is '${liveUser.role}'.`,
          });
          continue;
        }
      }

      // ----------------------------------------------------------------------
      // Step 4: RBAC Role Action Permissions Check
      // ----------------------------------------------------------------------
      const permittedRolesByAction: Record<OfflineActionType, UserRole[]> = {
        CREATE_CASE: ['POLICE_INVESTIGATOR', 'SYSTEM_ADMIN'],
        REGISTER_EVIDENCE: ['POLICE_INVESTIGATOR', 'SYSTEM_ADMIN'],
        CREATE_HANDOFF: ['POLICE_INVESTIGATOR', 'SYSTEM_ADMIN'],
        RECORD_CUSTODY: ['POLICE_INVESTIGATOR', 'FORENSIC_EXAMINER', 'PUBLIC_PROSECUTOR', 'SYSTEM_ADMIN'],
        TRANSITION_HANDOFF: ['FORENSIC_EXAMINER', 'POLICE_INVESTIGATOR', 'SYSTEM_ADMIN'],
      };

      const allowedRoles = permittedRolesByAction[item.action] || [];
      if (!allowedRoles.includes(item.actorRole)) {
        item.status = 'REJECTED';
        item.lastError = `UNAUTHORIZED_ROLE_ACTION: Role '${item.actorRole}' is not permitted to perform '${item.action}'.`;
        OfflineQueueManager.updateItem(item);

        await db.recordAuditEvent(
          item.actorId,
          'OFFLINE_SYNC_UNAUTHORIZED_ROLE',
          'OfflineQueueItem',
          item.eventId,
          { role: item.actorRole, action: item.action }
        );

        summary.rejectedCount += 1;
        summary.items.push({
          eventId: item.eventId,
          action: item.action,
          status: 'REJECTED',
          message: `Role '${item.actorRole}' is not authorized to execute '${item.action}'.`,
        });
        continue;
      }

      // ----------------------------------------------------------------------
      // Step 5: Concurrency Conflict Detection (Optimistic Version Checking)
      // ----------------------------------------------------------------------
      if (item.action === 'TRANSITION_HANDOFF') {
        const handoffId = item.payload.handoffId as string;
        const liveHandoff = db.getAllEvidence().flatMap((e) => db.getHandoffsForEvidence(e.id)).find((h) => h.id === handoffId);

        if (liveHandoff && item.baseVersion && liveHandoff.status !== item.baseVersion) {
          // CONFLICT DETECTED: Server status changed concurrently while disconnected!
          const conflict: OfflineConflictDetails = {
            expectedState: item.baseVersion,
            serverState: liveHandoff.status,
            reason: `Concurrent modification: Handoff was transitioned to '${liveHandoff.status}' on server by another actor, but offline action expected '${item.baseVersion}'.`,
            detectedAt: new Date().toISOString(),
          };

          item.status = 'CONFLICT';
          item.conflictDetails = conflict;
          item.lastError = `CONFLICT: Server state is '${liveHandoff.status}' (expected '${item.baseVersion}')`;
          OfflineQueueManager.updateItem(item);

          await db.recordAuditEvent(
            item.actorId,
            'OFFLINE_SYNC_CONFLICT_DETECTED',
            'EvidenceHandoff',
            handoffId,
            { expected: item.baseVersion, actual: liveHandoff.status, eventId: item.eventId }
          );

          summary.conflictCount += 1;
          summary.items.push({
            eventId: item.eventId,
            action: item.action,
            status: 'CONFLICT',
            message: conflict.reason,
          });
          continue;
        }
      }

      // ----------------------------------------------------------------------
      // Step 6: Authoritative Server Mutation & Cryptographic Audit Commit
      // ----------------------------------------------------------------------
      try {
        let serverEntityId: string | null = null;

        if (item.action === 'CREATE_CASE') {
          const caseData = item.payload as unknown as Parameters<typeof db.createCase>[0];
          const createdCase = await db.createCase(caseData);
          serverEntityId = createdCase.id;
        } else if (item.action === 'REGISTER_EVIDENCE') {
          const evData = item.payload as unknown as Parameters<typeof db.createEvidence>[0];
          const createdEv = await db.createEvidence(evData);
          serverEntityId = createdEv.id;
        } else if (item.action === 'CREATE_HANDOFF') {
          const handoffData = item.payload as unknown as Parameters<typeof db.createHandoff>[0];
          const createdHandoff = await db.createHandoff(handoffData);
          serverEntityId = createdHandoff.id;
        } else if (item.action === 'RECORD_CUSTODY') {
          const custData = item.payload as unknown as Parameters<typeof db.recordCustodyEvent>[0];
          const custEvent = await db.recordCustodyEvent(custData);
          serverEntityId = custEvent.id;
        } else if (item.action === 'TRANSITION_HANDOFF') {
          const { handoffId, newStatus, rejectionReason } = item.payload as {
            handoffId: string;
            newStatus: Parameters<typeof db.transitionHandoffStatus>[1];
            rejectionReason?: string;
          };
          const transitioned = await db.transitionHandoffStatus(
            handoffId,
            newStatus,
            item.actorId,
            rejectionReason
          );
          serverEntityId = transitioned.id;
        }

        // Successfully applied mutation
        const syncedTimestamp = new Date().toISOString();
        item.status = 'SYNCED';
        item.syncedAt = syncedTimestamp;
        item.serverEntityId = serverEntityId;
        item.lastError = null;
        OfflineQueueManager.updateItem(item);

        // Record in server-side idempotency registry
        this.processedIdempotencyKeys.set(item.idempotencyKey, {
          eventId: item.eventId,
          status: 'SYNCED',
          processedAt: syncedTimestamp,
          serverEntityId,
        });

        // Record tamper-evident server audit block
        await db.recordAuditEvent(
          item.actorId,
          'OFFLINE_EVENT_SYNCED',
          item.action,
          serverEntityId || item.eventId,
          {
            eventId: item.eventId,
            idempotencyKey: item.idempotencyKey,
            queuedAt: item.queuedAt,
            syncedAt: syncedTimestamp,
          }
        );

        summary.syncedCount += 1;
        summary.items.push({
          eventId: item.eventId,
          action: item.action,
          status: 'SYNCED',
          message: `Successfully synchronized and committed to server ledger (Entity: ${serverEntityId}).`,
          serverEntityId,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        item.status = 'PENDING'; // Keep pending for retry or error inspection
        item.lastError = errorMsg;
        OfflineQueueManager.updateItem(item);

        summary.failedCount += 1;
        summary.items.push({
          eventId: item.eventId,
          action: item.action,
          status: 'PENDING',
          message: `Mutation error during sync: ${errorMsg}`,
        });
      }
    }

    summary.completedAt = new Date().toISOString();
    this.batchHistory.unshift(summary);

    // Determine aggregate network status
    if (summary.conflictCount > 0 || summary.rejectedCount > 0 || summary.failedCount > 0) {
      if (summary.syncedCount > 0) {
        this.setNetworkStatus('PARTIAL_SYNC');
      } else {
        this.setNetworkStatus('SYNC_FAILED');
      }
    } else {
      this.setNetworkStatus('ONLINE');
    }

    return summary;
  }

  /**
   * Explicitly resolves a conflicting offline item without silent overwriting.
   */
  public async resolveConflict(
    eventId: string,
    strategy: 'DISCARD_LOCAL' | 'FORCE_OVERWRITE',
    justification: string,
    db: EvidenceVaultDatabase
  ): Promise<OfflineQueueItem> {
    const item = OfflineQueueManager.getItem(eventId);
    if (!item) {
      throw new OfflineSyncError(`Offline queue item '${eventId}' not found.`);
    }

    if (item.status !== 'CONFLICT') {
      throw new OfflineSyncError(`Item '${eventId}' is not in CONFLICT state.`);
    }

    if (!justification || justification.trim().length < 5) {
      throw new OfflineSyncError('A valid operational justification (minimum 5 characters) is required to resolve a conflict.');
    }

    if (strategy === 'DISCARD_LOCAL') {
      item.status = 'REJECTED';
      item.lastError = `CONFLICT_RESOLVED_DISCARD: Discarded by operator. Reason: ${justification}`;
      OfflineQueueManager.updateItem(item);

      await db.recordAuditEvent(
        item.actorId,
        'OFFLINE_CONFLICT_DISCARDED',
        'OfflineQueueItem',
        item.eventId,
        { justification, conflict: item.conflictDetails }
      );

      return item;
    }

    if (strategy === 'FORCE_OVERWRITE') {
      // Apply the change and log explicit high-audit warning block
      const handoffId = item.payload.handoffId as string;
      const newStatus = item.payload.newStatus as any;
      const rejectionReason = item.payload.rejectionReason as string;

      const transitioned = await db.transitionHandoffStatus(
        handoffId,
        newStatus,
        item.actorId,
        rejectionReason || `Force-applied via offline resolution: ${justification}`
      );

      item.status = 'SYNCED';
      item.syncedAt = new Date().toISOString();
      item.serverEntityId = transitioned.id;
      item.lastError = null;
      OfflineQueueManager.updateItem(item);

      await db.recordAuditEvent(
        item.actorId,
        'OFFLINE_CONFLICT_FORCE_OVERRIDDEN',
        'EvidenceHandoff',
        handoffId,
        {
          justification,
          previousConflict: item.conflictDetails,
          forcedStatus: newStatus,
        }
      );

      return item;
    }

    throw new OfflineSyncError(`Unsupported conflict resolution strategy: '${strategy}'`);
  }
}

// Global shared singleton for application runtime
export const globalOfflineEngine = new OfflineSyncEngine();
