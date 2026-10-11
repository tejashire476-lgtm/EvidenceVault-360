import React from 'react';
import { XIcon } from '../icons.tsx';

export interface RejectTransferModalProps {
  rejectModalData: { handoffId: string; evdId: string } | null;
  onClose: () => void;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  onConfirmReject: () => void;
}

export const RejectTransferModal: React.FC<RejectTransferModalProps> = ({
  rejectModalData,
  onClose,
  rejectReason,
  setRejectReason,
  onConfirmReject,
}) => {
  if (!rejectModalData) return null;

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <h3 className="ev-modal-title" style={{ color: '#f87171' }}>
            Forensic Lab: Reject Evidence Transfer
          </h3>
          <button type="button" className="ev-close-btn" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <p style={{ fontSize: '13px', color: '#cbd5e1' }}>
          Record the specific administrative or integrity reason for returning evidence back to police custody.
        </p>
        <div className="ev-form-group">
          <label className="ev-form-label">Recorded Rejection Reason</label>
          <textarea
            className="ev-textarea"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Tamper tape compromised or packaging does not match acquisition manifest."
            required
          />
        </div>
        <div className="ev-form-actions">
          <button
            type="button"
            className="ev-btn ev-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ev-btn ev-btn-danger"
            onClick={onConfirmReject}
          >
            Confirm Return to Police
          </button>
        </div>
      </div>
    </div>
  );
};
