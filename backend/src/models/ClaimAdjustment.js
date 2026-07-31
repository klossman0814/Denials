const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 837 CAS segment at claim level — claim adjustments
const ClaimAdjustment = sequelize.define('ClaimAdjustment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  group_code: { type: DataTypes.STRING(5) },     // CAS01 (CO, PR, OA, PI, CR)
  reason_code: { type: DataTypes.STRING(10) },  // CAS02
  amount: { type: DataTypes.DECIMAL(10, 2) },   // CAS03
  quantity: { type: DataTypes.DECIMAL(10, 2) }, // CAS04
}, {
  tableName: 'claim_adjustments',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['claim_id'] }],
});

ClaimAdjustment.associate = (models) => {
  ClaimAdjustment.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimAdjustment;
