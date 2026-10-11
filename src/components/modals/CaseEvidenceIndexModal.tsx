import React from 'react';
import type { CaseEvidenceIndex } from '../../types.ts';
import { formatFileSize } from '../../utils/crypto.ts';
import { XIcon } from '../icons.tsx';

export interface CaseEvidenceIndexModalProps {
  caseIndexData: CaseEvidenceIndex | null;
  onClose: () => void;
}

export const CaseEvidenceIndexModal: React.FC<CaseEvidenceIndexModalProps> = ({
  caseIndexData,
  onClose,
}) => {
  if (!caseIndexData) return null;

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal ev-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <div>
            <h3 className="ev-modal-title">Official Case Evidence Index & Judicial Manifest</h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Case Ref: {caseIndexData.caseReference} • Case ID: {caseIndexData.caseId}
            </span>
          </div>
          <button type="button" className="ev-close-btn" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div className="ev-stat-pill">
            <span>Trial Readiness:</span>
            <strong
              style={{
                color:
                  caseIndexData.trialReadiness === 'READY_FOR_TRIAL' ? '#34d399' : '#f59e0b',
              }}
            >
              {caseIndexData.trialReadiness}
            </strong>
          </div>
          <div className="ev-stat-pill">
            <span>Total Evidence Items:</span>
            <strong className="ev-stat-value">{caseIndexData.totalEvidenceCount}</strong>
          </div>
          <div className="ev-stat-pill">
            <span>File Versions:</span>
            <strong className="ev-stat-value">{caseIndexData.totalFileVersions}</strong>
          </div>
          <div className="ev-stat-pill">
            <span>Forensic Reports:</span>
            <strong className="ev-stat-value">{caseIndexData.totalReportsCount}</strong>
          </div>
        </div>

        <h4 style={{ fontSize: '14px', margin: '14px 0 8px 0', color: '#f1f5f9' }}>
          Indexed Evidence Records & Hash Verification
        </h4>
        {caseIndexData.evidenceItems.map((item, idx) => (
          <div
            key={item.evidenceId}
            style={{
              background: '#0a0d18',
              border: '1px solid #1c2238',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '10px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f8fafc' }}>
              <strong>
                {idx + 1}. [{item.evidenceId}] {item.description}
              </strong>
              <span className="ev-badge ev-badge-match">{item.status}</span>
            </div>
            <div style={{ color: '#94a3b8', marginTop: '4px' }}>
              Type: {item.evidenceType} | Handoff: {item.handoffStatus} | Custody Events:{' '}
              {item.custodyChainLength}
            </div>

            {item.files.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ color: '#64748b' }}>Files & Baseline Checksums:</span>
                {item.files.map((f) => (
                  <div key={f.id} className="ev-hash-box">
                    {f.filename} ({formatFileSize(f.fileSize)}) — SHA-256:{' '}
                    {f.sha256Hash}
                  </div>
                ))}
              </div>
            )}

            {item.reports.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ color: '#64748b' }}>Forensic Report History:</span>
                {item.reports.map((r) => (
                  <div
                    key={r.reportId}
                    style={{
                      background: '#121626',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      marginTop: '4px',
                    }}
                  >
                    Version {r.versionNumber} ({r.status}) by {r.authorId}: &quot;{r.summary}&quot;
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="ev-form-actions">
          <button
            type="button"
            className="ev-btn ev-btn-primary"
            onClick={onClose}
          >
            Close Judicial Manifest
          </button>
        </div>
      </div>
    </div>
  );
};
