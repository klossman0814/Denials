const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Claim = sequelize.define('Claim', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  claim_id: { type: DataTypes.STRING(50) },
  patient_last_name: { type: DataTypes.STRING(100) },
  patient_first_name: { type: DataTypes.STRING(100) },
  patient_dob: { type: DataTypes.DATEONLY },
  patient_gender: { type: DataTypes.STRING(10) },
  patient_member_id: { type: DataTypes.STRING(100) },
  patient_middle_initial: { type: DataTypes.STRING(50) },
  patient_suffix: { type: DataTypes.STRING(20) },
  patient_address1: { type: DataTypes.STRING(200) },
  patient_address2: { type: DataTypes.STRING(200) },
  patient_city: { type: DataTypes.STRING(100) },
  patient_state: { type: DataTypes.STRING(50) },
  patient_zip: { type: DataTypes.STRING(20) },
  patient_relationship_code: { type: DataTypes.STRING(5) },
  subscriber_id: { type: DataTypes.STRING(100) },
  subscriber_first_name: { type: DataTypes.STRING(100) },
  subscriber_last_name: { type: DataTypes.STRING(100) },
  subscriber_middle_initial: { type: DataTypes.STRING(50) },
  subscriber_suffix: { type: DataTypes.STRING(20) },
  subscriber_group_number: { type: DataTypes.STRING(100) },
  subscriber_relationship_code: { type: DataTypes.STRING(5) },
  payer_name: { type: DataTypes.STRING(200) },
  payer_id: { type: DataTypes.STRING(50) },
  claim_filing_type: { type: DataTypes.STRING(5) },
  pos_code: { type: DataTypes.STRING(5) },
  // Billing provider
  provider_name: { type: DataTypes.STRING(200) },
  provider_npi: { type: DataTypes.STRING(20) },
  provider_tax_id: { type: DataTypes.STRING(20) },
  provider_address1: { type: DataTypes.STRING(200) },
  provider_address2: { type: DataTypes.STRING(200) },
  provider_city: { type: DataTypes.STRING(100) },
  provider_state: { type: DataTypes.STRING(50) },
  provider_zip: { type: DataTypes.STRING(20) },
  provider_contact_name: { type: DataTypes.STRING(100) },
  provider_contact_phone: { type: DataTypes.STRING(30) },
  // Other providers
  rendering_provider_name: { type: DataTypes.STRING(200) },
  rendering_provider_npi: { type: DataTypes.STRING(20) },
  referring_provider_name: { type: DataTypes.STRING(200) },
  referring_provider_npi: { type: DataTypes.STRING(20) },
  attending_provider_name: { type: DataTypes.STRING(200) },
  attending_provider_npi: { type: DataTypes.STRING(20) },
  operating_provider_name: { type: DataTypes.STRING(200) },
  operating_provider_npi: { type: DataTypes.STRING(20) },
  service_facility_name: { type: DataTypes.STRING(200) },
  service_facility_npi: { type: DataTypes.STRING(20) },
  // Financial
  total_charge: { type: DataTypes.DECIMAL(10, 2) },
  patient_amount_paid: { type: DataTypes.DECIMAL(10, 2) },
  // Dates
  service_date_start: { type: DataTypes.DATEONLY },
  service_date_end: { type: DataTypes.DATEONLY },
  admission_date: { type: DataTypes.DATEONLY },
  discharge_date: { type: DataTypes.DATEONLY },
  discharge_hour: { type: DataTypes.STRING(10) },
  // Admission info (837I, CL1 segment)
  admit_type_code: { type: DataTypes.STRING(5) },
  admit_source_code: { type: DataTypes.STRING(5) },
  patient_status_code: { type: DataTypes.STRING(5) },
  // DRG info
  drg_code: { type: DataTypes.STRING(10) },
  drg_weight: { type: DataTypes.STRING(20) },
  drg_medical_surgical: { type: DataTypes.STRING(5) },
  // Contract info (CN1 segment)
  contract_type: { type: DataTypes.STRING(5) },
  contract_amount: { type: DataTypes.DECIMAL(10, 2) },
  contract_percentage: { type: DataTypes.DECIMAL(5, 2) },
  // BHT metadata
  bht_purpose: { type: DataTypes.STRING(5) },
  bht_reference: { type: DataTypes.STRING(50) },
  bht_date: { type: DataTypes.STRING(10) },
  bht_time: { type: DataTypes.STRING(10) },
  bht_transaction_type: { type: DataTypes.STRING(5) },
  // Status
  status: { type: DataTypes.STRING(20), defaultValue: 'submitted', validate: { isIn: [['submitted', 'paid', 'denied', 'partial', 'replaced']] } },
  superseded_by_id: { type: DataTypes.UUID, allowNull: true },
  resolved_at: { type: DataTypes.DATE },
  days_to_resolve: { type: DataTypes.INTEGER },
}, {
  tableName: 'claims',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
    { fields: ['payer_name'] },
    { fields: ['status'] },
    { fields: ['created_at'] },
    { fields: ['status', 'created_at'] },
    { fields: ['patient_last_name'] },
    { fields: ['patient_first_name'] },
    { fields: ['file_id'] },
    { fields: ['service_facility_name'] },
    { fields: ['rendering_provider_name'] },
    { fields: ['drg_code'] },
  ],
});

Claim.associate = (models) => {
  Claim.belongsTo(models.UploadedFile, { foreignKey: 'file_id' });
  Claim.belongsTo(models.Claim, { as: 'SupersededBy', foreignKey: 'superseded_by_id' });
  Claim.hasMany(models.ClaimLine, { foreignKey: 'claim_id' });
  Claim.hasMany(models.Remittance, { foreignKey: 'claim_id' });
  Claim.hasMany(models.DenialReason, { foreignKey: 'claim_id' });
  Claim.hasMany(models.ClaimDiagnosis, { foreignKey: 'claim_id' });
  Claim.hasMany(models.ClaimReference, { foreignKey: 'claim_id' });
  Claim.hasMany(models.ClaimAmount, { foreignKey: 'claim_id' });
  Claim.hasMany(models.ClaimCondition, { foreignKey: 'claim_id' });
  Claim.hasMany(models.ClaimReportType, { foreignKey: 'claim_id' });
  Claim.hasMany(models.ClaimFileInfo, { foreignKey: 'claim_id' });
};

module.exports = Claim;
