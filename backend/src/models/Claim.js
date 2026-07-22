const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Claim = sequelize.define('Claim', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  claim_id: { type: DataTypes.STRING(50) },
  patient_last_name: { type: DataTypes.STRING(100) },
  patient_first_name: { type: DataTypes.STRING(100) },
  patient_dob: { type: DataTypes.DATEONLY },
  patient_gender: { type: DataTypes.STRING(10) },
  subscriber_id: { type: DataTypes.STRING(100) },
  payer_name: { type: DataTypes.STRING(200) },
  provider_name: { type: DataTypes.STRING(200) },
  provider_npi: { type: DataTypes.STRING(20) },
  total_charge: { type: DataTypes.DECIMAL(10, 2) },
  service_date_start: { type: DataTypes.DATEONLY },
  service_date_end: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.STRING(20), defaultValue: 'submitted', validate: { isIn: [['submitted', 'paid', 'denied', 'partial']] } },
}, { tableName: 'claims', timestamps: true, underscored: true });

Claim.associate = (models) => {
  Claim.belongsTo(models.UploadedFile, { foreignKey: 'file_id' });
  Claim.hasMany(models.ClaimLine, { foreignKey: 'claim_id' });
  Claim.hasMany(models.Remittance, { foreignKey: 'claim_id' });
  Claim.hasMany(models.DenialReason, { foreignKey: 'claim_id' });
};

module.exports = Claim;
