const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 835 TS3/TS2 segment — provider-level summary of billing/payment totals
const ProviderSummary = sequelize.define('ProviderSummary', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  provider_identifier: { type: DataTypes.STRING(50) },
  fiscal_period_start: { type: DataTypes.DATEONLY },
  fiscal_period_end: { type: DataTypes.DATEONLY },
  total_claim_count: { type: DataTypes.INTEGER },
  total_charge_amount: { type: DataTypes.DECIMAL(12, 2) },
  total_payment_amount: { type: DataTypes.DECIMAL(12, 2) },
  total_patient_responsibility: { type: DataTypes.DECIMAL(12, 2) },
  total_provider_adjustment: { type: DataTypes.DECIMAL(12, 2) },
  total_adjustment_amount: { type: DataTypes.DECIMAL(12, 2) },
}, {
  tableName: 'provider_summaries',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['remittance_file_id'] },
  ],
});

ProviderSummary.associate = (models) => {
  ProviderSummary.belongsTo(models.RemittanceFile, { foreignKey: 'remittance_file_id' });
};

module.exports = ProviderSummary;
