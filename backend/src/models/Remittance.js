const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Remittance = sequelize.define('Remittance', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  patient_name: { type: DataTypes.STRING(200) },
  payer_claim_id: { type: DataTypes.STRING(100) },
  total_charge: { type: DataTypes.DECIMAL(10, 2) },
  total_paid: { type: DataTypes.DECIMAL(10, 2) },
  adjustment_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  remittance_date: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending', validate: { isIn: [['pending', 'paid', 'denied', 'partial']] } },
  patient_first_name: { type: DataTypes.STRING(100) },
  patient_last_name: { type: DataTypes.STRING(100) },
  patient_member_id: { type: DataTypes.STRING(100) },
  subscriber_id: { type: DataTypes.STRING(100) },
  rendering_provider_name: { type: DataTypes.STRING(200) },
  rendering_provider_npi: { type: DataTypes.STRING(20) },
  billing_provider_name: { type: DataTypes.STRING(200) },
  billing_provider_npi: { type: DataTypes.STRING(20) },
  service_date_from: { type: DataTypes.DATEONLY },
  service_date_to: { type: DataTypes.DATEONLY },
  claim_status_code: { type: DataTypes.STRING(5) },
  remittance_file_id: { type: DataTypes.UUID },
}, {
  tableName: 'remittances',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
    { fields: ['remittance_file_id'] },
    { fields: ['file_id'] },
    { fields: ['total_paid'] },
    { fields: ['adjustment_amount'] },
    { fields: ['created_at'] },
    { fields: ['status'] },
  ],
});

Remittance.associate = (models) => {
  Remittance.belongsTo(models.UploadedFile, { foreignKey: 'file_id' });
  Remittance.belongsTo(models.Claim, { foreignKey: 'claim_id' });
  Remittance.belongsTo(models.RemittanceFile, { foreignKey: 'remittance_file_id' });
  Remittance.hasMany(models.DenialReason, { foreignKey: 'remittance_id' });
  Remittance.hasMany(models.RemittanceLine, { foreignKey: 'remittance_id' });
};

module.exports = Remittance;
