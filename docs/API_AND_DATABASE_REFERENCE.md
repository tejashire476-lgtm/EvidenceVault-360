# EvidenceVault 360 — API & Database Schema Reference

**Database Architecture:** Relational Emulation + Dexie IndexedDB (`EvidenceVaultDatabase`)  
**Storage Architecture:** Cloudflare R2 / S3 Virtual Object Storage Engine (`SecureEvidenceStorageEngine`)  
**Data Integrity:** Foreign Key Constraints, Unique Indexes, State Transition Validation, Chained Hashes  

---

## 1. Database Entity Schemas

### 1.1 `Case`
Primary entity representing a formal criminal or cyber forensic investigation.
- `id: string` (Primary Key, e.g., `'CASE-EV-2026-001'`)
- `case_reference: string` (Unique constraint, e.g., `'EV-CASE-2026-001'`)
- `title: string` (Descriptive case title)
- `category: string` (e.g., `'Cyber Forensics'`, `'Financial Fraud'`)
- `incident_date: string | null` (ISO 8601 date string)
- `assigned_officer_id: string | null` (Foreign Key -> `User.id`)
- `status: CaseStatus` (`'OPEN' | 'UNDER_INVESTIGATION' | 'PENDING_FORENSICS' | 'PROSECUTION_REVIEW' | 'SEALED' | 'ARCHIVED'`)
- `created_by: string` (Foreign Key -> `User.id`)
- `created_at: string` (ISO 8601 timestamp)
- `updated_at: string` (ISO 8601 timestamp)

### 1.2 `EvidenceRecord`
Item seized or ingested under a specific case.
- `id: string` (Primary Key, e.g., `'EVD-001'`)
- `case_id: string` (Foreign Key -> `Case.id`)
- `description: string` (Evidence item details)
- `evidence_type: EvidenceType` (`'DISK_IMAGE' | 'NETWORK_CAPTURE' | 'MEMORY_DUMP' | 'SYSTEM_LOG' | 'MOBILE_EXTRACTION' | 'DATABASE_DUMP' | 'DOCUMENT' | 'MEDIA'`)
- `source_description: string` (Location / seizure hardware source)
- `collected_by: string` (Foreign Key -> `User.id`)
- `collected_at: string` (ISO 8601 timestamp)
- `current_status: EvidenceWorkflowStatus` (`'ACQUIRED' | 'SUBMITTED_TO_FORENSICS' | 'IN_FORENSIC_CUSTODY' | 'EXAMINED' | 'PROSECUTION_READY' | 'JUDICIAL_SEALED'`)
- `created_by: string` (Foreign Key -> `User.id`)
- `created_at: string` (ISO 8601 timestamp)

### 1.3 `EvidenceFileVersion`
Specific binary file version and cryptographic hash manifest for an evidence item.
- `id: string` (Primary Key, e.g., `'FILE-001'`)
- `evidence_id: string` (Foreign Key -> `EvidenceRecord.id`)
- `original_filename: string` (Original file name, e.g., `'surveillance_cctv.png'`)
- `generated_storage_key: string` (Canonical storage path in object storage)
- `content_type: string` (Canonical MIME type, e.g., `'image/png'`)
- `file_size: number` (Exact byte size)
- `sha256_hash: string` (64-character lowercase hex digest)
- `baseline_created_at: string` (ISO 8601 timestamp)
- `uploaded_by: string` (Foreign Key -> `User.id`)
- `created_at: string` (ISO 8601 timestamp)

### 1.4 `EvidenceHandoff`
Custodial transfer record between departments.
- `id: string` (Primary Key, e.g., `'HOF-001'`)
- `evidence_id: string` (Foreign Key -> `EvidenceRecord.id`)
- `from_user_id: string` (Foreign Key -> `User.id`)
- `from_department: Department` (`'POLICE' | 'FORENSIC' | 'PROSECUTION'`)
- `to_department: Department`
- `to_user_id: string | null`
- `status: HandoffStatus` (`'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'`)
- `initiated_at: string` (ISO 8601 timestamp)
- `resolved_at: string | null`
- `notes: string`
- `rejection_reason: string | null`

### 1.5 `AuditEvent` (Chained Ledger Block)
Tamper-evident linked ledger block.
- `id: string` (Primary Key, e.g., `'AUDIT-001'`)
- `sequence_number: number` (Monotonically increasing block index)
- `previous_block_hash: string` (SHA-256 of block $n-1$, or 64 zeroes for genesis block)
- `block_hash: string` (SHA-256 over entire block contents)
- `timestamp: string` (ISO 8601 timestamp)
- `actor_id: string | null` (User executing action)
- `actor_role: UserRole`
- `department: Department`
- `action: string` (e.g., `'ADD_FILE_VERSION'`, `'ACCEPT_HANDOFF'`)
- `entity_type: string` (e.g., `'EvidenceFileVersion'`)
- `entity_id: string`
- `payload: Record<string, unknown>`
- `ip_address: string`
- `user_agent: string`
- `status: 'SUCCESS' | 'FAILURE'`
- `reason: string | null`

---

## 2. Secure Object Storage Key Format

Every evidence file is isolated within a deterministic canonical path to prevent path traversal:
```text
cases/{safeCaseId}/evidence/{safeEvidenceId}/{versionId}/{safeFilename}
```
**Example:**
```text
cases/CASE-EV-2026-001/evidence/EVD-001/v1/atm_frame_04.png
```

Sanitization rules applied by `sanitizePathSegment`:
1. Null bytes (`\0`) are stripped.
2. `../` and `..\` traversal sequences are eliminated.
3. Slashes (`/` and `\`) are converted to safe hyphens (`-`).
4. Non-alphanumeric characters (excluding `.` and `_`) are replaced with `_`.
5. Segments truncated to 120 characters maximum.

---

## 3. Storage Engine API Interface

```typescript
export class SecureEvidenceStorageEngine {
  // Initiates resumable multipart ingestion session
  public initiateMultipartUpload(params: {
    caseId: string;
    evidenceId: string;
    versionId: string;
    originalFilename: string;
    contentType: string;
    totalSizeBytes: number;
    evidenceType: EvidenceType;
    uploadedBy: string;
    expectedSha256?: string;
  }): MultipartUploadSession;

  // Uploads single binary chunk with onProgress callback
  public async uploadPart(
    uploadId: string,
    partNumber: number,
    chunkData: Uint8Array,
    onProgress?: (progress: UploadProgressEvent) => void
  ): Promise<MultipartUploadPart>;

  // Aborts session and purges partial chunks
  public abortMultipartUpload(uploadId: string): void;

  // Validates backend signatures, checks SHA-256 parity, and commits to store
  public async completeMultipartUpload(
    uploadId: string,
    combinedBuffer: Uint8Array
  ): Promise<{ storageKey: string; sha256: string; totalBytes: number }>;

  // Retrieves object via authorized ephemeral signed URL
  public async getObjectBySignedUrl(
    signedUrl: string,
    actorRole: UserRole
  ): Promise<{ data: Uint8Array; contentType: string }>;

  // Memory-safe chunked stream retrieval for multi-GB disk images
  public async *getObjectStream(
    storageKey: string,
    chunkSize?: number
  ): AsyncIterable<Uint8Array>;

  // Live demonstration tamper injection hook
  public tamperObject(
    storageKey: string,
    byteIndex?: number
  ): { originalByte: number; tamperedByte: number; storageKey: string };
}
```
