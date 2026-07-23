const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProviderAdjustment = sequelize.define('ProviderAdjustment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  provider_identifier: { type: DataTypes.STRING(50) },
  adjustment_date: { type: DataTypes.DATEONLY },
  adjustment_reason_code: { type: DataTypes.STRING(10) },
  adjustment_reason_subcode: { type: DataTypes.STRING(10) },
  adjustment_amount: { type: DataTypes.DECIMAL(10, 2) },
  reference_identification: { type: DataTypes.STRING(50) },
}, {
  tableName: 'provider_adjustments',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['remittance_file_id'] },
    { fields: ['adjustment_reason_code'] },
  ],
});

ProviderAdjustment.associate = (models) => {
  ProviderAdjustment.belongsTo(models.RemittanceFile, { foreignKey: 'remittance_file_id' });
};

module.exports = ProviderAdjustment;
