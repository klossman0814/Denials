# Data Dictionary — Denials Project

> Complete mapping of every database field to its EDI 837/835 segment source.
> Last updated: July 28, 2026

---

## Tables

- [Claims](#1-claims)
- [Claim Lines](#2-claim-lines)
- [Claim Diagnoses](#3-claim-diagnoses)
- [Claim References](#4-claim-references)
- [Claim Amounts](#5-claim-amounts)
- [Claim Conditions](#6-claim-conditions)
- [Claim Report Types](#7-claim-report-types)
- [Claim File Infos](#8-claim-file-infos)
- [Claim Tooth Infos](#9-claim-tooth-infos)
- [Uploaded Files](#10-uploaded-files)
- [Users](#11-users)
- [Settings](#12-settings)
- [Remittance Files](#13-remittance-files)
- [Remittances](#14-remittances)
- [Remittance Lines](#15-remittance-lines)
- [Remittance References](#16-remittance-references)
- [Remittance Amounts](#17-remittance-amounts)
- [Remittance Inpatients](#18-remittance-inpatients)
- [Remittance Outpatients](#19-remittance-outpatients)
- [Provider Adjustments](#20-provider-adjustments)
- [Denial Reasons](#21-denial-reasons)

---

### 1. Claims

**Table:** `claims`  
**Source:** 837 Professional / Institutional  
**Stores:** Submitted claim data from the provider

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `claim_id` | VARCHAR(50) | CLM01 | Claim identifier assigned by provider/payer |
| `patient_last_name` | VARCHAR(100) | NM1\*QC-03 / NM1\*IL-03 | Patient or subscriber last name |
| `patient_first_name` | VARCHAR(100) | NM1\*QC-04 / NM1\*IL-04 | Patient or subscriber first name |
| `patient_middle_initial` | VARCHAR(50) | NM1\*QC-05 / NM1\*IL-05 | Patient middle name or initial |
| `patient_suffix` | VARCHAR(20) | NM1\*QC-07 / NM1\*IL-07 | Patient name suffix (e.g. JR, SR, III) |
| `patient_dob` | DATE | DMG02 | Patient date of birth |
| `patient_gender` | VARCHAR(10) | DMG03 | Patient gender (M, F, U) |
| `patient_member_id` | VARCHAR(100) | NM1\*QC-09 | Patient insurance member ID number |
| `patient_relationship_code` | VARCHAR(5) | PAT01 | Patient relationship to subscriber (code) |
| `patient_address1` | VARCHAR(200) | N3/N4 under patient HL | Patient street address |
| `patient_address2` | VARCHAR(200) | N3/N4 under patient HL | Patient address line 2 |
| `patient_city` | VARCHAR(100) | N3/N4 under patient HL | Patient city |
| `patient_state` | VARCHAR(50) | N3/N4 under patient HL | Patient state |
| `patient_zip` | VARCHAR(20) | N3/N4 under patient HL | Patient ZIP code |
| `subscriber_id` | VARCHAR(100) | NM1\*IL-09 / REF\*1L / REF\*34 | Subscriber insurance ID |
| `subscriber_first_name` | VARCHAR(100) | NM1\*IL-04 | Subscriber first name |
| `subscriber_last_name` | VARCHAR(100) | NM1\*IL-03 | Subscriber last name |
| `subscriber_middle_initial` | VARCHAR(50) | NM1\*IL-05 | Subscriber middle name or initial |
| `subscriber_suffix` | VARCHAR(20) | NM1\*IL-07 | Subscriber name suffix |
| `subscriber_group_number` | VARCHAR(100) | REF\*6P / REF\*EJ | Employer group or benefit plan number |
| `subscriber_relationship_code` | VARCHAR(5) | SBR02 | Subscriber relationship code |
| `payer_name` | VARCHAR(200) | NM1\*PR-03 + NM1\*PR-04 | Payer organization name |
| `payer_id` | VARCHAR(50) | NM1\*PR-09 | Payer identifier |
| `claim_filing_type` | VARCHAR(5) | SBR09 | Claim filing type code |
| `pos_code` | VARCHAR(5) | CLM05-1 (sub-element) | Place of service code |
| `provider_name` | VARCHAR(200) | NM1\*85 (billing) | Billing provider name |
| `provider_npi` | VARCHAR(20) | NM1\*85-09 | Billing provider NPI |
| `provider_tax_id` | VARCHAR(20) | REF\*EI | Billing provider tax ID |
| `provider_address1` | VARCHAR(200) | N3/N4 under billing HL | Billing provider street address |
| `provider_address2` | VARCHAR(200) | N3/N4 under billing HL | Billing provider address line 2 |
| `provider_city` | VARCHAR(100) | N3/N4 under billing HL | Billing provider city |
| `provider_state` | VARCHAR(50) | N3/N4 under billing HL | Billing provider state |
| `provider_zip` | VARCHAR(20) | N3/N4 under billing HL | Billing provider ZIP |
| `provider_contact_name` | VARCHAR(100) | PER02 (billing) | Billing provider contact person |
| `provider_contact_phone` | VARCHAR(30) | PER (TE) | Billing provider phone number |
| `rendering_provider_name` | VARCHAR(200) | NM1\*82 | Rendering provider name |
| `rendering_provider_npi` | VARCHAR(20) | NM1\*82-09 | Rendering provider NPI |
| `referring_provider_name` | VARCHAR(200) | NM1\*DN | Referring provider name |
| `referring_provider_npi` | VARCHAR(20) | NM1\*DN-09 | Referring provider NPI |
| `attending_provider_name` | VARCHAR(200) | NM1\*71 (837I) | Attending physician name |
| `attending_provider_npi` | VARCHAR(20) | NM1\*71-09 (837I) | Attending physician NPI |
| `operating_provider_name` | VARCHAR(200) | NM1\*72 (837I) | Operating physician name |
| `operating_provider_npi` | VARCHAR(20) | NM1\*72-09 (837I) | Operating physician NPI |
| `service_facility_name` | VARCHAR(200) | NM1\*77 | Service facility location name |
| `service_facility_npi` | VARCHAR(20) | NM1\*77-09 | Service facility NPI |
| `total_charge` | DECIMAL(10,2) | CLM02 | Total claim charge amount |
| `patient_amount_paid` | DECIMAL(10,2) | AMT\*F5 | Patient paid amount |
| `service_date_start` | DATE | DTP\*434 | Date of service / admission (from) |
| `service_date_end` | DATE | DTP\*435 | Date of service / discharge (through) |
| `admission_date` | DATE | DTP\*434 | Admission date (alias) |
| `discharge_date` | DATE | DTP\*435 | Discharge date (alias) |
| `discharge_hour` | VARCHAR(10) | DTP\*096 | Discharge hour (837I) |
| `admit_type_code` | VARCHAR(5) | CL101 | Admission type code (837I) |
| `admit_source_code` | VARCHAR(5) | CL102 | Admission source code (837I) |
| `patient_status_code` | VARCHAR(5) | CL103 | Patient discharge status code (837I) |
| `drg_code` | VARCHAR(10) | HI\*DRG | DRG code (837I) |
| `drg_weight` | VARCHAR(20) | HI\*DRG sub-element | DRG weight |
| `drg_medical_surgical` | VARCHAR(5) | HI\*APX | Medical/surgical indicator |
| `contract_type` | VARCHAR(5) | CN101 | Contract type code |
| `contract_amount` | DECIMAL(10,2) | CN102 | Contract amount |
| `contract_percentage` | DECIMAL(5,2) | CN103 | Contract percentage |
| `bht_purpose` | VARCHAR(5) | BHT01 | Transaction purpose code |
| `bht_reference` | VARCHAR(50) | BHT03 | Transaction reference number |
| `bht_date` | VARCHAR(10) | BHT04 | Transaction creation date (submission date) |
| `bht_time` | VARCHAR(10) | BHT05 | Transaction creation time |
| `bht_transaction_type` | VARCHAR(5) | BHT06 | Transaction type code |
| `status` | VARCHAR(20) | — | Claim status: submitted / paid / denied / partial / replaced |
| `superseded_by_id` | UUID | — | Points to replacement claim |
| `resolved_at` | TIMESTAMP | — | When claim was resolved (set on 835 match) |
| `days_to_resolve` | INTEGER | — | Computed: 835 adj date − 837 submit date |
| `file_id` | UUID | — | FK → UploadedFile |
| `created_at` | TIMESTAMP | — | Record created timestamp |
| `updated_at` | TIMESTAMP | — | Record updated timestamp |

---

### 2. Claim Lines

**Table:** `claim_lines`  
**Source:** 837 SV1 / SV2 / SV3 + TOO  
**Stores:** Line-level procedure/service details

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `line_number` | INTEGER | LX01 or auto | Line number |
| `procedure_code` | VARCHAR(20) | SV1/SV2/SV3 sub-element | Procedure/service code |
| `modifier` | VARCHAR(20) | SV1/SV2 modifier sub-element | Procedure modifier(s) |
| `charge_amount` | DECIMAL(10,2) | SV102 / SV203 / SV302 | Line charge amount |
| `unit_count` | DECIMAL(8,2) | SV104 / SV205 / SV304 | Service unit count |
| `service_date` | DATE | DTP\*472 | Date of service |
| `revenue_code` | VARCHAR(10) | SV201 | Revenue center code |
| `procedure_type` | VARCHAR(5) | — | Parser-set: SV1, SV2, or SV3 |
| `diagnosis_code` | VARCHAR(20) | — | Legacy — not populated |
| `diagnosis_code_pointers` | TEXT | SV1/SV3 elem 7 | Diagnosis code pointer indices (JSON array) |
| `oral_cavity_code` | VARCHAR(10) | TOO01 | Oral cavity designator |
| `tooth_code` | VARCHAR(20) | TOO02 | Tooth number or code |
| `tooth_surface` | VARCHAR(10) | TOO03 | Tooth surface code |
| `claim_id` | UUID | — | FK → Claim |

---

### 3. Claim Diagnoses

**Table:** `claim_diagnoses`  
**Source:** 837 HI segment  
**Stores:** Diagnosis codes linked to the claim

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `diagnosis_type` | VARCHAR(30) | HI qualifier mapped | Type: principal / admitting / other / external_cause / patient_reason |
| `qualifier` | VARCHAR(10) | HI sub-element 0 | Code qualifier (ABK, BK, ABF, BF, etc.) |
| `code` | VARCHAR(30) | HI sub-element 1 | Diagnosis code |
| `sequence` | INTEGER | Positional | Order in HI loop |
| `claim_id` | UUID | — | FK → Claim |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 4. Claim References

**Table:** `claim_references`  
**Source:** 837 REF segment  
**Stores:** Claim-level reference information

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `qualifier` | VARCHAR(10) | REF01 | Reference qualifier code |
| `value` | VARCHAR(200) | REF02 | Reference identifier |
| `description` | VARCHAR(200) | — | Not populated |
| `claim_id` | UUID | — | FK → Claim |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 5. Claim Amounts

**Table:** `claim_amounts`  
**Source:** 837 AMT segment  
**Stores:** Claim-level monetary amounts

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `qualifier` | VARCHAR(10) | AMT01 | Amount qualifier code |
| `value` | DECIMAL(12,2) | AMT02 | Amount |
| `description` | VARCHAR(200) | — | Not populated |
| `claim_id` | UUID | — | FK → Claim |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 6. Claim Conditions

**Table:** `claim_conditions`  
**Source:** 837 CRC segment  
**Stores:** Condition codes

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `category` | VARCHAR(5) | CRC01 | Condition category (note: parser outputs `code` not `category`) |
| `qualifier` | VARCHAR(10) | CRC02 | Condition qualifier |
| `value` | VARCHAR(5) | CRC03 | Condition indicator |
| `claim_id` | UUID | — | FK → Claim |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 7. Claim Report Types

**Table:** `claim_report_types`  
**Source:** 837 PWK segment  
**Stores:** Attachment/report type information

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `code` | VARCHAR(10) | PWK01 | Report type code |
| `qualifier` | VARCHAR(5) | PWK02 | Transmission code qualifier |
| `attachment_transmission_code` | VARCHAR(5) | PWK03 | Attachment transmission code |
| `claim_id` | UUID | — | FK → Claim |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 8. Claim File Infos

**Table:** `claim_file_infos`  
**Source:** 837 K3 segment  
**Stores:** File information text

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `text` | TEXT | K301 | File information text |
| `claim_id` | UUID | — | FK → Claim |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 9. Claim Tooth Infos

**Table:** `claim_tooth_infos`  
**Source:** 837 TOO segment  
**Stores:** Dental tooth/oral cavity information

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `oral_cavity_code` | VARCHAR(10) | TOO01 | Oral cavity designator code |
| `tooth_code` | VARCHAR(20) | TOO02 | Tooth number or code |
| `tooth_surface` | VARCHAR(10) | TOO03 | Tooth surface code |
| `claim_line_id` | UUID | — | FK → ClaimLine |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 10. Uploaded Files

**Table:** `uploaded_files`  
**Source:** Application — file tracking  
**Stores:** Metadata about each EDI file imported

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `filename` | VARCHAR(255) | Original file name |
| `file_type` | VARCHAR(3) | File type: "837" or "835" |
| `file_path` | TEXT | Absolute path on disk |
| `file_size` | BIGINT | File size in bytes |
| `content_hash` | VARCHAR(64) | SHA-256 content hash (dedup) |
| `status` | VARCHAR(20) | Processing status: pending → queued → parsing → parsed / error / duplicate / replaced |
| `error_message` | TEXT | Error details if processing failed |
| `supersedes_id` | UUID | FK → UploadedFile (correction chain) |
| `correction_notes` | TEXT | Correction metadata |
| `uploaded_at` | TIMESTAMP | File upload timestamp |
| `parsed_at` | TIMESTAMP | When parsing completed |
| `uploaded_by` | UUID | FK → User |

---

### 11. Users

**Table:** `users`  
**Source:** Application — authentication  
**Stores:** System user accounts

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `username` | VARCHAR(100) | Login username |
| `email` | VARCHAR(255) | Email address |
| `password_hash` | VARCHAR(255) | bcrypt password hash |
| `role` | VARCHAR(20) | Role: "staff" or "admin" |
| `active` | BOOLEAN | Account active/inactive |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### 12. Settings

**Table:** `settings`  
**Source:** Application — key/value configuration  
**Stores:** System settings

| Column | Type | Description |
|---|---|---|
| `key` | VARCHAR(100) | Setting key (PK) |
| `value` | TEXT | Setting value |
| `updated_at` | TIMESTAMP | Last updated |

---

### 13. Remittance Files

**Table:** `remittance_files`  
**Source:** 835  
**Stores:** File-level remittance/payment data

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `total_payment` | DECIMAL(12,2) | BPR02 | Total payment amount |
| `payment_method` | VARCHAR(20) | BPR04 | Payment method code (CHK, ACH, NON) |
| `payment_date` | DATE | BPR16 / DTM\*405 | Payment/production date |
| `trace_number` | VARCHAR(50) | TRN02 | EFT trace number |
| `sender_bank_id` | VARCHAR(20) | BPR07 | Sender bank routing number |
| `sender_account` | VARCHAR(30) | BPR09 | Sender bank account number |
| `credit_debit_flag` | VARCHAR(5) | BPR03 | Credit/debit flag (C, D) |
| `payer_name` | VARCHAR(200) | N1\*PR-02 | Payer name |
| `payer_id_code` | VARCHAR(50) | N1\*PR-03:04 | Payer ID code |
| `payee_name` | VARCHAR(200) | N1\*PE-02 | Payee/provider name |
| `payee_id_code` | VARCHAR(50) | N1\*PE-03:04 | Payee ID code |
| `payee_tax_id` | VARCHAR(20) | REF\*TJ | Payee tax ID |
| `payer_address1` | VARCHAR(200) | N3 under N1\*PR | Payer street address |
| `payer_address2` | VARCHAR(200) | N3 under N1\*PR | Payer address line 2 |
| `payer_city` | VARCHAR(100) | N4 under N1\*PR | Payer city |
| `payer_state` | VARCHAR(50) | N4 under N1\*PR | Payer state |
| `payer_zip` | VARCHAR(20) | N4 under N1\*PR | Payer ZIP |
| `payer_contact_name` | VARCHAR(100) | PER under N1\*PR | Payer contact name |
| `payer_contact_phone` | VARCHAR(30) | PER under N1\*PR | Payer contact phone |
| `payer_contact_email` | VARCHAR(100) | PER under N1\*PR | Payer contact email |
| `payee_address1` | VARCHAR(200) | N3 under N1\*PE | Payee street address |
| `payee_address2` | VARCHAR(200) | N3 under N1\*PE | Payee address line 2 |
| `payee_city` | VARCHAR(100) | N4 under N1\*PE | Payee city |
| `payee_state` | VARCHAR(50) | N4 under N1\*PE | Payee state |
| `payee_zip` | VARCHAR(20) | N4 under N1\*PE | Payee ZIP |
| `payee_contact_name` | VARCHAR(100) | PER under N1\*PE | Payee contact name |
| `payee_contact_phone` | VARCHAR(30) | PER under N1\*PE | Payee contact phone |
| `payee_contact_email` | VARCHAR(100) | PER under N1\*PE | Payee contact email |
| `sender_id` | VARCHAR(50) | ISA06 | Interchange sender ID |
| `receiver_id` | VARCHAR(50) | ISA08 | Interchange receiver ID |
| `isa_date` | VARCHAR(10) | ISA09 | Interchange date |
| `isa_time` | VARCHAR(10) | ISA10 | Interchange time |
| `isa_control_number` | VARCHAR(20) | ISA13 | Interchange control number |
| `isa_standards_id` | VARCHAR(20) | ISA12 | Interchange standards ID |
| `gs_sender` | VARCHAR(50) | GS02 | Functional group sender |
| `gs_receiver` | VARCHAR(50) | GS03 | Functional group receiver |
| `gs_date` | VARCHAR(10) | GS04 | Functional group date |
| `gs_time` | VARCHAR(10) | GS05 | Functional group time |
| `gs_control_number` | VARCHAR(20) | GS06 | Functional group control number |
| `gs_version` | VARCHAR(20) | GS08 | Functional group version |
| `st_transaction_id` | VARCHAR(10) | ST01 | Transaction set ID |
| `st_control_number` | VARCHAR(20) | ST02 | Transaction set control number |
| `file_id` | UUID | — | FK → UploadedFile |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 14. Remittances

**Table:** `remittances`  
**Source:** 835  
**Stores:** Claim-level adjudication results

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `patient_name` | VARCHAR(200) | Computed | Patient first + last name |
| `payer_claim_id` | VARCHAR(100) | CLP07 / CLP01 | Payer-assigned claim ID |
| `total_charge` | DECIMAL(10,2) | CLP03 | Total claimed amount |
| `total_paid` | DECIMAL(10,2) | CLP04 | Total paid amount |
| `adjustment_amount` | DECIMAL(10,2) | CLP05 | Total adjustment amount |
| `remittance_date` | DATE | DTM\*050 | Claim-level remittance date |
| `status` | VARCHAR(20) | Derived | paid / denied / partial / pending / replaced |
| `superseded_by_id` | UUID | — | Points to replacement remittance |
| `patient_first_name` | VARCHAR(100) | NM1\*QC-04 | Patient first name |
| `patient_last_name` | VARCHAR(100) | NM1\*QC-03 | Patient last name |
| `patient_member_id` | VARCHAR(100) | NM1\*QC-09 | Patient member ID |
| `patient_dob` | DATE | DMG02 | Patient date of birth |
| `patient_gender` | VARCHAR(10) | DMG03 | Patient gender |
| `subscriber_id` | VARCHAR(100) | NM1\*IL-09 | Subscriber ID |
| `subscriber_first_name` | VARCHAR(100) | NM1\*IL-04 | Subscriber first name |
| `subscriber_last_name` | VARCHAR(100) | NM1\*IL-03 | Subscriber last name |
| `rendering_provider_name` | VARCHAR(200) | NM1\*82 | Rendering provider name |
| `rendering_provider_npi` | VARCHAR(20) | NM1\*82-09 or REF\*1C | Rendering provider NPI |
| `billing_provider_name` | VARCHAR(200) | NM1\*85 | Billing provider name |
| `billing_provider_npi` | VARCHAR(20) | NM1\*85-09 | Billing provider NPI |
| `service_date_from` | DATE | DTM\*232 | Service period start |
| `service_date_to` | DATE | DTM\*233 | Service period end |
| `claim_statement_from` | DATE | DTM\*652 | Claim statement period start |
| `claim_statement_to` | DATE | DTM\*653 | Claim statement period end |
| `claim_status_code` | VARCHAR(5) | CLP02 | Claim status code |
| `claim_filing_type` | VARCHAR(5) | CLP08 | Claim filing type code |
| `file_id` | UUID | — | FK → UploadedFile |
| `claim_id` | UUID | — | FK → Claim (matched) |
| `remittance_file_id` | UUID | — | FK → RemittanceFile |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 15. Remittance Lines

**Table:** `remittance_lines`  
**Source:** 835 SVC segment  
**Stores:** Line-level adjudication details

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `line_number` | INTEGER | Auto | Line number |
| `procedure_code` | VARCHAR(20) | SVC composite | Procedure/service code |
| `modifier` | VARCHAR(30) | SVC composite | Procedure modifier(s) |
| `charge_amount` | DECIMAL(10,2) | SVC02 | Line charge amount |
| `paid_amount` | DECIMAL(10,2) | SVC03 | Line paid amount |
| `unit_count` | DECIMAL(8,2) | SVC05 | Service unit count |
| `service_date` | DATE | DTM\*472 | Service date |
| `line_control_number` | VARCHAR(50) | REF\*6R | Line control number |
| `patient_liability` | DECIMAL(10,2) | AMT\*B6 | Patient liability amount |
| `remittance_id` | UUID | — | FK → Remittance |

---

### 16. Remittance References

**Table:** `remittance_references`  
**Source:** 835 REF segment  
**Stores:** Claim-level reference data from remittance

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `qualifier` | VARCHAR(10) | REF01 | Reference qualifier code (e.g. 1L, CE, G1) |
| `value` | VARCHAR(200) | REF02 | Reference value |
| `description` | VARCHAR(200) | Lookup | Description from REF_QUALIFIER_DESCRIPTIONS |
| `remittance_id` | UUID | — | FK → Remittance |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 17. Remittance Amounts

**Table:** `remittance_amounts`  
**Source:** 835 AMT segment  
**Stores:** Claim-level monetary amounts from remittance

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `qualifier` | VARCHAR(10) | AMT01 | Amount qualifier code (e.g. AU, B6) |
| `value` | DECIMAL(12,2) | AMT02 | Amount |
| `description` | VARCHAR(200) | Lookup | Description from AMT_QUALIFIER_DESCRIPTIONS |
| `remittance_id` | UUID | — | FK → Remittance |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 18. Remittance Inpatients

**Table:** `remittance_inpatients`  
**Source:** 835 MIA segment  
**Stores:** Inpatient adjudication information

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `covered_days` | INTEGER | MIA01 | Covered days count |
| `pps_code` | VARCHAR(10) | MIA02 | PPS code |
| `total_covered_days` | INTEGER | MIA03 | Total covered days |
| `drg` | VARCHAR(10) | MIA09 | DRG code |
| `discharge_status` | VARCHAR(20) | MIA14 | Discharge status code |
| `total_adjustment` | DECIMAL(10,2) | MIA05 | Total adjustment amount |
| `remittance_id` | UUID | — | FK → Remittance |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 19. Remittance Outpatients

**Table:** `remittance_outpatients`  
**Source:** 835 MOA segment  
**Stores:** Outpatient adjudication information

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `reimbursement` | DECIMAL(10,2) | MOA01 | Reimbursement rate |
| `remark_codes` | TEXT | MOA02-04 | Remark codes (comma-separated) |
| `remittance_id` | UUID | — | FK → Remittance |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 20. Provider Adjustments

**Table:** `provider_adjustments`  
**Source:** 835 PLB segment  
**Stores:** Provider-level adjustments (not claim-specific)

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `provider_identifier` | VARCHAR(50) | PLB01 | Provider identifier |
| `adjustment_date` | DATE | PLB02 | Adjustment date |
| `adjustment_reason_code` | VARCHAR(50) | PLB composite sub-0 | Reason code (e.g. WO, FB) |
| `adjustment_reason_subcode` | VARCHAR(50) | PLB composite sub-1 | Reason sub-code |
| `adjustment_amount` | DECIMAL(10,2) | PLB alternating | Adjustment amount |
| `reference_identification` | VARCHAR(50) | — | Not populated |
| `remittance_file_id` | UUID | — | FK → RemittanceFile |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

### 21. Denial Reasons

**Table:** `denial_reasons`  
**Source:** 835 CAS segment  
**Stores:** Claim and line-level denial/adjustment reasons

| Column | Type | EDI Source | Description |
|---|---|---|---|
| `id` | UUID | — | Primary key |
| `denial_code` | VARCHAR(10) | CAS composite | Adjustment reason code (e.g. CO-45, PR-1) |
| `group_code` | VARCHAR(5) | CAS group code | Group: CO (contractual), PR (patient), OA (other), PI (payor initiated), CR (corrections) |
| `amount` | DECIMAL(10,2) | CAS amount | Adjustment amount |
| `reason_description` | TEXT | Lookup table | Human-readable description |
| `claim_id` | UUID | — | FK → Claim |
| `remittance_id` | UUID | — | FK → Remittance |
| `claim_line_id` | UUID | — | FK → ClaimLine (not currently populated) |
| `remittance_line_id` | UUID | — | FK → RemittanceLine |
| `created_at` | TIMESTAMP | — | |
| `updated_at` | TIMESTAMP | — | |

---

## Notes

- **21 tables** total — 9 claim-related (Claim + 8 sub-tables), 7 remittance-related (RemittanceFile, Remittance, RemittanceLine + 4 sub-tables), ProviderAdjustment, DenialReason, UploadedFile, User, Setting
- **837 Parser** populates: Claim, ClaimLine, ClaimDiagnosis, ClaimReference, ClaimAmount, ClaimCondition, ClaimReportType, ClaimFileInfo, ClaimToothInfo
- **835 Parser** populates: RemittanceFile, Remittance, RemittanceLine, RemittanceReference, RemittanceAmount, RemittanceInpatient, RemittanceOutpatient, ProviderAdjustment, DenialReason
- `DenialReason` is cross-cutting — populated from CAS segments at both the claim-level (CLP→CAS) and line-level (SVC→CAS) in 835
- Fields **not from EDI** (system/computed): `id`, `created_at`, `updated_at`, `file_id`, `claim_id`, `remittance_id`, `superseded_by_id`, `supersedes_id`, `resolved_at`, `days_to_resolve`, `status`, `error_message`, `content_hash`, `password_hash`, `username`, `email`, `role`, `active`, `key`/`value`, `patient_name`
