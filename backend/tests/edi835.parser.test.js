const { expect } = require('chai');
const { parse835 } = require('../src/parsers/edi835.parser');
const SAMPLE_835 = require('./fixtures/sample.835');

describe('EDI 835 Parser', () => {
  it('should parse metadata from ISA header', () => {
    const result = parse835(SAMPLE_835);
    expect(result.metadata.sender_id).to.equal('SENDER');
    expect(result.metadata.total_payment).to.be.closeTo(200, 0.01);
  });

  it('should extract remittances from CLP segments', () => {
    const result = parse835(SAMPLE_835);
    expect(result.remittances).to.have.lengthOf(1);
    expect(result.remittances[0].total_charge).to.be.closeTo(250, 0.01);
    expect(result.remittances[0].total_paid).to.be.closeTo(200, 0.01);
  });

  it('should detect partial payment status', () => {
    expect(parse835(SAMPLE_835).remittances[0].status).to.equal('partial');
  });

  it('should extract denial reasons from CAS segments', () => {
    const remit = parse835(SAMPLE_835).remittances[0];
    const co45 = remit.denial_reasons.find(r => r.denial_code === 'CO-45');
    expect(co45).to.not.be.undefined;
    expect(co45.amount).to.be.greaterThan(0);
  });

  it('should extract patient name', () => {
    expect(parse835(SAMPLE_835).remittances[0].patient_name).to.equal('JOHN DOE');
  });

  it('should handle empty content', () => {
    expect(parse835('').remittances).to.have.lengthOf(0);
  });
});
