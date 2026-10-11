import React from 'react';
import { globalDb } from '../../data/db.ts';
import { XIcon } from '../icons.tsx';

export interface VerificationAuditHistoryModalProps {
  fileVersionId: string | null;
  onClose: () => void;
}

export const VerificationAuditHistoryModal: React.FC<VerificationAuditHistoryModalProps> = ({
  fileVersionId,
  onClose,
}) => {
  if (!fileVersionId) return null;

  const fileRec = globalDb.getFileVersion(fileVersionId);
  const history = globalDb.getVerificationResultsForFileVersion(fileVersionId);

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal ev-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <h3 className="ev-modal-title">Evidence Cryptographic Verification Audit History</h3>
          <button type="button" className="ev-close-btn" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>

        <div>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#cbd5e1' }}>
            Artifact: <strong>{fileRec?.original_filename}</strong> ({fileRec?.id}) • Total Audits: <strong>{history.length}</strong>
          </div>

          {history.length === 0 ? (
            <div style={{ padding: '20px', color: '#64748b', textAlign: 'center' }}>
              No verification attempts recorded yet for this artifact.
            </div>
          ) : (
            <table className="ev-history-table">
              <thead>
                <tr>
                  <th>Attempt ID</th>
                  <th>Status</th>
                  <th>Observed SHA-256</th>
                  <th>Actor / Role</th>
                  <th>Timestamp</th>
                  <th>Duration</th>
                  <th>Provider Info</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontFamily: 'monospace' }}>{h.id}</td>
                    <td>
                      <span className={`ev-badge ev-badge-${h.result.toLowerCase()}`}>
                        {h.result}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '10px', maxWidth: '200px', wordBreak: 'break-all' }}>
                      {h.observed_sha256 || 'None (Storage Failure)'}
                      {h.error_reason && (
                        <div style={{ color: '#f87171', fontSize: '10px', marginTop: '2px' }}>
                          {h.error_reason}
                        </div>
                      )}
                    </td>
                    <td>
                      {h.verified_by}
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{h.verified_by_role}</div>
                    </td>
                    <td>{new Date(h.verified_at).toLocaleString()}</td>
                    <td>{h.duration_ms} ms</td>
                    <td style={{ fontSize: '10px', color: '#64748b' }}>
                      {h.provider_integrity?.provider || 'R2'} • {h.provider_integrity?.encryptionAtRest}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="ev-form-actions" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className="ev-btn ev-btn-primary"
              onClick={onClose}
            >
              Close Verification Audit Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
