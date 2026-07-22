const { expect } = require('chai');
const { parse837 } = require('../src/parsers/edi837.parser');
const SAMPLE_837 = require('./fixtures/sample.837');

describe('EDI 837 Parser', () => {
  it('should parse metadata from ISA header', () => {
    const result = parse837(SAMPLE_837);
    expect(result.metadata.sender_id).to.equal('SENDER');
    expect(result.metadata.control_number).to.equal('000000001');
  });

  it('should extract claims from CLM segments', () => {
    const result = parse837(SAMPLE_837);
    expect(result.claims).to.have.lengthOf(1);
    expect(result.claims[0].claim_id).to.equal('CLM001');
    expect(result.claims[0].total_charge).to.be.closeTo(250, 0.01);
  });

  it('should extract patient info', () => {
    const result = parse837(SAMPLE_837);
    expect(result.claims[0].patient_first_name).to.equal('JOHN');
    expect(result.claims[0].patient_last_name).to.equal('DOE');
    expect(result.claims[0].patient_dob).to.equal('1980-01-15');
    expect(result.claims[0].patient_gender).to.equal('M');
  });

  it('should extract subscriber ID', () => {
    expect(parse837(SAMPLE_837).claims[0].subscriber_id).to.equal('ABC123456');
  });

  it('should extract service line items', () => {
    const claim = parse837(SAMPLE_837).claims[0];
    expect(claim.lines).to.have.lengthOf(2);
    expect(claim.lines[0].procedure_code).to.equal('99213');
    expect(claim.lines[0].charge_amount).to.be.closeTo(150, 0.01);
    expect(claim.lines[1].procedure_code).to.equal('99214');
    expect(claim.lines[1].charge_amount).to.be.closeTo(100, 0.01);
  });

  it('should handle empty content', () => {
    expect(parse837('').claims).to.have.lengthOf(0);
  });
});
