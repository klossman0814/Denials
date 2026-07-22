const { parse837 } = require('../src/parsers/edi837.parser');
const SAMPLE_837 = require('./fixtures/sample.837');
const SAMPLE_837I = require('./fixtures/sample.837i');
const SAMPLE_837D = require('./fixtures/sample.837d');

describe('EDI 837 Parser', () => {

  // ===== ENVELOPE TESTS =====
  describe('Envelope', () => {
    it('should parse ISA metadata', () => {
      const result = parse837(SAMPLE_837);
      expect(result.metadata.sender_id).toBe('SENDER');
      expect(result.metadata.receiver_id).toBe('RECEIVER');
      expect(result.metadata.date).toBe('220701');
      expect(result.metadata.time).toBe('1253');
      expect(result.metadata.control_number).toBe('000000001');
    });

    it('should parse GS metadata', () => {
      const result = parse837(SAMPLE_837);
      expect(result.metadata.gs_sender).toBe('SENDER');
      expect(result.metadata.gs_receiver).toBe('RECEIVER');
      expect(result.metadata.gs_version).toBe('005010X222A1');
    });

    it('should parse ST metadata', () => {
      const result = parse837(SAMPLE_837);
      expect(result.metadata.st_transaction_id).toBe('837');
      expect(result.metadata.st_control_number).toBe('0001');
    });

    it('should parse BHT metadata', () => {
      const result = parse837(SAMPLE_837);
      expect(result.metadata.bht_purpose).toBe('0019');
      expect(result.metadata.bht_reference).toBe('12345');
      expect(result.metadata.bht_date).toBe('20220701');
      expect(result.metadata.bht_transaction_type).toBe('CH');
    });
  });

  // ===== CLAIM TESTS =====
  describe('Claims', () => {
    it('should extract claims from CLM segments', () => {
      const result = parse837(SAMPLE_837);
      expect(result.claims).toHaveLength(2);
      expect(result.claims[0].claim_id).toBe('CLM001');
      expect(result.claims[0].total_charge).toBeCloseTo(250, 0.01);
      expect(result.claims[1].claim_id).toBe('CLM002');
      expect(result.claims[1].total_charge).toBeCloseTo(500, 0.01);
    });

    it('should extract patient info', () => {
      const result = parse837(SAMPLE_837);
      expect(result.claims[0].patient_first_name).toBe('JOHN');
      expect(result.claims[0].patient_last_name).toBe('DOE');
      expect(result.claims[0].patient_dob).toBe('1980-01-15');
      expect(result.claims[0].patient_gender).toBe('M');
    });

    it('should extract subscriber ID', () => {
      expect(parse837(SAMPLE_837).claims[0].subscriber_id).toBe('ABC123456');
    });

    it('should extract billing provider info', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.provider_name).toBe('ACME MEDICAL GROUP');
      expect(claim.provider_npi).toBe('1234567893');
      expect(claim.provider_tax_id).toBe('123456789');
    });

    it('should extract rendering provider info', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.rendering_provider_name).toBe('JANE SMITH');
      expect(claim.rendering_provider_npi).toBe('9876543212');
    });

    it('should extract service facility info', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.service_facility_name).toBe('DOWNTOWN CLINIC');
      expect(claim.service_facility_npi).toBe('1122334455');
    });

    it('should extract service dates', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.service_date_start).toBe('2022-07-01');
      expect(claim.service_date_end).toBe('2022-07-01');
    });
  });

  // ===== DIAGNOSIS CODE TESTS =====
  describe('Diagnosis Codes', () => {
    it('should extract diagnosis codes from HI segment', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.diagnosis_codes).toHaveLength(3);
      expect(claim.diagnosis_codes[0]).toEqual({ code: 'I10', qualifier: 'BK', type: 'principal' });
      expect(claim.diagnosis_codes[1]).toEqual({ code: 'E119', qualifier: 'BF', type: 'other' });
      expect(claim.diagnosis_codes[2]).toEqual({ code: 'I25.1', qualifier: 'BF', type: 'other' });
    });
  });

  // ===== SERVICE LINE TESTS =====
  describe('Service Lines', () => {
    it('should extract service line items for 837P', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.lines).toHaveLength(2);
      expect(claim.lines[0].procedure_code).toBe('99213');
      expect(claim.lines[0].modifier).toBe('11');
      expect(claim.lines[0].charge_amount).toBeCloseTo(150, 0.01);
      expect(claim.lines[0].unit_count).toBeCloseTo(1, 0.01);
      expect(claim.lines[0].procedure_type).toBe('SV1');
      expect(claim.lines[1].procedure_code).toBe('99214');
      expect(claim.lines[1].charge_amount).toBeCloseTo(100, 0.01);
    });

    it('should extract service dates per line', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      expect(claim.lines[0].service_date).toBe('2022-07-01');
      expect(claim.lines[1].service_date).toBe('2022-07-02');
    });
  });

  // ===== REFERENCE AND AMOUNT TESTS =====
  describe('References and Amounts', () => {
    it('should extract REF entries', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      const refD9 = claim.refs.find(r => r.qualifier === 'D9');
      expect(refD9).toBeDefined();
      expect(refD9.value).toBe('REF123456');
    });

    it('should extract AMT entries', () => {
      const claim = parse837(SAMPLE_837).claims[0];
      const amtF5 = claim.amts.find(a => a.qualifier === 'F5');
      expect(amtF5).toBeDefined();
      expect(amtF5.value).toBeCloseTo(20, 0.01);
    });
  });

  // ===== MULTI-CLAIM TESTS =====
  describe('Multi-Claim', () => {
    it('should handle multiple billing providers', () => {
      const result = parse837(SAMPLE_837);
      expect(result.claims).toHaveLength(2);
      // First claim is from ACME MEDICAL GROUP
      expect(result.claims[0].provider_name).toBe('ACME MEDICAL GROUP');
      // Second claim is from OTHER BILLING INC
      expect(result.claims[1].provider_name).toBe('OTHER BILLING INC');
    });

    it('should handle separate patients per claim', () => {
      const result = parse837(SAMPLE_837);
      expect(result.claims[0].patient_last_name).toBe('DOE');
      expect(result.claims[1].patient_last_name).toBe('SMITH');
    });
  });

  // ===== EMPTY / EDGE CASE TESTS =====
  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      expect(parse837('').claims).toHaveLength(0);
    });
  });

  // ===== 837I INSTITUTIONAL TESTS =====
  describe('837I Institutional', () => {
    it('should parse institutional claims', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim).toBeDefined();
      expect(claim.claim_id).toBe('CLM003');
      expect(claim.total_charge).toBeCloseTo(1500, 0.01);
    });

    it('should parse admission/discharge dates', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.admission_date).toBe('2022-07-10');
      expect(claim.discharge_date).toBe('2022-07-15');
      expect(claim.discharge_hour).toBe('1430');
    });

    it('should parse CL1 admission info', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.admit_type_code).toBe('1');
      expect(claim.admit_source_code).toBe('5');
      expect(claim.patient_status_code).toBe('02');
    });

    it('should parse HI diagnosis codes (837I specifiers)', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.diagnosis_codes.length).toBeGreaterThanOrEqual(4);

      const principal = claim.diagnosis_codes.find(d => d.type === 'principal');
      expect(principal).toBeDefined();
      expect(principal.code).toBe('E119');

      const admitting = claim.diagnosis_codes.find(d => d.type === 'admitting');
      expect(admitting).toBeDefined();
      expect(admitting.code).toBe('I10');

      const external = claim.diagnosis_codes.find(d => d.type === 'external_cause');
      expect(external).toBeDefined();
      expect(external.code).toBe('V901');
    });

    it('should parse DRG info', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.drg_code).toBe('871');
    });

    it('should parse attending and operating physicians', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.attending_provider_name).toBe('DAVID LEE');
      expect(claim.attending_provider_npi).toBe('2222222222');
      expect(claim.operating_provider_name).toBe('SUSAN WONG');
      expect(claim.operating_provider_npi).toBe('3333333333');
    });

    it('should parse SV2 revenue codes', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.lines).toHaveLength(3);
      expect(claim.lines[0].procedure_type).toBe('SV2');
      expect(claim.lines[0].revenue_code).toBe('0450');
      expect(claim.lines[0].procedure_code).toBe('99221');
      expect(claim.lines[1].revenue_code).toBe('0452');
      expect(claim.lines[2].revenue_code).toBe('0459');
    });

    it('should parse PWK report type', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.report_types).toHaveLength(1);
      expect(claim.report_types[0].code).toBe('09');
      expect(claim.report_types[0].qualifier).toBe('AC');
    });

    it('should parse CN1 contract info', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.contract_type).toBe('01');
      expect(claim.contract_amount).toBeCloseTo(500, 0.01);
    });

    it('should parse CRC condition codes', () => {
      const claim = parse837(SAMPLE_837I).claims[0];
      expect(claim.condition_codes).toHaveLength(1);
      expect(claim.condition_codes[0].code).toBe('AB');
      expect(claim.condition_codes[0].value).toBe('1');
    });
  });

  // ===== 837D DENTAL TESTS =====
  describe('837D Dental', () => {
    it('should parse dental claims', () => {
      const claim = parse837(SAMPLE_837D).claims[0];
      expect(claim).toBeDefined();
      expect(claim.claim_id).toBe('CLM004');
      expect(claim.total_charge).toBeCloseTo(350, 0.01);
    });

    it('should parse SV3 CDT codes', () => {
      const claim = parse837(SAMPLE_837D).claims[0];
      expect(claim.lines).toHaveLength(3);
      expect(claim.lines[0].procedure_type).toBe('SV3');
      expect(claim.lines[0].procedure_code).toBe('D0120');
      expect(claim.lines[1].procedure_code).toBe('D0270');
      expect(claim.lines[2].procedure_code).toBe('D0150');
    });

    it('should parse TOO tooth information', () => {
      const claim = parse837(SAMPLE_837D).claims[0];
      expect(claim.lines[0].oral_cavity_code).toBe('1');
      expect(claim.lines[0].tooth_code).toBe('2');
      expect(claim.lines[0].tooth_surface).toBe('ML');
      expect(claim.lines[1].tooth_code).toBe('30');
      expect(claim.lines[1].tooth_surface).toBe('MOD');
    });
  });
});