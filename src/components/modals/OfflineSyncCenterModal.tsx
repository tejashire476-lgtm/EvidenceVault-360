import React from 'react';
import type {
  NetworkSyncStatus,
  OfflineQueueItem,
  ApprovedOfflineMetadataCache,
} from '../../types.ts';
import {
  globalOfflineEngine,
  OfflineQueueManager,
  OFFLINE_SECURITY_LIMITATIONS,
  PERMISSION_REVOCATION_DISCLOSURE,
} from '../../utils/offlineSync.ts';
import { XIcon, ShieldCheckIcon, AlertTriangleIcon } from '../icons.tsx';

export interface OfflineSyncCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  networkStatus: NetworkSyncStatus;
  onToggleNetwork: () => void;
  isSyncingOffline: boolean;
  onRunSync: () => void;
  offlineCenterTab: 'QUEUE' | 'CONFLICTS' | 'BATCHES' | 'CACHE' | 'DISCLOSURES';
  setOfflineCenterTab: (tab: 'QUEUE' | 'CONFLICTS' | 'BATCHES' | 'CACHE' | 'DISCLOSURES') => void;
  offlineQueue: OfflineQueueItem[];
  setOfflineQueue: React.Dispatch<React.SetStateAction<OfflineQueueItem[]>>;
  selectedConflictEventId: string | null;
  setSelectedConflictEventId: (id: string | null) => void;
  conflictJustification: string;
  setConflictJustification: (v: string) => void;
  onResolveConflict: (strategy: 'DISCARD_LOCAL' | 'FORCE_OVERWRITE') => void;
  approvedCacheState: ApprovedOfflineMetadataCache | null;
  onCacheApprovedMetadata: () => void;
}

