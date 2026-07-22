const { parse835 } = require('../src/parsers/edi835.parser');
const SAMPLE_835 = require('./fixtures/sample.835');

describe('EDI 835 Parser — Comprehensive', () => {
  // -- Envelope --
  describe('Envelope (ISA/GS/ST/SE/GE/IEA)', () => {
    it('should parse ISA metadata', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.sender_id).toBe('SENDER');
      expect(result.metadata.receiver_id).toBe('RECEIVER');
      expect(result.metadata.date).toBe('220715');
      expect(result.metadata.time).toBe('0953');
      expect(result.metadata.control_number).toBe('000000002');
    });

    it('should parse GS metadata', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.gs_sender).toBe('SENDER');
      expect(result.metadata.gs_receiver).toBe('RECEIVER');
      expect(result.metadata.gs_date).toBe('20220715');
      expect(result.metadata.gs_control_number).toBe('1');
      expect(result.metadata.gs_version).toBe('005010X221A1');
    });

    it('should parse ST header', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.st_transaction_id).toBe('835');
      expect(result.metadata.st_control_number).toBe('0002');
    });

    it('should parse SE trailer', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.total_segments).toBe(56);
    });

    it('should parse IEA control number', () => {
      const result = parse835(SAMPLE_835);
      expect(result.metadata.interchange_control_number).toBe('000000002');
    });
  });

  // -- Header --
  describe('Header (BPR/TRN/DTM 405)', () => {
    it('should parse BPR payment info', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.total_payment).toBeCloseTo(700, 2);
      expect(result.file.payment_method).toBe('CHK');
      expect(result.file.payment_date).toBe('2022-07-16');
      expect(result.file.credit_debit_flag).toBe('C');
    });

    it('should parse TRN trace number', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.trace_number).toBe('PAYREF001');
    });
  });

  // -- Payer/Payee --
  describe('Payer/Payee (N1/N3/N4/REF/PER)', () => {
    it('should parse payer info', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.payer.name).toBe('PAYER NAME');
      expect(result.file.payer.id_code).toBe('123456789');
      expect(result.file.payer.id_qualifier).toBe('XV');
      expect(result.file.payer.address.address1).toBe('123 MAIN ST');
      expect(result.file.payer.address.address2).toBe('SUITE 100');
      expect(result.file.payer.address.city).toBe('METROPOLIS');
      expect(result.file.payer.address.state).toBe('NY');
      expect(result.file.payer.address.zip).toBe('10001');
      expect(result.file.payer.contact.name).toBe('JOHN SMITH');
      expect(result.file.payer.contact.phone).toBe('5551234567');
      expect(result.file.payer.contact.email).toBe('JSMITH@PAYER.COM');
    });

    it('should parse payee info', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.payee.name).toBe('PROVIDER NAME');
      expect(result.file.payee.id_code).toBe('987654321');
      expect(result.file.payee.id_qualifier).toBe('XX');
      expect(result.file.payee.address.address1).toBe('456 OAK AVE');
      expect(result.file.payee.address.city).toBe('ANYTOWN');
      expect(result.file.payee.address.state).toBe('CA');
      expect(result.file.payee.address.zip).toBe('90210');
      expect(result.file.payee.contact.name).toBe('JANE DOE');
      expect(result.file.payee.contact.phone).toBe('5559876543');
    });

    it('should parse payee tax ID', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.payee_tax_id).toBe('12-3456789');
      const tjRef = result.file.payee.additional_ids.find(r => r.qualifier === 'TJ');
      expect(tjRef).toBeDefined();
      expect(tjRef.value).toBe('12-3456789');
    });

    it('should preserve flat payer/payee fields for backward compat', () => {
      const result = parse835(SAMPLE_835);
      expect(result.file.payer_name).toBe('PAYER NAME');
      expect(result.file.payee_name).toBe('PROVIDER NAME');
    });
  });

  // -- Claims --
  describe('Claims (CLP)', () => {
    it('should extract all remittances', () => {
      const result = parse835(SAMPLE_835);
      expect(result.remittances).toHaveLength(3);
    });

    it('should parse CLP fields for partial claim', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.payer_claim_id).toBe('CLM001');
      expect(remit.total_charge).toBeCloseTo(250, 2);
      expect(remit.total_paid).toBeCloseTo(200, 2);
      expect(remit.adjustment_amount).toBeCloseTo(50, 2);
      expect(remit.status).toBe('partial');
      expect(remit.claim_status_code).toBe('1');
      expect(remit.claim_filing_type).toBe('11');
    });

    it('should parse fully denied claim', () => {
      const remit = parse835(SAMPLE_835).remittances[1];
      expect(remit.total_charge).toBeCloseTo(300, 2);
      expect(remit.total_paid).toBeCloseTo(0, 2);
      expect(remit.status).toBe('denied');
    });

    it('should parse fully paid claim', () => {
      const remit = parse835(SAMPLE_835).remittances[2];
      expect(remit.total_charge).toBeCloseTo(500, 2);
      expect(remit.total_paid).toBeCloseTo(500, 2);
      expect(remit.status).toBe('paid');
    });
  });

  // -- Patient / Subscriber / Provider Names --
  describe('Patient / Subscriber / Provider (NM1)', () => {
    it('should parse patient info from NM1*QC', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.patient_first_name).toBe('JOHN');
      expect(remit.patient_last_name).toBe('DOE');
      expect(remit.patient_member_id).toBe('MEM001');
      expect(remit.patient.first_name).toBe('JOHN');
      expect(remit.patient.last_name).toBe('DOE');
      expect(remit.patient.member_id).toBe('MEM001');
      expect(remit.patient_name).toBe('JOHN DOE');
    });

    it('should parse subscriber info from NM1*IL', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.subscriber_id).toBe('SUB001');
      expect(remit.subscriber.subscriber_id).toBe('SUB001');
    });

    it('should parse rendering provider from NM1*82 with NPI', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.rendering_provider_name).toBe('JANE SMITH');
      expect(remit.rendering_provider.name).toBe('JANE SMITH');
      expect(remit.rendering_provider_npi).toBe('1234567893');
      expect(remit.rendering_provider.npi).toBe('1234567893');
    });

    it('should parse billing provider from NM1*85', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.billing_provider_name).toBe('BILLING CLINIC');
      expect(remit.billing_provider.name).toBe('BILLING CLINIC');
      expect(remit.billing_provider_npi).toBe('9876543212');
      expect(remit.billing_provider.npi).toBe('9876543212');
    });
  });

  // -- Demographics --
  describe('Patient Demographics (DMG)', () => {
    it('should parse patient DOB and gender', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.patient_dob).toBe('1980-01-15');
      expect(remit.patient_gender).toBe('M');
    });
  });

  // -- Dates --
  describe('Dates (DTM)', () => {
    it('should parse service dates from DTM 232/233', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.service_date_from).toBe('2022-07-01');
      expect(remit.service_date_to).toBe('2022-07-15');
      expect(remit.service_dates.from).toBe('2022-07-01');
      expect(remit.service_dates.to).toBe('2022-07-15');
    });

    it('should parse remittance date from DTM 050', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.remittance_date).toBe('2022-07-20');
    });
  });

  // -- References --
  describe('References (REF)', () => {
    it('should collect claim-level REFs', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      const ref1C = remit.refs.find(r => r.qualifier === '1C');
      expect(ref1C).toBeDefined();
      expect(ref1C.value).toBe('1234567893');
      expect(ref1C.description).toBe('Rendering Provider NPI');
      const refF8 = remit.refs.find(r => r.qualifier === 'F8');
      expect(refF8).toBeDefined();
      expect(refF8.value).toBe('REF123');
    });
  });

  // -- Monetary Amounts --
  describe('Monetary Amounts (AMT)', () => {
    it('should collect claim-level AMTs', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      const amtI = remit.amts.find(a => a.qualifier === 'I');
      expect(amtI).toBeDefined();
      expect(amtI.value).toBeCloseTo(50, 2);
      expect(amtI.description).toBe('Interest Amount');
    });
  });

  // -- Denial Reasons --
  describe('Denial Reasons (CAS)', () => {
    it('should parse claim-level CAS', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      const co45 = remit.denial_reasons.find(d => d.denial_code === 'CO-45');
      expect(co45).toBeDefined();
      expect(co45.amount).toBeCloseTo(50, 2);
      expect(co45.group_code).toBe('CO');
    });

    it('should parse claim-level CAS on denied claim', () => {
      const remit = parse835(SAMPLE_835).remittances[1];
      const pr3 = remit.denial_reasons.find(d => d.denial_code === 'PR-3');
      expect(pr3).toBeDefined();
      expect(pr3.amount).toBeCloseTo(300, 2);
      expect(pr3.group_code).toBe('PR');
    });
  });

  // -- Service Lines --
  describe('Service Lines (SVC)', () => {
    it('should parse service lines for partial claim', () => {
      const remit = parse835(SAMPLE_835).remittances[0];
      expect(remit.service_lines).toHaveLength(2);
    });

    it('should parse SVC fields', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.line_number).toBe(1);
      expect(line.procedure_code).toBe('99213');
      expect(line.charge_amount).toBeCloseTo(150, 2);
      expect(line.paid_amount).toBeCloseTo(120, 2);
      expect(line.unit_count).toBeCloseTo(1, 2);
    });

    it('should parse line-level CAS', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      const co45 = line.denial_reasons.find(d => d.denial_code === 'CO-45');
      expect(co45).toBeDefined();
      expect(co45.amount).toBeCloseTo(30, 2);
    });

    it('should parse line-level DTM 472', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.service_date).toBe('2022-07-01');
    });

    it('should parse REF 6R line control number', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.line_control_number).toBe('LN001');
    });

    it('should parse AMT B6 patient liability', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.patient_liability).toBeCloseTo(10, 2);
    });

    it('should parse QTY quantity adjustments', () => {
      const line = parse835(SAMPLE_835).remittances[0].service_lines[0];
      expect(line.quantity_adjustments).toHaveLength(1);
      expect(line.quantity_adjustments[0].qualifier).toBe('CA');
      expect(line.quantity_adjustments[0].value).toBeCloseTo(1, 2);
    });

    it('should parse service lines for denied claim', () => {
      const remit = parse835(SAMPLE_835).remittances[1];
      expect(remit.service_lines).toHaveLength(1);
      expect(remit.service_lines[0].procedure_code).toBe('99215');
      expect(remit.service_lines[0].paid_amount).toBeCloseTo(0, 2);
      const pr3 = remit.service_lines[0].denial_reasons.find(d => d.denial_code === 'PR-3');
      expect(pr3).toBeDefined();
      expect(pr3.amount).toBeCloseTo(300, 2);
    });
  });

  // -- Provider Adjustments --
  describe('Provider Adjustments (PLB)', () => {
    it('should parse PLB provider adjustments', () => {
      const result = parse835(SAMPLE_835);
      expect(result.provider_adjustments).toHaveLength(1);
      expect(result.provider_adjustments[0].adjustment_reason_code).toBe('FB');
      expect(result.provider_adjustments[0].adjustment_reason_subcode).toBe('50');
      expect(result.provider_adjustments[0].adjustment_amount).toBeCloseTo(50, 2);
    });
  });

  // -- Edge Cases --
  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const result = parse835('');
      expect(result.remittances).toHaveLength(0);
      expect(result.metadata).toBeDefined();
      expect(result.file).toBeDefined();
      expect(result.provider_adjustments).toHaveLength(0);
    });

    it('should handle content with only headers (no claims)', () => {
      const headerOnly = [
        'ISA*00*          *00*          *ZZ*SENDER*ZZ*RECEIVER*220715*0953*^*00501*000000002*0*P*:~',
        'GS*HP*SENDER*RECEIVER*20220715*0953*1*X*005010X221A1~',
        'ST*835*0002~',
        'SE*3*0002~',
        'GE*1*1~',
        'IEA*1*000000002~',
      ].join('');
      const result = parse835(headerOnly);
      expect(result.metadata.sender_id.trim()).toBe('SENDER');
      expect(result.remittances).toHaveLength(0);
    });

    it('should handle multiple claims', () => {
      const result = parse835(SAMPLE_835);
      expect(result.remittances).toHaveLength(3);
    });
  });
});