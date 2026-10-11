import './App.css';
import { globalDb } from './data/db.ts';
import { globalStorageEngine } from './utils/storage.ts';
import { useVaultOperations } from './hooks/useVaultOperations.ts';
import { AdminPortalDashboard } from './components/AdminPortalDashboard.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { WorkspaceHeader } from './components/WorkspaceHeader.tsx';
import { EvidenceWorkspace } from './components/EvidenceWorkspace.tsx';
import { CreateCaseModal } from './components/modals/CreateCaseModal.tsx';
import { RegisterEvidenceModal } from './components/modals/RegisterEvidenceModal.tsx';
import { RejectTransferModal } from './components/modals/RejectTransferModal.tsx';
import { CaseEvidenceIndexModal } from './components/modals/CaseEvidenceIndexModal.tsx';
import { ComplianceAuditReportModal } from './components/modals/ComplianceAuditReportModal.tsx';
import { VerificationAuditHistoryModal } from './components/modals/VerificationAuditHistoryModal.tsx';
import { SecurityViolationLogsModal } from './components/modals/SecurityViolationLogsModal.tsx';
import { OfflineSyncCenterModal } from './components/modals/OfflineSyncCenterModal.tsx';
import { BiometricScanModal } from './components/modals/BiometricScanModal.tsx';
import { BiometricFeasibilityModal } from './components/modals/BiometricFeasibilityModal.tsx';
import { WeeklyAuditDashboardModal } from './components/modals/WeeklyAuditDashboardModal.tsx';
import type { AuthenticatedSession } from './types.ts';
import { DEPARTMENT_PRESETS } from './types.ts';

export { DEPARTMENT_PRESETS };
export type { AuthenticatedSession };

