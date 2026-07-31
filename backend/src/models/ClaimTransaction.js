const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 837 PTP segment — patient transaction/payment info
const ClaimTransaction = sequelize.define('ClaimTransaction', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  purpose_code: { type: DataTypes.STRING(5) }, // PTP01
  reference_id: { type: DataTypes.STRING(50) }, // PTP02
  date: { type: DataTypes.DATEONLY },          // PTP03
}, {
  tableName: 'claim_transactions',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['claim_id'] }],
});

ClaimTransaction.associate = (models) => {
  ClaimTransaction.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimTransaction;
