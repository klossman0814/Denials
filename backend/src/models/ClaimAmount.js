const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimAmount = sequelize.define('ClaimAmount', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  qualifier: { type: DataTypes.STRING(10) },
  value: { type: DataTypes.DECIMAL(12, 2) },
  description: { type: DataTypes.STRING(200) },
}, {
  tableName: 'claim_amounts',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
    { fields: ['qualifier'] },
  ],
});

ClaimAmount.associate = (models) => {
  ClaimAmount.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimAmount;
