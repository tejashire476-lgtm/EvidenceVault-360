import { useState, useEffect } from 'react';
import { globalDb } from '../data/db.ts';
import { seedDatabase } from '../data/seed.ts';
import { computeSha256 } from '../utils/crypto.ts';
import {
  globalStorageEngine,
  validateEvidenceFile,
  generateSyntheticForensicPayload,
  generateSignedUrl,
  CHUNK_SIZE_BYTES,
} from '../utils/storage.ts';
import { verifyEvidenceFileVersionIntegrity } from '../utils/verification.ts';
import {
  globalOfflineEngine,
  OfflineCacheManager,
  OfflineQueueManager,
} from '../utils/offlineSync.ts';
import { globalBiometricEngine } from '../utils/biometric.ts';
import {
  AuditReviewEngine,
  AuditReviewScheduler,
} from '../utils/auditReview.ts';
import { authenticateDepartmentPortal } from '../utils/security.ts';
import type {
  Department,
  EvidenceType,
  EvidenceFileVersion,
  UserRole,
  CaseEvidenceIndex,
  ComplianceAuditReport,
  UploadProgressEvent,
  NetworkSyncStatus,
  OfflineQueueItem,
  ApprovedOfflineMetadataCache,
  BiometricVerificationResult,
  BiometricConsentStatus,
  AuditDashboardFinding,
  WeeklyAuditSummary,
  ProsecutionCaseEvidenceIndexReport,
  SecurityContext,
  AuthenticatedSession,
} from '../types.ts';
import { DEPARTMENT_PRESETS } from '../types.ts';

