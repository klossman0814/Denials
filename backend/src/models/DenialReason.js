const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DenialReason = sequelize.define('DenialReason', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  denial_code: { type: DataTypes.STRING(10), allowNull: false },
  group_code: { type: DataTypes.STRING(5) },
  amount: { type: DataTypes.DECIMAL(10, 2) },
  reason_description: { type: DataTypes.TEXT },
}, {
  tableName: 'denial_reasons',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['denial_code'] },
    { fields: ['claim_id'] },
    { fields: ['remittance_id'] },
    { fields: ['claim_line_id'] },
    { fields: ['remittance_line_id'] },
    { fields: ['created_at'] },
    { fields: ['group_code'] },
    { fields: ['amount'] },
  ],
});

DenialReason.associate = (models) => {
  DenialReason.belongsTo(models.Remittance, { foreignKey: 'remittance_id' });
  DenialReason.belongsTo(models.Claim, { foreignKey: 'claim_id' });
  DenialReason.belongsTo(models.ClaimLine, { foreignKey: 'claim_line_id' });
  DenialReason.belongsTo(models.RemittanceLine, { foreignKey: 'remittance_line_id' });
};

module.exports = DenialReason;