export default function App() {
  const v = useVaultOperations();

  // If no user is logged in, show institutional 3-Portal Landing Page
  if (!v.currentUser) {
    return (
      <LandingPage
        onOpenLoginModal={v.handleOpenLoginModal}
        portalLoginModal={v.portalLoginModal}
        onCloseLoginModal={() => v.setPortalLoginModal(null)}
        loginBadgeInput={v.loginBadgeInput}
        setLoginBadgeInput={v.setLoginBadgeInput}
        loginPinInput={v.loginPinInput}
        setLoginPinInput={v.setLoginPinInput}
        biometricRequireMfa={v.biometricRequireMfa}
        setBiometricRequireMfa={v.setBiometricRequireMfa}
        handleConfirmLogin={v.handleConfirmLogin}
        handleSimulateFailedLogin={v.handleSimulateFailedLogin}
        onInstantLogin={(dept) => {
          const session = DEPARTMENT_PRESETS[dept];
          v.setCurrentUser(session);
          v.setActiveDept(dept);
          v.setPortalLoginModal(null);
        }}
        onOpenAdmin={() => {
          v.setCurrentUser(DEPARTMENT_PRESETS.ADMINISTRATION);
          v.setActiveDept('ADMINISTRATION');
        }}
        showFaqModal={v.showFaqModal}
        setShowFaqModal={v.setShowFaqModal}
      />
    );
  }

  // SYSTEM_ADMIN in ADMINISTRATION department gets dedicated Admin Dashboard
  if (v.currentUser.role === 'SYSTEM_ADMIN' && v.activeDept === 'ADMINISTRATION') {
    return (
      <AdminPortalDashboard
        currentUser={v.currentUser}
        globalDb={globalDb}
        globalStorageEngine={globalStorageEngine}
        cases={v.cases}
        evidence={v.evidence}
        handoffs={v.handoffs}
        reports={v.reports}
        reviews={v.reviews}
        onLogout={() => v.setCurrentUser(null)}
        onSwitchDepartment={(dept) => {
          v.setCurrentUser(DEPARTMENT_PRESETS[dept]);
          v.setActiveDept(dept);
        }}
      />
    );
  }

  // Active Department Logged-in Interface
  return (
    <div className="ev-app">
      <WorkspaceHeader
        currentUser={v.currentUser}
        networkStatus={v.networkStatus}
        offlineQueue={v.offlineQueue}
        onOpenOfflineCenter={() => v.setShowOfflineCenterModal(true)}
        onToggleNetwork={v.handleToggleNetwork}
        onOpenAdmin={() => {
          v.setCurrentUser(DEPARTMENT_PRESETS.ADMINISTRATION);
          v.setActiveDept('ADMINISTRATION');
        }}
        onLogout={() => v.setCurrentUser(null)}
        caseCount={v.cases.length}
        evidenceCount={v.evidence.length}
        offlineNotice={v.offlineNotice}
        seedNotice={v.seedNotice}
        verificationFeedback={v.verificationFeedback}
        activeDept={v.activeDept}
        setActiveDept={v.setActiveDept}
        onSwitchUser={(session) => {
          v.setCurrentUser(session);
          v.setActiveDept(session.department);
        }}
      />

      <EvidenceWorkspace
        activeDept={v.activeDept}
        currentUser={v.currentUser}
        cases={v.cases}
        evidence={v.evidence}
        handoffs={v.handoffs}
        reports={v.reports}
        reviews={v.reviews}
        selectedCaseId={v.selectedCaseId}
        setSelectedCaseId={v.setSelectedCaseId}
        offlineQueue={v.offlineQueue}
        storageMetrics={v.storageMetrics}
        setStorageMetrics={v.setStorageMetrics}
        onOpenCreateCaseModal={() => v.setShowCreateCaseModal(true)}
        onOpenRegisterEvidenceModal={() => v.setShowRegisterEvidenceModal(true)}
        onOpenCaseIndex={v.handleOpenCaseIndex}
        onOpenOfflineCenter={() => v.setShowOfflineCenterModal(true)}
        verifyingFileId={v.verifyingFileId}
        onRunVerification={v.handleRunVerification}
        onSimulateTamper={v.handleSimulateTamper}
        onRestorePristine={v.handleRestorePristine}
        onViewHistory={(id) => v.setViewingHistoryFileVersionId(id)}
        onDownloadArtifact={v.handleDownloadArtifact}
        onSubmitToForensics={v.handleSubmitToForensics}
        onAcceptTransfer={v.handleAcceptTransfer}
        onRejectTransfer={(data) => v.setRejectModalData(data)}
        onStartExam={v.handleStartExam}
        onMarkReportReady={v.handleMarkReportReady}
        newFindingText={v.newFindingText}
        setNewFindingText={v.setNewFindingText}
        onAddReportVersion={v.handleAddReportVersion}
        prosecutionNotes={v.prosecutionNotes}
        setProsecutionNotes={v.setProsecutionNotes}
        onProsecutionDecision={v.handleProsecutionDecision}
        onSwitchToAdmin={() => {
          v.setCurrentUser(DEPARTMENT_PRESETS.ADMINISTRATION);
          v.setActiveDept('ADMINISTRATION');
        }}
        onReturnToDept={(dept) => v.setActiveDept(dept)}
        onSwitchUser={(session) => {
          v.setCurrentUser(session);
          v.setActiveDept(session.department);
        }}
      />

      {/* Modals */}
      <CreateCaseModal
        isOpen={v.showCreateCaseModal}
        onClose={() => v.setShowCreateCaseModal(false)}
        onSubmit={v.handleCreateCase}
        title={v.newCaseTitle}
        setTitle={v.setNewCaseTitle}
        caseRef={v.newCaseRef}
        setCaseRef={v.setNewCaseRef}
        category={v.newCaseCategory}
        setCategory={v.setNewCaseCategory}
        error={v.newCaseError}
      />

      <RegisterEvidenceModal
        isOpen={v.showRegisterEvidenceModal}
        onClose={() => v.setShowRegisterEvidenceModal(false)}
        onSubmit={v.handleRegisterEvidence}
        isUploading={v.isUploading}
        uploadProgress={v.uploadProgress}
        onCancelUpload={v.handleCancelUpload}
        newEvDescription={v.newEvDescription}
        setNewEvDescription={v.setNewEvDescription}
        newEvType={v.newEvType}
        setNewEvType={v.setNewEvType}
        newEvSource={v.newEvSource}
        setNewEvSource={v.setNewEvSource}
        selectedLocalFile={v.selectedLocalFile}
        setSelectedLocalFile={v.setSelectedLocalFile}
        newEvFilename={v.newEvFilename}
        setNewEvFilename={v.setNewEvFilename}
        newEvFileSize={v.newEvFileSize}
        setNewEvFileSize={v.setNewEvFileSize}
        error={v.newEvError}
      />

      <RejectTransferModal
        rejectModalData={v.rejectModalData}
        onClose={() => v.setRejectModalData(null)}
        rejectReason={v.rejectReason}
        setRejectReason={v.setRejectReason}
        onConfirmReject={v.handleConfirmReject}
      />

      <CaseEvidenceIndexModal
        caseIndexData={v.caseIndexData}
        onClose={() => v.setCaseIndexData(null)}
      />

      <ComplianceAuditReportModal
        complianceReportData={v.complianceReportData}
        onClose={() => v.setComplianceReportData(null)}
      />

      <VerificationAuditHistoryModal
        fileVersionId={v.viewingHistoryFileVersionId}
        onClose={() => v.setViewingHistoryFileVersionId(null)}
      />

      <SecurityViolationLogsModal
        isOpen={v.showSecurityLogsModal}
        onClose={() => v.setShowSecurityLogsModal(false)}
      />

      <OfflineSyncCenterModal
        isOpen={v.showOfflineCenterModal}
        onClose={() => v.setShowOfflineCenterModal(false)}
        networkStatus={v.networkStatus}
        onToggleNetwork={v.handleToggleNetwork}
        isSyncingOffline={v.isSyncingOffline}
        onRunSync={v.handleRunSync}
        offlineCenterTab={v.offlineCenterTab}
        setOfflineCenterTab={v.setOfflineCenterTab}
        offlineQueue={v.offlineQueue}
        setOfflineQueue={v.setOfflineQueue}
        selectedConflictEventId={v.selectedConflictEventId}
        setSelectedConflictEventId={v.setSelectedConflictEventId}
        conflictJustification={v.conflictJustification}
        setConflictJustification={v.setConflictJustification}
        onResolveConflict={v.handleResolveConflict}
        approvedCacheState={v.approvedCacheState}
        onCacheApprovedMetadata={v.handleCacheApprovedMetadata}
      />

      <BiometricScanModal
        isOpen={v.showBiometricScanModal}
        onClose={() => v.setShowBiometricScanModal(false)}
        targetUser={v.biometricTargetUser}
        consentMap={v.biometricConsentMap}
        onToggleConsent={v.handleToggleConsent}
        scanOutcome={v.biometricScanOutcome}
        isScanning={v.biometricIsScanning}
        livenessTestResult={v.biometricLivenessTestResult}
        onStartVerification={v.handleStartBiometricVerification}
        fallbackPinInput={v.biometricFallbackPinInput}
        setFallbackPinInput={v.setBiometricFallbackPinInput}
        fallbackError={v.biometricFallbackError}
        onFallbackPinSubmit={v.handleFallbackPinSubmit}
        onProceedToWorkspace={(user) => {
          v.setCurrentUser(user);
          v.setActiveDept(user.department);
          v.setShowBiometricScanModal(false);
        }}
      />

      <BiometricFeasibilityModal
        isOpen={v.showBiometricFeasibilityModal}
        onClose={() => v.setShowBiometricFeasibilityModal(false)}
        biometricReportTab={v.biometricReportTab}
        setBiometricReportTab={v.setBiometricReportTab}
        onRunMatrixTest={v.handleRunMatrixTest}
        biometricTestMatrixLog={v.biometricTestMatrixLog}
        setBiometricTestMatrixLog={v.setBiometricTestMatrixLog}
      />

      <WeeklyAuditDashboardModal
        isOpen={v.showAuditDashboardModal}
        onClose={() => v.setShowAuditDashboardModal(false)}
        auditDashboardTab={v.auditDashboardTab}
        setAuditDashboardTab={v.setAuditDashboardTab}
        auditDatePreset={v.auditDatePreset}
        setAuditDatePreset={v.setAuditDatePreset}
        auditStartDate={v.auditStartDate}
        setAuditStartDate={v.setAuditStartDate}
        auditEndDate={v.auditEndDate}
        setAuditEndDate={v.setAuditEndDate}
        auditSelectedCaseId={v.auditSelectedCaseId}
        setAuditSelectedCaseId={v.setAuditSelectedCaseId}
        cases={v.cases}
        auditFindings={v.auditFindings}
        auditWeeklySummary={v.auditWeeklySummary}
        auditCaseEvidenceIndex={v.auditCaseEvidenceIndex}
        setAuditCaseEvidenceIndex={v.setAuditCaseEvidenceIndex}
        auditIsGenerating={v.auditIsGenerating}
        auditExportFeedback={v.auditExportFeedback}
        auditSchedulerInfo={v.auditSchedulerInfo}
        currentUserId={v.currentUser?.user_id}
        currentUserRole={v.currentUser?.role}
        onRunAuditReview={v.handleRunAuditReview}
        onExportWeeklySummaryCsv={v.handleExportWeeklySummaryCsv}
        onExportCaseIndexCsv={v.handleExportCaseIndexCsv}
        onToggleSchedulerTimer={v.handleToggleSchedulerTimer}
      />
    </div>
  );
}