export const OfflineSyncCenterModal: React.FC<OfflineSyncCenterModalProps> = ({
  isOpen,
  onClose,
  networkStatus,
  onToggleNetwork,
  isSyncingOffline,
  onRunSync,
  offlineCenterTab,
  setOfflineCenterTab,
  offlineQueue,
  setOfflineQueue,
  selectedConflictEventId,
  setSelectedConflictEventId,
  conflictJustification,
  setConflictJustification,
  onResolveConflict,
  approvedCacheState,
  onCacheApprovedMetadata,
}) => {
  if (!isOpen) return null;

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal ev-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <div>
            <h3 className="ev-modal-title">Offline Operations & Safe Data Synchronization Center</h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Air-Gapped Field Forensics • Idempotent Queue • Optimistic Concurrency & Conflict Inspector
            </span>
          </div>
          <button type="button" className="ev-close-btn" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>

        {/* Top Command Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#0a0d18',
            border: '1px solid #1e253e',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Network Status:</span>
            <span className={`ev-network-badge ${networkStatus.toLowerCase()}`}>
              {networkStatus === 'ONLINE'
                ? '🟢'
                : networkStatus === 'OFFLINE'
                  ? '🟠'
                  : networkStatus === 'SYNCING'
                    ? '🔄'
                    : '⚠️'}{' '}
              {networkStatus}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ev-btn ev-btn-secondary"
              style={{
                fontSize: '12px',
                borderColor: networkStatus === 'OFFLINE' ? '#34d399' : '#f59e0b',
                color: networkStatus === 'OFFLINE' ? '#34d399' : '#fbbf24',
              }}
              onClick={onToggleNetwork}
            >
              {networkStatus === 'OFFLINE' ? '⚡ Restore Connection' : '📡 Simulate Disconnect / Air-Gap'}
            </button>

            <button
              type="button"
              className="ev-btn ev-btn-primary"
              style={{ fontSize: '12px' }}
              disabled={
                networkStatus === 'OFFLINE' ||
                isSyncingOffline ||
                offlineQueue.filter((q) => q.status === 'PENDING' || q.status === 'CONFLICT').length === 0
              }
              onClick={onRunSync}
            >
              {isSyncingOffline
                ? '🔄 Reconciling...'
                : `🔄 Sync Pending Items (${
                    offlineQueue.filter((q) => q.status === 'PENDING' || q.status === 'CONFLICT').length
                  })`}
            </button>

            <button
              type="button"
              className="ev-btn ev-btn-secondary"
              style={{ fontSize: '12px', borderColor: '#38bdf8', color: '#38bdf8' }}
              onClick={onCacheApprovedMetadata}
              title="Cache non-sensitive metadata for air-gapped viewing"
            >
              💾 Cache Approved Metadata
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid #1e263d',
            marginBottom: '16px',
            paddingBottom: '8px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className={`ev-btn ${offlineCenterTab === 'QUEUE' ? 'ev-btn-primary' : 'ev-btn-secondary'}`}
            style={{ fontSize: '11px', padding: '5px 12px' }}
            onClick={() => setOfflineCenterTab('QUEUE')}
          >
            📥 Event Queue ({offlineQueue.length})
          </button>

          <button
            type="button"
            className={`ev-btn ${offlineCenterTab === 'CONFLICTS' ? 'ev-btn-primary' : 'ev-btn-secondary'}`}
            style={{
              fontSize: '11px',
              padding: '5px 12px',
              borderColor:
                offlineQueue.filter((q) => q.status === 'CONFLICT').length > 0 ? '#ef4444' : undefined,
              color:
                offlineQueue.filter((q) => q.status === 'CONFLICT').length > 0 ? '#f87171' : undefined,
            }}
            onClick={() => setOfflineCenterTab('CONFLICTS')}
          >
            ⚠ Conflict Inspector ({offlineQueue.filter((q) => q.status === 'CONFLICT').length})
          </button>

          <button
            type="button"
            className={`ev-btn ${offlineCenterTab === 'BATCHES' ? 'ev-btn-primary' : 'ev-btn-secondary'}`}
            style={{ fontSize: '11px', padding: '5px 12px' }}
            onClick={() => setOfflineCenterTab('BATCHES')}
          >
            📊 Sync History ({globalOfflineEngine.getBatchHistory().length})
          </button>

          <button
            type="button"
            className={`ev-btn ${offlineCenterTab === 'CACHE' ? 'ev-btn-primary' : 'ev-btn-secondary'}`}
            style={{ fontSize: '11px', padding: '5px 12px' }}
            onClick={() => setOfflineCenterTab('CACHE')}
          >
            💾 Approved Cache
          </button>

          <button
            type="button"
            className={`ev-btn ${offlineCenterTab === 'DISCLOSURES' ? 'ev-btn-primary' : 'ev-btn-secondary'}`}
            style={{ fontSize: '11px', padding: '5px 12px' }}
            onClick={() => setOfflineCenterTab('DISCLOSURES')}
          >
            🛡️ Security Disclosures
          </button>
        </div>

        {/* TAB 1: EVENT QUEUE */}
        {offlineCenterTab === 'QUEUE' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}>
              <span>
                Total Offline Operations: <strong>{offlineQueue.length}</strong> (
                {offlineQueue.filter((q) => q.status === 'PENDING').length} Pending •{' '}
                {offlineQueue.filter((q) => q.status === 'SYNCED').length} Synced •{' '}
                {offlineQueue.filter((q) => q.status === 'CONFLICT').length} Conflicted •{' '}
                {offlineQueue.filter((q) => q.status === 'REJECTED').length} Rejected)
              </span>
              {offlineQueue.length > 0 && (
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '11px', cursor: 'pointer' }}
                  onClick={() => {
                    OfflineQueueManager.clearQueue();
                    setOfflineQueue([]);
                  }}
                >
                  Clear Queue
                </button>
              )}
            </div>

            {offlineQueue.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', background: '#0a0d18', borderRadius: '6px' }}>
                No offline operations queued. When operating in OFFLINE mode, field actions (case registration, evidence logging, handoff transitions) are queued here with unique event IDs.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ev-history-table">
                  <thead>
                    <tr>
                      <th>Event ID / Idempotency</th>
                      <th>Action</th>
                      <th>Actor / Role</th>
                      <th>Status</th>
                      <th>Queued At</th>
                      <th>Details / Server Result</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offlineQueue.map((item) => (
                      <tr key={item.eventId}>
                        <td>
                          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#93c5fd' }}>
                            {item.eventId}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>{item.idempotencyKey}</div>
                        </td>
                        <td>
                          <span className="ev-badge ev-badge-investigation">{item.action}</span>
                        </td>
                        <td>
                          <div>{item.actorId}</div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>{item.actorRole}</div>
                        </td>
                        <td>
                          <span
                            className={`ev-offline-pill ${item.status.toLowerCase()}`}
                          >
                            {item.status === 'PENDING'
                              ? '⏳ Unsynced'
                              : item.status === 'SYNCED'
                                ? '✓ Synced'
                                : item.status === 'CONFLICT'
                                  ? '⚠ Conflict'
                                  : item.status}
                          </span>
                        </td>
                        <td>{new Date(item.queuedAt).toLocaleTimeString()}</td>
                        <td style={{ fontSize: '11px' }}>
                          {item.serverEntityId && (
                            <div style={{ color: '#34d399' }}>Entity ID: {item.serverEntityId}</div>
                          )}
                          {item.lastError && (
                            <div style={{ color: '#f87171' }}>{item.lastError}</div>
                          )}
                          {item.status === 'PENDING' && (
                            <div style={{ color: '#fbbf24' }}>Locally queued • Pending server sync</div>
                          )}
                        </td>
                        <td>
                          {item.status === 'CONFLICT' && (
                            <button
                              type="button"
                              className="ev-btn ev-btn-danger"
                              style={{ fontSize: '10px', padding: '3px 8px' }}
                              onClick={() => {
                                setSelectedConflictEventId(item.eventId);
                                setOfflineCenterTab('CONFLICTS');
                              }}
                            >
                              Resolve
                            </button>
                          )}
                          {item.status === 'PENDING' && (
                            <button
                              type="button"
                              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}
                              onClick={() => {
                                OfflineQueueManager.removeItem(item.eventId);
                                setOfflineQueue(OfflineQueueManager.getQueue());
                              }}
                              title="Discard local unsynced draft"
                            >
                              Discard
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONFLICT INSPECTOR */}
        {offlineCenterTab === 'CONFLICTS' && (
          <div>
            <div style={{ marginBottom: '12px', fontSize: '13px', color: '#cbd5e1' }}>
              <strong>Optimistic Concurrency & Conflict Resolution Engine:</strong> Concurrently modified records are flagged as CONFLICT and are never silently overwritten.
            </div>

            {offlineQueue.filter((q) => q.status === 'CONFLICT').length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#34d399', background: '#0a1a15', borderRadius: '6px', border: '1px solid #059669' }}>
                ✓ No concurrent conflicts detected. All offline items match server state.
              </div>
            ) : (
              offlineQueue
                .filter((q) => q.status === 'CONFLICT')
                .map((conflictItem) => (
                  <div key={conflictItem.eventId} className="ev-conflict-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#f87171', fontSize: '14px' }}>
                        ⚠ Conflict Detected on Event: {conflictItem.eventId} ({conflictItem.action})
                      </strong>
                      <span className="ev-offline-pill conflict">CONFLICT</span>
                    </div>

                    <p style={{ margin: '8px 0', fontSize: '12px', color: '#fca5a5' }}>
                      Reason: {conflictItem.conflictDetails?.reason || conflictItem.lastError}
                    </p>

                    <div className="ev-conflict-comparison">
                      <div className="ev-conflict-box offline">
                        <strong style={{ color: '#fbbf24' }}>Local Offline Claim</strong>
                        <div style={{ marginTop: '6px', color: '#cbd5e1' }}>
                          Expected Base State:{' '}
                          <strong>{conflictItem.conflictDetails?.expectedState || 'N/A'}</strong>
                        </div>
                        <div style={{ marginTop: '4px', color: '#94a3b8' }}>
                          Queued At: {new Date(conflictItem.queuedAt).toLocaleString()}
                        </div>
                        <div style={{ marginTop: '4px', color: '#94a3b8' }}>
                          Actor: {conflictItem.actorId} ({conflictItem.actorRole})
                        </div>
                      </div>

                      <div className="ev-conflict-box server">
                        <strong style={{ color: '#34d399' }}>Live Server Truth</strong>
                        <div style={{ marginTop: '6px', color: '#cbd5e1' }}>
                          Authoritative Server State:{' '}
                          <strong>{conflictItem.conflictDetails?.serverState || 'MODIFIED'}</strong>
                        </div>
                        <div style={{ marginTop: '4px', color: '#94a3b8' }}>
                          Detected At: {conflictItem.conflictDetails?.detectedAt ? new Date(conflictItem.conflictDetails.detectedAt).toLocaleTimeString() : 'Recent'}
                        </div>
                        <div style={{ marginTop: '4px', color: '#34d399' }}>
                          Server concurrency protection: Overwrite blocked
                        </div>
                      </div>
                    </div>

                    {/* Operational Resolution Pathways */}
                    <div style={{ background: '#090b14', padding: '12px', borderRadius: '6px', marginTop: '10px' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                        Mandatory Operational Justification (Required for Resolution Audit):
                      </label>
                      <input
                        type="text"
                        className="ev-input"
                        value={selectedConflictEventId === conflictItem.eventId ? conflictJustification : ''}
                        onChange={(e) => {
                          setSelectedConflictEventId(conflictItem.eventId);
                          setConflictJustification(e.target.value);
                        }}
                        placeholder="e.g. Verified with Lead Prosecutor: accepting central forensic facility intake status."
                      />

                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="ev-btn ev-btn-secondary"
                          style={{ fontSize: '12px' }}
                          onClick={() => {
                            setSelectedConflictEventId(conflictItem.eventId);
                            onResolveConflict('DISCARD_LOCAL');
                          }}
                        >
                          Discard Offline Change (Accept Server State)
                        </button>

                        <button
                          type="button"
                          className="ev-btn ev-btn-danger"
                          style={{ fontSize: '12px' }}
                          onClick={() => {
                            setSelectedConflictEventId(conflictItem.eventId);
                            onResolveConflict('FORCE_OVERWRITE');
                          }}
                        >
                          Force Override with Audit Justification
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* TAB 3: SYNC BATCHES HISTORY */}
        {offlineCenterTab === 'BATCHES' && (
          <div>
            <div style={{ marginBottom: '12px', fontSize: '13px', color: '#cbd5e1' }}>
              <strong>Synchronization Ledger Batches:</strong> Authoritative batch audit summaries and reconciliation histories.
            </div>

            {globalOfflineEngine.getBatchHistory().length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', background: '#0a0d18', borderRadius: '6px' }}>
                No sync batches executed yet in this session.
              </div>
            ) : (
              <div>
                {globalOfflineEngine.getBatchHistory().map((batch) => (
                  <div
                    key={batch.batchId}
                    style={{
                      background: '#0c0f1d',
                      border: '1px solid #1f2742',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontFamily: 'monospace', color: '#93c5fd', fontSize: '12px' }}>
                        {batch.batchId}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {new Date(batch.completedAt || batch.initiatedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '12px' }}>
                      <span style={{ color: '#cbd5e1' }}>Total: {batch.totalEvents}</span>
                      <span style={{ color: '#34d399' }}>✓ Synced: {batch.syncedCount}</span>
                      {batch.conflictCount > 0 && (
                        <span style={{ color: '#f87171' }}>⚠ Conflicts: {batch.conflictCount}</span>
                      )}
                      {batch.rejectedCount > 0 && (
                        <span style={{ color: '#fbbf24' }}>✕ Rejected: {batch.rejectedCount}</span>
                      )}
                    </div>
                    {batch.items.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                        {batch.items.map((it) => (
                          <div key={it.eventId} style={{ padding: '2px 0' }}>
                            • [{it.action}] {it.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: APPROVED CACHE INSPECTOR */}
        {offlineCenterTab === 'CACHE' && (
          <div>
            <div
              style={{
                background: '#091512',
                border: '1px solid #059669',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 600 }}>
                <ShieldCheckIcon size={18} />
                <span>Explicitly Approved, Minimally Cached Non-Sensitive Metadata (ISO 27037)</span>
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#a7f3d0' }}>
                Per digital evidence protocols, client devices only cache sanitized case references, titles, and item metadata. Original evidence binary files and finalized forensic reports are strictly excluded from client-side storage.
              </p>
            </div>

            {approvedCacheState ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div className="ev-metric-card">
                    <div className="ev-metric-title">Cached Cases</div>
                    <div className="ev-metric-value">{approvedCacheState.cases.length}</div>
                    <div className="ev-metric-sub">Non-sensitive summaries</div>
                  </div>
                  <div className="ev-metric-card">
                    <div className="ev-metric-title">Cached Evidence Records</div>
                    <div className="ev-metric-value">{approvedCacheState.evidenceSummary.length}</div>
                    <div className="ev-metric-sub">Metadata only</div>
                  </div>
                  <div className="ev-metric-card">
                    <div className="ev-metric-title">Original Files Cached</div>
                    <div className="ev-metric-value" style={{ color: '#10b981' }}>0 (Protected)</div>
                    <div className="ev-metric-sub">ISO 27037 Zero-Leak Policy</div>
                  </div>
                  <div className="ev-metric-card">
                    <div className="ev-metric-title">Forensic Reports Cached</div>
                    <div className="ev-metric-value" style={{ color: '#10b981' }}>0 (Protected)</div>
                    <div className="ev-metric-sub">Confidentiality Guard</div>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all', marginBottom: '12px' }}>
                  SHA-256 Cache Checksum: <code>{approvedCacheState.cacheChecksum}</code>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="ev-history-table">
                    <thead>
                      <tr>
                        <th>Case Ref</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedCacheState.cases.map((c) => (
                        <tr key={c.id}>
                          <td style={{ fontFamily: 'monospace' }}>{c.case_reference}</td>
                          <td>{c.title}</td>
                          <td><span className="ev-badge ev-badge-investigation">{c.status}</span></td>
                          <td>{c.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                No offline cache generated yet. Click &quot;Cache Approved Metadata&quot; to initialize.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SECURITY DISCLOSURES */}
        {offlineCenterTab === 'DISCLOSURES' && (
          <div>
            <div
              style={{
                background: '#1a1012',
                border: '1px solid #dc2626',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <strong style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangleIcon size={18} />
                Cryptographic & Role Revocation Disclosure
              </strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#fca5a5', lineHeight: '1.5' }}>
                {PERMISSION_REVOCATION_DISCLOSURE}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ background: '#090d19', border: '1px solid #1e253e', borderRadius: '6px', padding: '12px' }}>
                <strong style={{ color: '#38bdf8', fontSize: '13px' }}>Unencrypted Local Storage Limitations</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                  {OFFLINE_SECURITY_LIMITATIONS.unencryptedStorageRisk}
                </p>
              </div>

              <div style={{ background: '#090d19', border: '1px solid #1e253e', borderRadius: '6px', padding: '12px' }}>
                <strong style={{ color: '#34d399', fontSize: '13px' }}>Strict Binary File & Report Exclusion</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                  {OFFLINE_SECURITY_LIMITATIONS.noOriginalEvidenceCached}
                </p>
              </div>

              <div style={{ background: '#090d19', border: '1px solid #1e253e', borderRadius: '6px', padding: '12px' }}>
                <strong style={{ color: '#fbbf24', fontSize: '13px' }}>Delayed Revocation Enforcement</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                  {OFFLINE_SECURITY_LIMITATIONS.delayedRevocationEnforcement}
                </p>
              </div>

              <div style={{ background: '#090d19', border: '1px solid #1e253e', borderRadius: '6px', padding: '12px' }}>
                <strong style={{ color: '#c084fc', fontSize: '13px' }}>Authoritative Revalidation on Reconnection</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                  {OFFLINE_SECURITY_LIMITATIONS.authoritativeRevalidationOnSync}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="ev-form-actions" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="ev-btn ev-btn-primary"
            onClick={onClose}
          >
            Close Synchronization Center
          </button>
        </div>
      </div>
    </div>
  );
};
