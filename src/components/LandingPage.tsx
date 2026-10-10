import React from 'react';
import type { Department } from '../types.ts';
import {
  ShieldCheckIcon,
  ArrowRightIcon,
  XIcon,
  AlertTriangleIcon,
} from './icons.tsx';

export interface LandingPageProps {
  onOpenLoginModal: (dept: Department) => void;
  portalLoginModal: Department | null;
  onCloseLoginModal: () => void;
  loginBadgeInput: string;
  setLoginBadgeInput: (v: string) => void;
  loginPinInput: string;
  setLoginPinInput: (v: string) => void;
  biometricRequireMfa: boolean;
  setBiometricRequireMfa: (v: boolean) => void;
  handleConfirmLogin: (dept: Department) => void;
  handleSimulateFailedLogin: (dept: Department) => void;
  onInstantLogin: (dept: Department) => void;
  onOpenAdmin: () => void;
  showFaqModal: boolean;
  setShowFaqModal: (v: boolean) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLoginModal,
  portalLoginModal,
  onCloseLoginModal,
  loginBadgeInput,
  setLoginBadgeInput,
  loginPinInput,
  setLoginPinInput,
  biometricRequireMfa,
  setBiometricRequireMfa,
  handleConfirmLogin,
  handleSimulateFailedLogin,
  onInstantLogin,
  onOpenAdmin,
  showFaqModal,
  setShowFaqModal,
}) => {
  return (
    <div className="ev-portal-landing">
      {/* Main White Institutional Header */}
      <header className="ev-portal-main-header">
        <div className="ev-portal-brand-block">
          <div className="ev-portal-logo-emblem">EV</div>
          <div className="ev-portal-brand-text">
            <h2>
              EVIDENCEVAULT 360
              <span className="ev-portal-accred-badge">ISO 27037 / FIPS 180-4 GRADE A+</span>
            </h2>
            <div className="ev-portal-brand-sub">
              National Digital Evidence Management & Cryptographic Chain of Custody System
            </div>
          </div>
        </div>

        <nav className="ev-portal-nav-links">
          <span className="ev-portal-nav-item" onClick={() => setShowFaqModal(true)}>About</span>
          <span className="ev-portal-nav-item" onClick={() => onOpenLoginModal('POLICE')}>Police Units</span>
          <span className="ev-portal-nav-item" onClick={() => onOpenLoginModal('FORENSIC')}>Forensic Labs</span>
          <span className="ev-portal-nav-item" onClick={() => onOpenLoginModal('PROSECUTION')}>Prosecution</span>
          <span className="ev-portal-nav-item" onClick={() => handleConfirmLogin('POLICE')}>R2 Storage</span>
          <span className="ev-portal-nav-item" onClick={() => alert('BNS 65B: Electronic records require verified cryptographic hash certificates under Bharatiya Sakshya Adhiniyam.')}>BNS 65B</span>
          <span className="ev-portal-nav-item" onClick={() => alert('Evidence Directorate Contact: Central Cyber & Digital Forensics Complex, New Delhi')}>Contact</span>
          <button
            type="button"
            className="ev-portal-admin-entry-btn"
            onClick={onOpenAdmin}
            title="Access System Administration & Cryptographic Audit Portal"
          >
            <ShieldCheckIcon size={14} />
            <span>Admin Portal</span>
          </button>
        </nav>
      </header>

      {/* Hero Visual Section with Operations Screen */}
      <div className="ev-portal-hero-container">
        <img
          src="/hero_banner.jpg"
          alt="Evidence Operations Command Portal"
          className="ev-portal-hero-img"
        />
        <div className="ev-portal-hero-overlay">
          <div className="ev-portal-hero-content">
            <h1 className="ev-portal-hero-title">
              DIGITAL EVIDENCE MANAGEMENT OPERATIONS PORTAL
            </h1>
            <div className="ev-portal-hero-sub">
              One Shared Case • Three Connected Departments • Cryptographically Verified Storage
            </div>
          </div>
        </div>
      </div>

      {/* Three Department Login Cards (Centered & Responsive) */}
      <section className="ev-portal-login-cards-section">
        {/* Card 1: Police Login */}
        <div className="ev-portal-login-card card-police">
          <div className="ev-portal-avatar-circle">
            <img src="/police_avatar.jpg" alt="Police Investigator Login" />
          </div>
          <h3 className="ev-portal-card-title">Staff / Police Login</h3>
          <p className="ev-portal-card-sub">
            State Police CID & Cyber Investigation Officers • FIR Case Ingestion • Field Evidence Registration
          </p>
          <button
            type="button"
            className="ev-portal-pill-btn"
            onClick={() => onOpenLoginModal('POLICE')}
          >
            <span>CLICK HERE</span>
            <ArrowRightIcon size={16} />
          </button>
        </div>

        {/* Card 2: Forensic Login */}
        <div className="ev-portal-login-card card-forensic">
          <div className="ev-portal-avatar-circle">
            <img src="/forensic_avatar.jpg" alt="Forensic Science Laboratory Login" />
          </div>
          <h3 className="ev-portal-card-title">Forensic Login</h3>
          <p className="ev-portal-card-sub">
            CFSL & State Forensic Scientists • Evidence Handoff Acceptance • Real SHA-256 Bit-Level Verification
          </p>
          <button
            type="button"
            className="ev-portal-pill-btn"
            onClick={() => onOpenLoginModal('FORENSIC')}
          >
            <span>CLICK HERE</span>
            <ArrowRightIcon size={16} />
          </button>
        </div>

        {/* Card 3: Prosecution Login */}
        <div className="ev-portal-login-card card-prosecution">
          <div className="ev-portal-avatar-circle">
            <img src="/prosecution_avatar.jpg" alt="Public Prosecution Judicial Login" />
          </div>
          <h3 className="ev-portal-card-title">Prosecution Login</h3>
          <p className="ev-portal-card-sub">
            Public Prosecutors & Trial Counsel • Judicial Case Evidence Index • Section 65B Admissibility Review
          </p>
          <button
            type="button"
            className="ev-portal-pill-btn"
            onClick={() => onOpenLoginModal('PROSECUTION')}
          >
            <span>CLICK HERE</span>
            <ArrowRightIcon size={16} />
          </button>
        </div>
      </section>

      {/* Clean Copyright & Legal Links Bar */}
      <div className="ev-portal-copyright-bar">
        <div>
          © 2026-27 EvidenceVault 360 - National Digital Evidence Management & Integrity Assurance System. All rights reserved.
        </div>
        <div className="ev-portal-legal-links">
          <a href="#privacy" onClick={(e) => { e.preventDefault(); alert('EvidenceVault 360 Privacy Policy: Zero unauthorized telemetry. Zero persistent data leakage.'); }}>Privacy Policy</a>
          <span>|</span>
          <a href="#terms" onClick={(e) => { e.preventDefault(); alert('Terms of Service: Authorized Law Enforcement, Forensic & Prosecution personnel only.'); }}>Terms and Conditions</a>
          <span>|</span>
          <a href="#security" onClick={(e) => { e.preventDefault(); alert('Security: AES-256 SSE at rest, TLS 1.3 in transit, NIST FIPS 180-4 verification.'); }}>Security Disclosures</a>
        </div>
      </div>

      {/* Department Login Modal Overlay */}
      {portalLoginModal && (
        <div
          className="ev-login-modal-overlay"
          onClick={onCloseLoginModal}
        >
          <div
            className="ev-login-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`ev-login-modal-header ${portalLoginModal.toLowerCase()}`}>
              <div className="ev-login-modal-avatar">
                <img
                  src={
                    portalLoginModal === 'POLICE'
                      ? '/police_avatar.jpg'
                      : portalLoginModal === 'FORENSIC'
                        ? '/forensic_avatar.jpg'
                        : portalLoginModal === 'PROSECUTION'
                          ? '/prosecution_avatar.jpg'
                          : '/admin_avatar.jpg'
                  }
                  alt={portalLoginModal}
                />
              </div>
              <div>
                <h3>
                  {portalLoginModal === 'POLICE'
                    ? 'Police Investigation Portal'
                    : portalLoginModal === 'FORENSIC'
                      ? 'Forensic Science Laboratory Portal'
                      : portalLoginModal === 'PROSECUTION'
                        ? 'Public Prosecution Judicial Portal'
                        : 'Security & Operations Admin Portal'}
                </h3>
                <p>
                  {portalLoginModal === 'ADMINISTRATION'
                    ? 'Restricted Access • Clearance Level 5 • Multi-Factor Secured'
                    : 'Secure Departmental Authentication • Multi-Factor Secured'}
                </p>
              </div>
              <button
                type="button"
                className="ev-login-modal-close"
                onClick={onCloseLoginModal}
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="ev-login-modal-body">
              <div className="ev-login-input-group">
                <label>Official Service Badge ID</label>
                <input
                  type="text"
                  value={loginBadgeInput}
                  onChange={(e) => setLoginBadgeInput(e.target.value)}
                  placeholder="Enter your official badge or service number"
                />
              </div>

              <div className="ev-login-input-group">
                <label>Cryptographic Passcode / PIN</label>
                <input
                  type="password"
                  value={loginPinInput}
                  onChange={(e) => setLoginPinInput(e.target.value)}
                  placeholder="Enter secure passcode"
                />
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheckIcon size={14} />
                <span>Hardware Security Token Verified (FIPS 140-2 Level 3)</span>
              </div>

              <div style={{ marginTop: '12px', padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={biometricRequireMfa}
                    onChange={(e) => setBiometricRequireMfa(e.target.checked)}
                  />
                  <span>Require Step-Up Biometric MFA (Offline Face Verification)</span>
                </label>
                <p style={{ margin: '4px 0 0 22px', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                  Executes local 128D mathematical embedding verification on device (Zero raw photo upload / Zero external retention).
                </p>
              </div>
            </div>

            <div className="ev-login-modal-footer">
              <button
                type="button"
                className="ev-login-submit-btn"
                onClick={() => handleConfirmLogin(portalLoginModal)}
              >
                <span>Authenticate & {biometricRequireMfa ? 'Step-Up Face Scan' : `Enter ${portalLoginModal} Portal`}</span>
                <ArrowRightIcon size={16} />
              </button>
              <button
                type="button"
                className="ev-login-quick-demo-btn"
                onClick={() => onInstantLogin(portalLoginModal)}
              >
                ⚡ One-Click Instant Demo Access (Bypass MFA)
              </button>
              <button
                type="button"
                className="ev-btn ev-btn-danger"
                style={{
                  width: '100%',
                  marginTop: '8px',
                  fontSize: '11px',
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  borderRadius: '6px',
                }}
                onClick={() => handleSimulateFailedLogin(portalLoginModal)}
              >
                <AlertTriangleIcon size={12} />
                Simulate Failed Login Security Event (Record AUTH_LOGIN_FAILED)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Help Modal */}
      {showFaqModal && (
        <div
          className="ev-login-modal-overlay"
          onClick={() => setShowFaqModal(false)}
        >
          <div
            className="ev-login-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ev-login-modal-header police">
              <div className="ev-login-modal-avatar">
                <img src="/assistant_mascot.jpg" alt="Simba" />
              </div>
              <div>
                <h3>Simba — EvidenceVault 360 Assistant</h3>
                <p>Frequently Asked Questions & Department Guide</p>
              </div>
              <button
                type="button"
                className="ev-login-modal-close"
                onClick={() => setShowFaqModal(false)}
              >
                <XIcon size={16} />
              </button>
            </div>
            <div className="ev-login-modal-body" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '14px' }}>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>1. Which department should I log into?</strong>
                <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0 0' }}>
                  • <strong>Police Login:</strong> Register new cases, upload forensic disk images, submit evidence for examination.<br />
                  • <strong>Forensic Login:</strong> Accept/reject handoffs, record laboratory findings, perform streaming SHA-256 verification.<br />
                  • <strong>Prosecution Login:</strong> Review completed reports, generate Case Evidence Indexes, accept evidence for judicial trial.
                </p>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>2. How does the real SHA-256 verification work?</strong>
                <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0 0' }}>
                  EvidenceVault 360 uses an incremental 64-byte block streaming engine complying with NIST FIPS 180-4. Bytes are read directly from storage without buffering into memory.
                </p>
              </div>
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>3. How can I test tampering detection?</strong>
                <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0 0' }}>
                  Inside the Forensic workspace, click &quot;Simulate Tamper&quot; to flip a single bit in storage. Re-running verification immediately flags a crimson MISMATCH alert!
                </p>
              </div>
            </div>
            <div className="ev-login-modal-footer">
              <button
                type="button"
                className="ev-login-submit-btn"
                onClick={() => {
                  setShowFaqModal(false);
                  handleConfirmLogin('POLICE');
                }}
              >
                Open Police Demo Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
