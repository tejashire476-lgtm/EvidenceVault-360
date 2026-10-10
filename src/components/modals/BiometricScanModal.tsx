import React from 'react';
import type {
  AuthenticatedSession,
  BiometricVerificationResult,
  BiometricConsentStatus,
} from '../../types.ts';
import {
  ScanFaceIcon,
  XIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  CameraIcon,
  ShieldCheckIcon,
} from '../icons.tsx';

export interface BiometricScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: AuthenticatedSession | null;
  consentMap: Record<string, BiometricConsentStatus>;
  onToggleConsent: (userId: string) => void;
  scanOutcome: BiometricVerificationResult | null;
  isScanning: boolean;
  livenessTestResult: 'IDLE' | 'CHALLENGE_PASSED' | 'SPOOF_DETECTED';
  onStartVerification: (scenario: 'MATCH' | 'MISMATCH' | 'SPOOF') => void;
  fallbackPinInput: string;
  setFallbackPinInput: (v: string) => void;
  fallbackError: string | null;
  onFallbackPinSubmit: () => void;
  onProceedToWorkspace: (user: AuthenticatedSession) => void;
}

export const BiometricScanModal: React.FC<BiometricScanModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  consentMap,
  onToggleConsent,
  scanOutcome,
  isScanning,
  livenessTestResult,
  onStartVerification,
  fallbackPinInput,
  setFallbackPinInput,
  fallbackError,
  onFallbackPinSubmit,
  onProceedToWorkspace,
}) => {
  if (!isOpen || !targetUser) return null;

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#312e81', color: '#c7d2fe', padding: '8px', borderRadius: '8px' }}>
              <ScanFaceIcon size={22} />
            </div>
            <div>
              <h3 className="ev-modal-title">Step-Up Offline Face Verification</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Privacy-Preserving On-Device Biometric MFA • MobileFaceNet 128D Embeddings
              </span>
            </div>
          </div>
          <button
            type="button"
            className="ev-modal-close"
            onClick={onClose}
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="ev-modal-body" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
          {/* Target Personnel Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#0a0d18', borderRadius: '8px', border: '1px solid #1e263d', marginBottom: '14px' }}>
            <img
              src={
                targetUser.department === 'POLICE'
                  ? '/police_avatar.jpg'
                  : targetUser.department === 'FORENSIC'
                    ? '/forensic_avatar.jpg'
                    : '/prosecution_avatar.jpg'
              }
              alt={targetUser.name}
              style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #38bdf8' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc' }}>
                {targetUser.name}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                {targetUser.badge} • <span style={{ color: '#38bdf8' }}>{targetUser.role}</span>
              </div>
            </div>
            <span className={`ev-auth-role-tag ${targetUser.department.toLowerCase()}`}>
              {targetUser.department}
            </span>
          </div>

          {/* Consent Status Strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#0b1120', borderRadius: '6px', border: '1px solid #1e293b', marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#94a3b8' }}>Biometric Consent:</span>
              <span
                className="ev-bio-badge"
                style={{
                  background: consentMap[targetUser.user_id] === 'GRANTED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: consentMap[targetUser.user_id] === 'GRANTED' ? '#34d399' : '#f87171',
                  border: `1px solid ${consentMap[targetUser.user_id] === 'GRANTED' ? '#059669' : '#dc2626'}`,
                }}
              >
                {consentMap[targetUser.user_id] === 'GRANTED' ? '✓ GRANTED' : '✗ WITHDRAWN'}
              </span>
            </div>
            <button
              type="button"
              style={{
                background: 'transparent',
                border: '1px solid #475569',
                color: '#cbd5e1',
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={() => onToggleConsent(targetUser.user_id)}
            >
              {consentMap[targetUser.user_id] === 'GRANTED' ? 'Revoke Consent (Purge Template)' : 'Grant Affirmative Consent'}
            </button>
          </div>

          {/* Camera Scanner Viewport */}
          <div className="ev-biometric-scanner-viewport">
            <div className="ev-biometric-corner tl" />
            <div className="ev-biometric-corner tr" />
            <div className="ev-biometric-corner bl" />
            <div className="ev-biometric-corner br" />

            <div
              className={`ev-biometric-face-target ${
                scanOutcome?.outcome === 'MATCH'
                  ? 'match'
                  : scanOutcome?.outcome === 'MISMATCH'
                    ? 'mismatch'
                    : scanOutcome?.outcome === 'LIVENESS_FAILED'
                      ? 'spoof'
                      : ''
              }`}
            >
              {isScanning && <div className="ev-biometric-scan-line" />}
              <div className="ev-biometric-landmarks">
                <div className="ev-biometric-dot" />
                <div className="ev-biometric-dot" />
              </div>
              <ScanFaceIcon size={64} style={{ color: isScanning ? '#38bdf8' : '#475569', opacity: 0.7 }} />
            </div>

            <div className="ev-biometric-challenge-pill">
              {isScanning ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>🔄</span>
                  <span>Analyzing on-device 128D mathematical embedding...</span>
                </>
              ) : livenessTestResult === 'CHALLENGE_PASSED' ? (
                <>
                  <CheckCircleIcon size={12} style={{ color: '#34d399' }} />
                  <span style={{ color: '#34d399' }}>Liveness Challenge Passed (Involuntary micro-blink detected)</span>
                </>
              ) : livenessTestResult === 'SPOOF_DETECTED' ? (
                <>
                  <AlertTriangleIcon size={12} style={{ color: '#fbbf24' }} />
                  <span style={{ color: '#fbbf24' }}>Optical Challenge Failed (Static screen/photo replay detected)</span>
                </>
              ) : (
                <>
                  <CameraIcon size={12} />
                  <span>Ready for Verification • Optical Challenge: Involuntary Blink Check</span>
                </>
              )}
            </div>
          </div>

          {/* Outcome Display Banner */}
          {scanOutcome && (
            <div className={`ev-bio-result-card ${scanOutcome.outcome.toLowerCase().replace('_', '-')}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '13px' }}>
                  {scanOutcome.outcome === 'MATCH' && '✓ MATCH: Biometric Step-Up Verified'}
                  {scanOutcome.outcome === 'MISMATCH' && '✕ MISMATCH: Facial Signature Mismatch'}
                  {scanOutcome.outcome === 'LIVENESS_FAILED' && '⚠️ PRESENTATION ATTACK DETECTED'}
                  {scanOutcome.outcome === 'CONSENT_DENIED' && '🚫 CONSENT DENIED / WITHDRAWN'}
                </strong>
                <span style={{ fontSize: '11px', opacity: 0.85 }}>
                  Latency: {scanOutcome.durationMs}ms
                </span>
              </div>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                {scanOutcome.outcome === 'MATCH' && (
                  <span>
                    Cosine Similarity <strong>{scanOutcome.similarityScore}</strong> satisfies policy threshold (<strong>{scanOutcome.threshold}</strong>). Step-up authentication accepted.
                  </span>
                )}
                {scanOutcome.outcome === 'MISMATCH' && (
                  <span>
                    Cosine Similarity <strong>{scanOutcome.similarityScore}</strong> is strictly below policy threshold (<strong>{scanOutcome.threshold}</strong>). Step-up access denied.
                  </span>
                )}
                {scanOutcome.outcome === 'LIVENESS_FAILED' && (
                  <span>
                    Failed interactive challenge-response. Static photo or digital screen replay detected. Incident logged to audit chain.
                  </span>
                )}
                {scanOutcome.outcome === 'CONSENT_DENIED' && (
                  <span>
                    Biometric capture blocked under DPDP Act 2023 / GDPR Article 9. User has withdrawn affirmative consent.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Flow Testing Toolbar */}
          <div style={{ background: '#0a0d18', padding: '12px', borderRadius: '8px', border: '1px solid #1e263d', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Execution Flows & Presentation Attack Testing
            </div>
            <div className="ev-bio-test-btn-group">
              <button
                type="button"
                className="ev-bio-test-btn permitted"
                disabled={isScanning}
                onClick={() => onStartVerification('MATCH')}
              >
                <span>🟢 Permitted Match (Score ≥ 0.85)</span>
              </button>
              <button
                type="button"
                className="ev-bio-test-btn denied"
                disabled={isScanning}
                onClick={() => onStartVerification('MISMATCH')}
              >
                <span>🔴 Mismatched Face (Score &lt; 0.85)</span>
              </button>
              <button
                type="button"
                className="ev-bio-test-btn spoof"
                disabled={isScanning}
                onClick={() => onStartVerification('SPOOF')}
              >
                <span>⚠️ Spoof / Replay Attack</span>
              </button>
            </div>
          </div>

          {/* Secure Fallback PIN Authentication */}
          <div style={{ background: '#0c1222', padding: '12px', borderRadius: '8px', border: '1px solid #0369a1', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <ShieldCheckIcon size={16} style={{ color: '#38bdf8' }} />
              <strong style={{ fontSize: '12px', color: '#e0f2fe' }}>
                Secure Fallback Authentication (Accessibility / Hardware Failure)
              </strong>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px 0' }}>
              Officers with damaged cameras, adverse field illumination, facial trauma, or accessibility needs may bypass facial matching using their secure cryptographic PIN.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                placeholder="Enter Security PIN (e.g. 849204)"
                value={fallbackPinInput}
                onChange={(e) => setFallbackPinInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#070b14',
                  border: '1px solid #1e293b',
                  borderRadius: '4px',
                  color: '#f8fafc',
                  padding: '6px 10px',
                  fontSize: '12px',
                }}
              />
              <button
                type="button"
                className="ev-bio-test-btn fallback"
                onClick={onFallbackPinSubmit}
              >
                🔑 Fallback PIN Login
              </button>
            </div>
            {fallbackError && (
              <div style={{ color: '#f87171', fontSize: '11px', marginTop: '6px' }}>
                {fallbackError}
              </div>
            )}
          </div>

          {/* Hardware Limitations Disclaimer */}
          <div className="ev-bio-disclaimer-box">
            <strong>Forensic & Hardware Limitations Disclaimer:</strong> Standard consumer RGB webcams lack 3D structured light and thermal depth sensors (unlike Apple TrueDepth or FIPS Level 4 biometrics). Software challenge-response checks cannot guarantee resistance against 4K digital screen replays. Biometric matching is strictly an auxiliary Step-Up factor alongside official Service Badge credentials.
          </div>
        </div>

        <div className="ev-modal-footer">
          <button
            type="button"
            className="ev-btn ev-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          {scanOutcome?.outcome === 'MATCH' && (
            <button
              type="button"
              className="ev-btn ev-btn-primary"
              onClick={() => onProceedToWorkspace(targetUser)}
            >
              Proceed to Workspace →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