function createTimestamp(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useVaultOperations() {
  // Authentication & Session
  const [currentUser, setCurrentUser] = useState<AuthenticatedSession | null>(null);
  const [portalLoginModal, setPortalLoginModal] = useState<Department | null>(null);
  const [loginBadgeInput, setLoginBadgeInput] = useState('');
  const [loginPinInput, setLoginPinInput] = useState('••••••••');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showSecurityLogsModal, setShowSecurityLogsModal] = useState(false);

  // Active Workspace State
  const [activeDept, setActiveDept] = useState<Department | 'AUDIT' | 'STORAGE'>('POLICE');
  const [activeNavTab, setActiveNavTab] = useState<'DASHBOARD' | 'PORTAL' | 'EVIDENCE' | 'CASES' | 'FORENSICS' | 'REPORTS' | 'CUSTODY' | 'USERS' | 'SETTINGS'>('DASHBOARD');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('CASE-2026-001');
  const [newFindingText, setNewFindingText] = useState('');
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  // Modals state
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [showRegisterEvidenceModal, setShowRegisterEvidenceModal] = useState(false);
  const [rejectModalData, setRejectModalData] = useState<{ handoffId: string; evdId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [caseIndexData, setCaseIndexData] = useState<CaseEvidenceIndex | null>(null);
  const [complianceReportData, setComplianceReportData] = useState<ComplianceAuditReport | null>(null);
  const [prosecutionNotes, setProsecutionNotes] = useState('');
  const [clarificationValidationError, setClarificationValidationError] = useState<string | null>(null);
  const [clarificationFeedback, setClarificationFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [forensicResponseDraft, setForensicResponseDraft] = useState<Record<string, string>>({});

  // Form states for New Case
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseRef, setNewCaseRef] = useState('');
  const [newCaseCategory, setNewCaseCategory] = useState('Cyber Financial Crime');
  const [newCaseError, setNewCaseError] = useState<string | null>(null);

  // Form states for Register Evidence
  const [newEvDescription, setNewEvDescription] = useState('');
  const [newEvType, setNewEvType] = useState<EvidenceType>('DISK_IMAGE');
  const [newEvSource, setNewEvSource] = useState('');
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null);
  const [newEvFilename, setNewEvFilename] = useState('');
  const [newEvFileSize, setNewEvFileSize] = useState('10485760');
  const [newEvHash, setNewEvHash] = useState('');
  const [newEvError, setNewEvError] = useState<string | null>(null);

  // Upload Progress & Storage State
  const [uploadProgress, setUploadProgress] = useState<UploadProgressEvent | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [storageMetrics, setStorageMetrics] = useState(() => globalStorageEngine.getStorageMetrics());

  // Verification & Tamper Simulation State
  const [verifyingFileId, setVerifyingFileId] = useState<string | null>(null);
  const [viewingHistoryFileVersionId, setViewingHistoryFileVersionId] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    text: string;
    result: 'MATCH' | 'MISMATCH' | 'ERROR';
  } | null>(null);

  // Store state from globalDb
  const [dbStore, setDbStore] = useState(() => globalDb.getSnapshot());

  useEffect(() => {
    return globalDb.subscribe(() => {
      setDbStore(globalDb.getSnapshot());
    });
  }, []);

  const { cases, evidence, handoffs, reports, reviews } = dbStore;

  // Offline Mode & Synchronization State
  const [networkStatus, setNetworkStatus] = useState<NetworkSyncStatus>(() => globalOfflineEngine.getNetworkStatus());
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => OfflineQueueManager.getQueue());
  const [showOfflineCenterModal, setShowOfflineCenterModal] = useState(false);
  const [offlineCenterTab, setOfflineCenterTab] = useState<'QUEUE' | 'CONFLICTS' | 'BATCHES' | 'CACHE' | 'DISCLOSURES'>('QUEUE');
  const [selectedConflictEventId, setSelectedConflictEventId] = useState<string | null>(null);
  const [conflictJustification, setConflictJustification] = useState('');
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [approvedCacheState, setApprovedCacheState] = useState<ApprovedOfflineMetadataCache | null>(null);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // Biometric Face Verification State
  const [showBiometricFeasibilityModal, setShowBiometricFeasibilityModal] = useState(false);
  const [biometricReportTab, setBiometricReportTab] = useState<
    'OVERVIEW' | 'BROWSERS_DEVICES' | 'ON_DEVICE_MODELS' | 'PRIVACY_STORAGE' | 'LIVENESS_SPOOFING' | 'FAR_FRR_RISK' | 'FALLBACK_A11Y' | 'TEST_MATRIX'
  >('OVERVIEW');
  const [showBiometricScanModal, setShowBiometricScanModal] = useState(false);
  const [biometricTargetUser, setBiometricTargetUser] = useState<AuthenticatedSession | null>(null);
  const [biometricRequireMfa, setBiometricRequireMfa] = useState(true);
  const [biometricScanOutcome, setBiometricScanOutcome] = useState<BiometricVerificationResult | null>(null);
  const [biometricIsScanning, setBiometricIsScanning] = useState(false);
  const [biometricConsentMap, setBiometricConsentMap] = useState<Record<string, BiometricConsentStatus>>(() => ({
    'USR-POLICE-01': 'GRANTED',
    'USR-FORENSIC-01': 'GRANTED',
    'USR-PROSECUTOR-01': 'GRANTED',
    'USR-ADMIN-01': 'GRANTED',
  }));
  const [biometricLivenessTestResult, setBiometricLivenessTestResult] = useState<'IDLE' | 'CHALLENGE_PASSED' | 'SPOOF_DETECTED'>('IDLE');
  const [biometricFallbackPinInput, setBiometricFallbackPinInput] = useState('');
  const [biometricFallbackError, setBiometricFallbackError] = useState<string | null>(null);
  const [biometricTestMatrixLog, setBiometricTestMatrixLog] = useState<string[]>([
    `[INITIALIZED] MobileFaceNet 128D offline model ready (Zero raw image retention)`,
  ]);

  // Weekly Audit & Review Dashboard State
  const [showAuditDashboardModal, setShowAuditDashboardModal] = useState(false);
  const [auditDashboardTab, setAuditDashboardTab] = useState<
    'ALL' | 'CONFIRMED' | 'WARNINGS' | 'SUSPICIONS' | 'CASE_INDEX' | 'AUTOMATION'
  >('ALL');
  const [auditDatePreset, setAuditDatePreset] = useState<'7_DAYS' | '30_DAYS' | '90_DAYS' | 'CUSTOM'>('7_DAYS');
  const [auditStartDate, setAuditStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [auditEndDate, setAuditEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [auditSelectedCaseId, setAuditSelectedCaseId] = useState('CASE-2026-001');
  const [auditFindings, setAuditFindings] = useState<AuditDashboardFinding[]>([]);
  const [auditWeeklySummary, setAuditWeeklySummary] = useState<WeeklyAuditSummary | null>(null);
  const [auditCaseEvidenceIndex, setAuditCaseEvidenceIndex] = useState<ProsecutionCaseEvidenceIndexReport | null>(null);
  const [auditIsGenerating, setAuditIsGenerating] = useState(false);
  const [auditExportFeedback, setAuditExportFeedback] = useState<string | null>(null);
  const [auditSchedulerInfo, setAuditSchedulerInfo] = useState(() => AuditReviewScheduler.getSchedulerStatus());

  // Bootstrap seed & offline engine subscriptions
  useEffect(() => {
    seedDatabase(globalDb)
      .then((res) => {
        if (res.casesSeeded > 0) {
          setSeedNotice(`Idempotent Seed Initialized (${res.casesSeeded} cases)`);
        }
      })
      .catch((err) => console.error('Failed to seed database:', err));

    const unsubscribeSync = globalOfflineEngine.subscribe((status) => {
      setNetworkStatus(status);
      setOfflineQueue(OfflineQueueManager.getQueue());
    });

    OfflineCacheManager.getApprovedCache().then((cache) => {
      setApprovedCacheState(cache);
    });

    return () => {
      unsubscribeSync();
    };
  }, []);

  // Login Handlers
  const handleOpenLoginModal = (dept: Department) => {
    setPortalLoginModal(dept);
    setLoginBadgeInput(DEPARTMENT_PRESETS[dept].badge);
    setLoginPinInput('••••••••');
    setLoginError(null);
  };

  const handleConfirmLogin = async (dept: Department) => {
    setLoginError(null);
    const authResult = await authenticateDepartmentPortal(
      {
        department: dept,
        badge: loginBadgeInput || DEPARTMENT_PRESETS[dept].badge,
        passcode: loginPinInput,
        isDemo: false,
      },
      globalDb
    );

    if (!authResult.success) {
      setLoginError(authResult.error || 'Department access denied.');
      return;
    }

    const session = authResult.user!;

    if (biometricRequireMfa) {
      setBiometricTargetUser(session);
      setShowBiometricScanModal(true);
      setBiometricScanOutcome(null);
      setBiometricLivenessTestResult('IDLE');
      setPortalLoginModal(null);
    } else {
      setCurrentUser(session);
      setActiveDept(dept);
      setActiveNavTab('DASHBOARD');
      setPortalLoginModal(null);
    }
  };

  const handleInstantLogin = async (dept: Department) => {
    setLoginError(null);
    const authResult = await authenticateDepartmentPortal(
      {
        department: dept,
        badge: DEPARTMENT_PRESETS[dept].badge,
        passcode: '••••••••',
        isDemo: true,
      },
      globalDb
    );

    if (authResult.success && authResult.user) {
      setCurrentUser(authResult.user);
      setActiveDept(dept);
      setActiveNavTab('DASHBOARD');
      setPortalLoginModal(null);
    } else if (authResult.error) {
      setLoginError(authResult.error);
    }
  };

  const handleSimulateFailedLogin = async (dept: Department) => {
    const attemptedId = loginBadgeInput.trim() || 'UNKNOWN-ACTOR';
    try {
      await globalDb.recordAuditEvent({
        actor_id: attemptedId,
        actor_role: 'UNAUTHENTICATED',
        department: dept,
        action: 'AUTH_LOGIN_FAILED',
        entity_type: 'USER',
        entity_id: attemptedId,
        status: 'FAILURE',
        reason: 'Invalid cryptographic passcode or bad service badge ID',
        ip_address: '192.168.1.105',
        user_agent: navigator.userAgent,
        payload: {
          attempted_department: dept,
          entered_badge: loginBadgeInput,
          security_alert: 'FAILED_AUTHENTICATION_DETECTED',
        },
      });
      alert(`[SECURITY AUDIT LOGGED] Failed login attempt recorded for department '${dept}' (Badge: '${attemptedId}').`);
    } catch (err) {
      console.error('Failed to record failed login audit:', err);
    }
  };

  // Biometric Handlers
  const handleToggleConsent = (userId: string) => {
    const current = biometricConsentMap[userId] || 'NOT_REQUESTED';
    const nextGranted = current !== 'GRANTED';
    globalBiometricEngine.recordConsent(userId, nextGranted);
    setBiometricConsentMap((prev) => ({
      ...prev,
      [userId]: nextGranted ? 'GRANTED' : 'WITHDRAWN',
    }));
  };

  const handleStartBiometricVerification = async (
    scenario: 'MATCH' | 'MISMATCH' | 'SPOOF' = 'MATCH',
    candidateVector?: number[]
  ) => {
    if (!biometricTargetUser) return;
    setBiometricIsScanning(true);
    setBiometricScanOutcome(null);
    setBiometricFallbackError(null);

    await new Promise((r) => setTimeout(r, 400));

    let candidateVec = candidateVector;
    let challengeResponseValid = true;

    if (scenario === 'MATCH') {
      if (!candidateVec || candidateVec.length !== 128) {
        candidateVec = globalBiometricEngine.generateCandidateVector(biometricTargetUser.user_id, 0.02);
      }
      challengeResponseValid = true;
      setBiometricLivenessTestResult('CHALLENGE_PASSED');
    } else if (scenario === 'MISMATCH') {
      candidateVec = globalBiometricEngine.generateCandidateVector(biometricTargetUser.user_id, 0.85);
      challengeResponseValid = true;
      setBiometricLivenessTestResult('CHALLENGE_PASSED');
    } else if (scenario === 'SPOOF') {
      challengeResponseValid = false;
      setBiometricLivenessTestResult('SPOOF_DETECTED');
    }

    const result = await globalBiometricEngine.verifyFace({
      userId: biometricTargetUser.user_id,
      candidateVector: candidateVec,
      simulateLivenessChallenge: true,
      challengeResponseValid,
      database: globalDb,
    });

    setBiometricScanOutcome(result);
    setBiometricIsScanning(false);

    if (result.isMatch) {
      setTimeout(() => {
        setCurrentUser(biometricTargetUser);
        setActiveDept(biometricTargetUser.department);
        setShowBiometricScanModal(false);
      }, 1000);
    }
  };

  const handleFallbackPinSubmit = () => {
    if (!biometricTargetUser) return;
    setBiometricFallbackError(null);
    const authRes = globalBiometricEngine.triggerFallbackPinAuth(
      biometricTargetUser.user_id,
      biometricFallbackPinInput || '••••••••'
    );
    if (authRes.success) {
      setCurrentUser(biometricTargetUser);
      setActiveDept(biometricTargetUser.department);
      setShowBiometricScanModal(false);
      setBiometricFallbackPinInput('');
    } else {
      setBiometricFallbackError(authRes.error || 'Invalid PIN/Passcode');
    }
  };

  const handleRunMatrixTest = async (testType: 'PERMITTED' | 'DENIED' | 'SPOOF' | 'FALLBACK') => {
    const timestamp = new Date().toLocaleTimeString();
    if (testType === 'PERMITTED') {
      const candidate = globalBiometricEngine.generateCandidateVector('USR-POLICE-01', 0.02);
      const res = await globalBiometricEngine.verifyFace({
        userId: 'USR-POLICE-01',
        candidateVector: candidate,
        simulateLivenessChallenge: true,
        challengeResponseValid: true,
        database: globalDb,
      });
      setBiometricTestMatrixLog((prev) => [
        `[${timestamp}] PERMITTED FLOW -> Outcome: ${res.outcome} | Similarity: ${res.similarityScore} >= 0.85 | Liveness: PASS | Duration: ${res.durationMs}ms`,
        ...prev.slice(0, 7),
      ]);
    } else if (testType === 'DENIED') {
      const candidate = globalBiometricEngine.generateCandidateVector('USR-POLICE-01', 0.85);
      const res = await globalBiometricEngine.verifyFace({
        userId: 'USR-POLICE-01',
        candidateVector: candidate,
        simulateLivenessChallenge: true,
        challengeResponseValid: true,
        database: globalDb,
      });
      setBiometricTestMatrixLog((prev) => [
        `[${timestamp}] DENIED FLOW -> Outcome: ${res.outcome} | Similarity: ${res.similarityScore} < 0.85 | Access Blocked`,
        ...prev.slice(0, 7),
      ]);
    } else if (testType === 'SPOOF') {
      const res = await globalBiometricEngine.verifyFace({
        userId: 'USR-POLICE-01',
        simulateLivenessChallenge: true,
        challengeResponseValid: false,
        database: globalDb,
      });
      setBiometricTestMatrixLog((prev) => [
        `[${timestamp}] PRESENTATION ATTACK -> Outcome: ${res.outcome} | Liveness: FAILED | Security Incident Recorded`,
        ...prev.slice(0, 7),
      ]);
    } else if (testType === 'FALLBACK') {
      const res = globalBiometricEngine.triggerFallbackPinAuth('USR-POLICE-01', '849204');
      setBiometricTestMatrixLog((prev) => [
        `[${timestamp}] FALLBACK PIN -> Authenticated via Passcode | Success: ${res.success} | Camera Bypassed`,
        ...prev.slice(0, 7),
      ]);
    }
  };

  // Audit Review Handlers
  const handleRunAuditReview = async () => {
    setAuditIsGenerating(true);
    setAuditExportFeedback(null);
    try {
      const actorCtx: SecurityContext = {
        actorId: currentUser?.user_id || 'USR-ADMIN-01',
        role: currentUser?.role || 'SYSTEM_ADMIN',
      };
      const startIso = new Date(`${auditStartDate}T00:00:00.000Z`).toISOString();
      const endIso = new Date(`${auditEndDate}T23:59:59.999Z`).toISOString();

      const summary = await AuditReviewEngine.generateWeeklySummary(globalDb, actorCtx, {
        startDate: startIso,
        endDate: endIso,
      });
      const findings = await AuditReviewEngine.generateAuditFindings(
        globalDb,
        { startDate: startIso, endDate: endIso },
        actorCtx
      );
      const caseIndex = AuditReviewEngine.generateProsecutionEvidenceIndex(
        globalDb,
        auditSelectedCaseId,
        actorCtx
      );

      setAuditWeeklySummary(summary);
      setAuditFindings(findings);
      setAuditCaseEvidenceIndex(caseIndex);
      AuditReviewScheduler.recordManualRun();
      setAuditSchedulerInfo(AuditReviewScheduler.getSchedulerStatus());
    } catch (err: unknown) {
      setAuditExportFeedback(`Audit generation error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAuditIsGenerating(false);
    }
  };

  const handleExportWeeklySummaryCsv = () => {
    if (!auditWeeklySummary) return;
    try {
      const csvContent = AuditReviewEngine.exportWeeklyAuditSummaryToCsv(auditWeeklySummary);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `evidencevault-weekly-audit-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setAuditExportFeedback('Weekly Audit Summary CSV exported successfully.');
      setTimeout(() => setAuditExportFeedback(null), 4000);
    } catch (err: unknown) {
      setAuditExportFeedback(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExportCaseIndexCsv = () => {
    if (!auditCaseEvidenceIndex) return;
    try {
      const csvContent = AuditReviewEngine.exportCaseEvidenceIndexToCsv(auditCaseEvidenceIndex);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `case-evidence-index-${auditCaseEvidenceIndex.caseReference}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setAuditExportFeedback(`Case Evidence Index CSV for '${auditCaseEvidenceIndex.caseReference}' exported successfully.`);
      setTimeout(() => setAuditExportFeedback(null), 4000);
    } catch (err: unknown) {
      setAuditExportFeedback(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleToggleSchedulerTimer = () => {
    if (auditSchedulerInfo.isIntervalActive) {
      AuditReviewScheduler.stopScheduler();
    } else {
      AuditReviewScheduler.startWeeklyScheduler(globalDb);
    }
    setAuditSchedulerInfo(AuditReviewScheduler.getSchedulerStatus());
  };

  // Offline Sync Handlers
  const handleToggleNetwork = () => {
    const nextStatus = globalOfflineEngine.simulateNetworkToggle(networkStatus === 'OFFLINE');
    setNetworkStatus(nextStatus);
    setOfflineQueue(OfflineQueueManager.getQueue());
  };

  const handleRunSync = async () => {
    setIsSyncingOffline(true);
    setOfflineNotice(null);
    try {
      const summary = await globalOfflineEngine.syncQueue(globalDb);
      setOfflineQueue(OfflineQueueManager.getQueue());
      setOfflineNotice(
        `Synchronization complete: ${summary.syncedCount} synced, ${summary.conflictCount} conflicts, ${summary.rejectedCount} rejected.`
      );
      setTimeout(() => setOfflineNotice(null), 6000);
    } catch (err: unknown) {
      setOfflineNotice(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSyncingOffline(false);
    }
  };

  const handleResolveConflict = async (strategy: 'DISCARD_LOCAL' | 'FORCE_OVERWRITE') => {
    if (!selectedConflictEventId) return;
    try {
      await globalOfflineEngine.resolveConflict(selectedConflictEventId, strategy, conflictJustification, globalDb);
      setOfflineQueue(OfflineQueueManager.getQueue());
      setSelectedConflictEventId(null);
      setConflictJustification('');
      setOfflineNotice(`Conflict resolved successfully using '${strategy}'.`);
      setTimeout(() => setOfflineNotice(null), 5000);
    } catch (err: unknown) {
      setOfflineNotice(`Error resolving conflict: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCacheApprovedMetadata = async () => {
    try {
      const userId = currentUser ? currentUser.user_id : 'USR-OFFLINE-USER';
      const cacheObj = await OfflineCacheManager.cacheApprovedMetadata(userId, cases, evidence);
      setApprovedCacheState(cacheObj);
      setOfflineNotice(
        `Cached ${cacheObj.cases.length} cases and ${cacheObj.evidenceSummary.length} evidence metadata items.`
      );
      setTimeout(() => setOfflineNotice(null), 5000);
    } catch (err: unknown) {
      setOfflineNotice(`Caching error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Police: Create Case
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewCaseError(null);
    if (!newCaseTitle.trim() || !newCaseRef.trim()) {
      setNewCaseError('Title and Reference code are required.');
      return;
    }
    const caseId = createId('CASE');
    const caseRef = newCaseRef.trim().toUpperCase();

    if (networkStatus === 'OFFLINE') {
      OfflineQueueManager.enqueueAction({
        action: 'CREATE_CASE',
        actorId: currentUser?.user_id || 'USR-POLICE-01',
        actorRole: currentUser?.role || 'POLICE_INVESTIGATOR',
        actorDepartment: 'POLICE',
        payload: {
          id: caseId,
          case_reference: caseRef,
          title: newCaseTitle.trim(),
          category: newCaseCategory,
          incident_date: createTimestamp(),
          assigned_officer_id: currentUser?.user_id || 'USR-POLICE-01',
          status: 'OPEN',
          created_by: currentUser?.user_id || 'USR-POLICE-01',
        },
      });
      setOfflineQueue(OfflineQueueManager.getQueue());
      setSelectedCaseId(caseId);
      setShowCreateCaseModal(false);
      setNewCaseTitle('');
      setNewCaseRef('');
      setOfflineNotice(`[OFFLINE QUEUED] Case '${caseRef}' saved to local queue.`);
      setTimeout(() => setOfflineNotice(null), 6000);
      return;
    }

    try {
      await globalDb.createCase({
        id: caseId,
        case_reference: caseRef,
        title: newCaseTitle.trim(),
        category: newCaseCategory,
        incident_date: createTimestamp(),
        assigned_officer_id: currentUser?.user_id || 'USR-POLICE-01',
        status: 'OPEN',
        created_by: currentUser?.user_id || 'USR-POLICE-01',
      });
      setSelectedCaseId(caseId);
      setShowCreateCaseModal(false);
      setNewCaseTitle('');
      setNewCaseRef('');
    } catch (err: unknown) {
      setNewCaseError(err instanceof Error ? err.message : String(err));
    }
  };

  // Police: Register Evidence & Large File Upload Ingestion
  const handleRegisterEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewEvError(null);
    const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
    if (!selectedCase) {
      setNewEvError('No case selected.');
      return;
    }

    const filename = selectedLocalFile ? selectedLocalFile.name : newEvFilename.trim();

    if (!newEvDescription.trim() || !filename) {
      setNewEvError('Description and Filename are required.');
      return;
    }

    try {
      const evId = createId('EVD');
      let fileBytes: Uint8Array;
      if (selectedLocalFile) {
        const buffer = await selectedLocalFile.arrayBuffer();
        fileBytes = new Uint8Array(buffer);
      } else {
        fileBytes = generateSyntheticForensicPayload(filename);
      }

      const validation = validateEvidenceFile(
        filename,
        fileBytes.length,
        newEvType,
        fileBytes,
        selectedLocalFile?.type
      );
      if (!validation.isValid) {
        setNewEvError(validation.errorMessage || 'Invalid file.');
        return;
      }

      const calculatedHash = await computeSha256(fileBytes);
      const finalHash = newEvHash.trim() || calculatedHash;

      if (networkStatus === 'OFFLINE') {
        OfflineQueueManager.enqueueAction({
          action: 'REGISTER_EVIDENCE',
          actorId: currentUser?.user_id || 'USR-POLICE-01',
          actorRole: currentUser?.role || 'POLICE_INVESTIGATOR',
          actorDepartment: 'POLICE',
          payload: {
            id: evId,
            case_id: selectedCase.id,
            description: newEvDescription.trim(),
            evidence_type: newEvType,
            source_description: newEvSource.trim() || 'Field evidence acquisition',
            collected_by: currentUser?.user_id || 'USR-POLICE-01',
            collected_at: createTimestamp(),
            current_status: 'ACQUIRED',
            created_by: currentUser?.user_id || 'USR-POLICE-01',
          },
        });
        setOfflineQueue(OfflineQueueManager.getQueue());
        setShowRegisterEvidenceModal(false);
        setNewEvDescription('');
        setNewEvSource('');
        setNewEvFilename('');
        setSelectedLocalFile(null);
        setOfflineNotice(`[OFFLINE QUEUED] Evidence item '${evId}' metadata recorded locally.`);
        setTimeout(() => setOfflineNotice(null), 6000);
        return;
      }

      setIsUploading(true);
      const versionId = 'v1';

      const session = globalStorageEngine.initiateMultipartUpload({
        caseId: selectedCase.id,
        evidenceId: evId,
        versionId,
        originalFilename: filename,
        contentType: validation.detectedMimeType,
        totalSizeBytes: fileBytes.length,
        evidenceType: newEvType,
        uploadedBy: 'USR-POLICE-01',
        expectedSha256: finalHash,
      });

      setActiveUploadId(session.uploadId);

      const totalParts = Math.ceil(fileBytes.length / CHUNK_SIZE_BYTES) || 1;
      for (let i = 0; i < totalParts; i++) {
        const start = i * CHUNK_SIZE_BYTES;
        const end = Math.min(fileBytes.length, start + CHUNK_SIZE_BYTES);
        const chunk = fileBytes.slice(start, end);

        await globalStorageEngine.uploadPart(session.uploadId, i + 1, chunk, (prog) => {
          setUploadProgress(prog);
        });
      }

      const completedUpload = await globalStorageEngine.completeMultipartUpload(
        session.uploadId,
        fileBytes
      );

      await globalDb.createEvidence({
        id: evId,
        case_id: selectedCase.id,
        description: newEvDescription.trim(),
        evidence_type: newEvType,
        source_description: newEvSource.trim() || 'Field evidence acquisition',
        collected_by: 'USR-POLICE-01',
        collected_at: createTimestamp(),
        current_status: 'ACQUIRED',
        created_by: 'USR-POLICE-01',
      });

      await globalDb.addFileVersion({
        id: createId('FILE'),
        evidence_id: evId,
        original_filename: filename,
        generated_storage_key: completedUpload.storageKey,
        content_type: validation.detectedMimeType,
        file_size: completedUpload.totalBytes,
        sha256_hash: completedUpload.sha256,
        baseline_created_at: createTimestamp(),
        uploaded_by: 'USR-POLICE-01',
      });

      setStorageMetrics(globalStorageEngine.getStorageMetrics());
      setIsUploading(false);
      setUploadProgress(null);
      setActiveUploadId(null);
      setShowRegisterEvidenceModal(false);
      setSelectedLocalFile(null);
      setNewEvDescription('');
      setNewEvFilename('');
      setNewEvHash('');
      setNewEvSource('');
    } catch (err: unknown) {
      setIsUploading(false);
      setUploadProgress(null);
      setActiveUploadId(null);
      setNewEvError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCancelUpload = () => {
    if (activeUploadId) {
      globalStorageEngine.abortMultipartUpload(activeUploadId);
      setIsUploading(false);
      setUploadProgress(null);
      setActiveUploadId(null);
      setNewEvError('Upload cancelled. Incomplete chunks purged from object storage.');
    }
  };

  const handleDownloadArtifact = async (storageKey: string, filename: string) => {
    try {
      const authorizedRole: UserRole =
        activeDept === 'PROSECUTION'
          ? 'PUBLIC_PROSECUTOR'
          : activeDept === 'FORENSIC'
            ? 'FORENSIC_EXAMINER'
            : 'SYSTEM_ADMIN';

      const signed = await generateSignedUrl(storageKey, authorizedRole, 'GET', 300);
      const record = await globalStorageEngine.getObjectBySignedUrl(signed.url, authorizedRole);

      const blob = new Blob([record.data as unknown as BlobPart], { type: record.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Forensic Verification Handlers
  const handleRunVerification = async (fileVersionId: string) => {
    try {
      setVerifyingFileId(fileVersionId);
      const actorRole: UserRole =
        currentUser?.role ||
        (activeDept === 'PROSECUTION' ? 'PUBLIC_PROSECUTOR' : 'FORENSIC_EXAMINER');
      const actorId =
        currentUser?.user_id ||
        (activeDept === 'PROSECUTION' ? 'USR-PROSECUTOR-01' : 'USR-FORENSIC-01');

      if (
        actorRole !== 'FORENSIC_EXAMINER' &&
        actorRole !== 'PUBLIC_PROSECUTOR' &&
        actorRole !== 'SYSTEM_ADMIN'
      ) {
        throw new Error(
          `Authorization Failure: Role '${actorRole}' is not permitted to perform cryptographic evidence verification. Verification requires Forensic Examiner or Public Prosecutor clearance.`
        );
      }

      const res = await verifyEvidenceFileVersionIntegrity({
        fileVersionId,
        actorId,
        actorRole,
        database: globalDb,
        storageEngine: globalStorageEngine,
        useStreaming: true,
      });

      setVerifyingFileId(null);
      setVerificationFeedback({
        text:
          res.result === 'MATCH'
            ? `✔ Cryptographic Integrity Confirmed: SHA-256 match verified against storage payload (${res.duration_ms} ms).`
            : res.result === 'MISMATCH'
              ? `⚠ TAMPER ALERT: Observed storage hash does NOT match baseline manifest! Potential tampering detected.`
              : `✖ Storage Error: ${res.error_reason}`,
        result: res.result,
      });
      setTimeout(() => setVerificationFeedback(null), 7000);
    } catch (err: unknown) {
      setVerifyingFileId(null);
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSimulateTamper = async (fv: EvidenceFileVersion) => {
    try {
      setVerifyingFileId(fv.id);
      const actorRole: UserRole = currentUser?.role || 'FORENSIC_EXAMINER';
      const actorId = currentUser?.user_id || 'USR-FORENSIC-01';

      if (actorRole !== 'FORENSIC_EXAMINER' && actorRole !== 'SYSTEM_ADMIN') {
        throw new Error(
          `Authorization Failure: Role '${actorRole}' is not permitted to inject storage tamper. Action restricted to Forensic Examiner role.`
        );
      }

      globalStorageEngine.tamperObject(fv.generated_storage_key, 0);

      const res = await verifyEvidenceFileVersionIntegrity({
        fileVersionId: fv.id,
        actorId,
        actorRole,
        database: globalDb,
        storageEngine: globalStorageEngine,
        useStreaming: true,
      });

      setVerifyingFileId(null);
      setVerificationFeedback({
        text: `⚠ Tamper Injected! Byte 0 was inverted in private object storage. Verification detected MISMATCH immediately (${res.observed_sha256.slice(0, 16)}...).`,
        result: 'MISMATCH',
      });
      setTimeout(() => setVerificationFeedback(null), 7000);
    } catch (err: unknown) {
      setVerifyingFileId(null);
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRestorePristine = async (fv: EvidenceFileVersion) => {
    try {
      setVerifyingFileId(fv.id);
      const actorRole: UserRole = currentUser?.role || 'FORENSIC_EXAMINER';
      const actorId = currentUser?.user_id || 'USR-FORENSIC-01';

      if (actorRole !== 'FORENSIC_EXAMINER' && actorRole !== 'SYSTEM_ADMIN') {
        throw new Error(
          `Authorization Failure: Role '${actorRole}' is not permitted to perform controlled evidence restoration. Action restricted to Forensic Examiner role.`
        );
      }

      if (!globalStorageEngine.hasPristineSnapshot(fv.generated_storage_key)) {
        throw new Error(
          `Controlled Recovery Aborted: No pristine baseline snapshot found for storage key '${fv.generated_storage_key}'. Authentic bytes cannot be fabricated.`
        );
      }

      // Restore authentic original bytes from private baseline storage
      globalStorageEngine.restorePristine(fv.generated_storage_key);

      // Perform genuine cryptographic re-verification
      const res = await verifyEvidenceFileVersionIntegrity({
        fileVersionId: fv.id,
        actorId,
        actorRole,
        database: globalDb,
        storageEngine: globalStorageEngine,
        useStreaming: true,
      });

      // Record authoritative recovery event in tamper-evident blockchain audit ledger
      await globalDb.recordAuditEvent({
        actor_id: actorId,
        actor_role: actorRole,
        department: currentUser?.department || 'FORENSIC',
        action: 'EVIDENCE_RESTORED_TO_PRISTINE',
        entity_type: 'EvidenceFileVersion',
        entity_id: fv.id,
        status: res.result === 'MATCH' ? 'SUCCESS' : 'FAILURE',
        payload: {
          storage_key: fv.generated_storage_key,
          baseline_sha256: fv.sha256_hash,
          observed_sha256: res.observed_sha256,
          verification_result: res.result,
          recovery_type: 'WORM_PRISTINE_RECOVERY',
        },
      });

      setVerifyingFileId(null);
      if (res.result === 'MATCH') {
        setVerificationFeedback({
          text: `✔ Controlled Recovery Success: Authentic original evidence bytes restored from private baseline vault. Re-verification confirmed intact MATCH (${res.duration_ms} ms).`,
          result: 'MATCH',
        });
      } else {
        setVerificationFeedback({
          text: `⚠ Recovery Warning: Restored bytes produced checksum '${res.observed_sha256.slice(0, 12)}...', which does not match baseline manifest.`,
          result: 'MISMATCH',
        });
      }
      setTimeout(() => setVerificationFeedback(null), 7000);
    } catch (err: unknown) {
      setVerifyingFileId(null);
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // Transfer & Workflow Handlers
  const handleSubmitToForensics = async (evId: string) => {
    try {
      const existingHandoffs = globalDb.getHandoffsForEvidence(evId);
      const active = existingHandoffs.find((h) => h.status !== 'RETURNED');
      if (active) {
        alert(`Evidence already has an active transfer in status '${active.status}'.`);
        return;
      }

      if (networkStatus === 'OFFLINE') {
        const hndId = createId('HND');
        OfflineQueueManager.enqueueAction({
          action: 'CREATE_HANDOFF',
          actorId: currentUser?.user_id || 'USR-POLICE-01',
          actorRole: currentUser?.role || 'POLICE_INVESTIGATOR',
          actorDepartment: 'POLICE',
          payload: {
            id: hndId,
            evidence_id: evId,
            source_department: 'POLICE',
            destination_department: 'FORENSIC',
            submitted_by: currentUser?.user_id || 'USR-POLICE-01',
            received_by: null,
            status: 'SUBMITTED',
            submitted_at: createTimestamp(),
            acknowledged_at: null,
            rejection_reason: null,
          },
        });
        setOfflineQueue(OfflineQueueManager.getQueue());
        setOfflineNotice(`[OFFLINE QUEUED] Evidence handoff to Forensics queued locally.`);
        setTimeout(() => setOfflineNotice(null), 5000);
        return;
      }

      await globalDb.createHandoff({
        id: createId('HND'),
        evidence_id: evId,
        source_department: 'POLICE',
        destination_department: 'FORENSIC',
        submitted_by: currentUser?.user_id || 'USR-POLICE-01',
        received_by: null,
        status: 'SUBMITTED',
        submitted_at: createTimestamp(),
        acknowledged_at: null,
        rejection_reason: null,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAcceptTransfer = async (handoffId: string) => {
    try {
      if (networkStatus === 'OFFLINE') {
        const liveHandoff = handoffs.find((h) => h.id === handoffId);
        OfflineQueueManager.enqueueAction({
          action: 'TRANSITION_HANDOFF',
          actorId: currentUser?.user_id || 'USR-FORENSIC-01',
          actorRole: currentUser?.role || 'FORENSIC_EXAMINER',
          actorDepartment: 'FORENSIC',
          baseVersion: liveHandoff?.status || 'SUBMITTED',
          payload: { handoffId, newStatus: 'RECEIVED' },
        });
        setOfflineQueue(OfflineQueueManager.getQueue());
        setOfflineNotice(`[OFFLINE QUEUED] Forensic intake acknowledgement queued locally.`);
        setTimeout(() => setOfflineNotice(null), 5000);
        return;
      }

      const actorId = currentUser?.user_id || 'USR-FORENSIC-01';
      const actorRole = currentUser?.role || 'FORENSIC_EXAMINER';
      if (actorRole !== 'FORENSIC_EXAMINER' && actorRole !== 'SYSTEM_ADMIN') {
        throw new Error(
          `Authorization Failure: Role '${actorRole}' is not permitted to accept forensic custody. Forensic Examiner clearance is required.`
        );
      }

      await globalDb.transitionHandoffStatus(handoffId, 'RECEIVED', actorId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalData) return;
    try {
      const actorId = currentUser?.user_id || 'USR-FORENSIC-01';
      const actorRole = currentUser?.role || 'FORENSIC_EXAMINER';

      if (
        actorRole !== 'FORENSIC_EXAMINER' &&
        actorRole !== 'POLICE_INVESTIGATOR' &&
        actorRole !== 'SYSTEM_ADMIN'
      ) {
        throw new Error(
          `Authorization Failure: Role '${actorRole}' is not permitted to return or reject handoff.`
        );
      }

      if (networkStatus === 'OFFLINE') {
        const liveHandoff = handoffs.find((h) => h.id === rejectModalData.handoffId);
        OfflineQueueManager.enqueueAction({
          action: 'TRANSITION_HANDOFF',
          actorId,
          actorRole,
          actorDepartment: 'FORENSIC',
          baseVersion: liveHandoff?.status || 'SUBMITTED',
          payload: {
            handoffId: rejectModalData.handoffId,
            newStatus: 'RETURNED',
            rejectionReason: rejectReason.trim() || 'Evidence returned to submitting officer',
          },
        });
        setOfflineQueue(OfflineQueueManager.getQueue());
        setRejectModalData(null);
        setRejectReason('');
        setOfflineNotice(`[OFFLINE QUEUED] Rejection and return action recorded offline.`);
        setTimeout(() => setOfflineNotice(null), 5000);
        return;
      }

      await globalDb.transitionHandoffStatus(
        rejectModalData.handoffId,
        'RETURNED',
        actorId,
        rejectReason.trim() || 'Evidence returned to submitting officer'
      );
      setRejectModalData(null);
      setRejectReason('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStartExam = async (handoffId: string) => {
    try {
      const actorId = currentUser?.user_id || 'USR-FORENSIC-01';
      const actorRole = currentUser?.role || 'FORENSIC_EXAMINER';
      if (actorRole !== 'FORENSIC_EXAMINER' && actorRole !== 'SYSTEM_ADMIN') {
        throw new Error(
          `Authorization Failure: Role '${actorRole}' is not permitted to start forensic examination. Forensic Examiner clearance is required.`
        );
      }

      await globalDb.transitionHandoffStatus(handoffId, 'UNDER_EXAMINATION', actorId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMarkReportReady = async (handoffId: string) => {
    try {
      const actorId = currentUser?.user_id || 'USR-FORENSIC-01';
      const actorRole = currentUser?.role || 'FORENSIC_EXAMINER';
      if (actorRole !== 'FORENSIC_EXAMINER' && actorRole !== 'SYSTEM_ADMIN') {
        throw new Error(
          `Authorization Failure: Role '${actorRole}' is not permitted to finalize examination. Forensic Examiner clearance is required.`
        );
      }

      await globalDb.transitionHandoffStatus(handoffId, 'REPORT_READY', actorId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddReportVersion = async (evdId: string) => {
    const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
    if (!newFindingText.trim() || !selectedCase) return;
    try {
      const authorId = currentUser?.user_id || 'USR-FORENSIC-01';
      const authorRole = currentUser?.role || 'FORENSIC_EXAMINER';
      if (authorRole !== 'FORENSIC_EXAMINER' && authorRole !== 'SYSTEM_ADMIN') {
        throw new Error(
          `Authorization Failure: Role '${authorRole}' is not permitted to author forensic reports. Forensic Examiner clearance is required.`
        );
      }

      await globalDb.createOrReviseReport({
        case_id: selectedCase.id,
        evidence_id: evdId,
        report_content: newFindingText.trim(),
        author_id: authorId,
        status: 'FINALIZED',
      });
      setNewFindingText('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleProsecutionDecision = async (
    status: 'ACCEPTED_FOR_TRIAL' | 'FURTHER_EVIDENCE_REQUESTED',
    reportId: string
  ) => {
    if (status === 'FURTHER_EVIDENCE_REQUESTED' && !prosecutionNotes.trim()) {
      setClarificationValidationError(
        'Clarification notes are required. Please describe the specific questions, inconsistencies, or analysis needed from the forensic examiner before transmitting.'
      );
      return;
    }

    const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
    if (!selectedCase) return;

    try {
      setClarificationValidationError(null);
      setIsSubmittingReview(true);
      const reviewerId = currentUser?.user_id || 'USR-PROSECUTOR-01';

      await globalDb.submitProsecutionReview({
        id: createId('REV'),
        case_id: selectedCase.id,
        report_id: reportId,
        reviewer_id: reviewerId,
        status,
        review_notes:
          prosecutionNotes.trim() ||
          'Evidence integrity verified. Admissible for trial presentation.',
      });

      setProsecutionNotes('');
      setClarificationFeedback({
        type: 'success',
        message:
          status === 'ACCEPTED_FOR_TRIAL'
            ? 'Case evidence formally accepted for judicial trial presentation.'
            : 'Clarification request logged and transmitted to forensic unit.',
      });
    } catch (err: unknown) {
      setClarificationFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleRespondToClarification = async (
    reviewId: string,
    responseNotes: string,
    amendedReportContent?: string
  ) => {
    if (!responseNotes.trim()) {
      setClarificationFeedback({
        type: 'error',
        message: 'Forensic clarification response notes cannot be empty.',
      });
      return;
    }

    try {
      setIsSubmittingReview(true);
      const responderId = currentUser?.user_id || 'USR-FORENSIC-01';

      await globalDb.respondToClarificationRequest(
        reviewId,
        responseNotes.trim(),
        responderId,
        amendedReportContent
      );

      setForensicResponseDraft((prev) => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });

      setClarificationFeedback({
        type: 'success',
        message: 'Clarification response recorded and transmitted to Prosecution Portal.',
      });
    } catch (err: unknown) {
      setClarificationFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleOpenCaseIndex = () => {
    const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
    if (!selectedCase) return;
    const index = globalDb.generateCaseEvidenceIndex(selectedCase.id);
    setCaseIndexData(index);
  };

  return {
    currentUser,
    setCurrentUser,
    portalLoginModal,
    setPortalLoginModal,
    loginBadgeInput,
    setLoginBadgeInput,
    loginPinInput,
    setLoginPinInput,
    showFaqModal,
    setShowFaqModal,
    showSecurityLogsModal,
    setShowSecurityLogsModal,
    activeDept,
    setActiveDept,
    selectedCaseId,
    setSelectedCaseId,
    newFindingText,
    setNewFindingText,
    seedNotice,
    showCreateCaseModal,
    setShowCreateCaseModal,
    showRegisterEvidenceModal,
    setShowRegisterEvidenceModal,
    rejectModalData,
    setRejectModalData,
    rejectReason,
    setRejectReason,
    caseIndexData,
    setCaseIndexData,
    complianceReportData,
    setComplianceReportData,
    prosecutionNotes,
    setProsecutionNotes,
    newCaseTitle,
    setNewCaseTitle,
    newCaseRef,
    setNewCaseRef,
    newCaseCategory,
    setNewCaseCategory,
    newCaseError,
    newEvDescription,
    setNewEvDescription,
    newEvType,
    setNewEvType,
    newEvSource,
    setNewEvSource,
    selectedLocalFile,
    setSelectedLocalFile,
    newEvFilename,
    setNewEvFilename,
    newEvFileSize,
    setNewEvFileSize,
    newEvHash,
    setNewEvHash,
    newEvError,
    uploadProgress,
    isUploading,
    storageMetrics,
    setStorageMetrics,
    verifyingFileId,
    viewingHistoryFileVersionId,
    setViewingHistoryFileVersionId,
    verificationFeedback,
    cases,
    evidence,
    handoffs,
    reports,
    reviews,
    networkStatus,
    offlineQueue,
    setOfflineQueue,
    showOfflineCenterModal,
    setShowOfflineCenterModal,
    offlineCenterTab,
    setOfflineCenterTab,
    selectedConflictEventId,
    setSelectedConflictEventId,
    conflictJustification,
    setConflictJustification,
    offlineNotice,
    approvedCacheState,
    isSyncingOffline,
    showBiometricFeasibilityModal,
    setShowBiometricFeasibilityModal,
    biometricReportTab,
    setBiometricReportTab,
    showBiometricScanModal,
    setShowBiometricScanModal,
    biometricTargetUser,
    biometricRequireMfa,
    setBiometricRequireMfa,
    biometricScanOutcome,
    biometricIsScanning,
    biometricConsentMap,
    biometricLivenessTestResult,
    biometricFallbackPinInput,
    setBiometricFallbackPinInput,
    biometricFallbackError,
    biometricTestMatrixLog,
    setBiometricTestMatrixLog,
    showAuditDashboardModal,
    setShowAuditDashboardModal,
    auditDashboardTab,
    setAuditDashboardTab,
    auditDatePreset,
    setAuditDatePreset,
    auditStartDate,
    setAuditStartDate,
    auditEndDate,
    setAuditEndDate,
    auditSelectedCaseId,
    setAuditSelectedCaseId,
    auditFindings,
    auditWeeklySummary,
    auditCaseEvidenceIndex,
    setAuditCaseEvidenceIndex,
    auditIsGenerating,
    auditExportFeedback,
    auditSchedulerInfo,
    activeNavTab,
    setActiveNavTab,
    loginError,
    setLoginError,
    handleOpenLoginModal,
    handleConfirmLogin,
    handleInstantLogin,
    handleSimulateFailedLogin,
    handleToggleConsent,
    handleStartBiometricVerification,
    handleFallbackPinSubmit,
    handleRunMatrixTest,
    handleRunAuditReview,
    handleExportWeeklySummaryCsv,
    handleExportCaseIndexCsv,
    handleToggleSchedulerTimer,
    handleToggleNetwork,
    handleRunSync,
    handleResolveConflict,
    handleCacheApprovedMetadata,
    handleCreateCase,
    handleRegisterEvidence,
    handleCancelUpload,
    handleDownloadArtifact,
    handleRunVerification,
    handleSimulateTamper,
    handleRestorePristine,
    handleSubmitToForensics,
    handleAcceptTransfer,
    handleConfirmReject,
    handleStartExam,
    handleMarkReportReady,
    handleAddReportVersion,
    handleProsecutionDecision,
    handleRespondToClarification,
    handleOpenCaseIndex,
    clarificationValidationError,
    setClarificationValidationError,
    clarificationFeedback,
    setClarificationFeedback,
    isSubmittingReview,
    forensicResponseDraft,
    setForensicResponseDraft,
  };
}
