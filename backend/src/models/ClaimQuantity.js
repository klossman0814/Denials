const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 837 QTY segment — claim quantities
const ClaimQuantity = sequelize.define('ClaimQuantity', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  qualifier: { type: DataTypes.STRING(5) },
  value: { type: DataTypes.DECIMAL(12, 2) },
}, {
  tableName: 'claim_quantities',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['claim_id'] }],
});

ClaimQuantity.associate = (models) => {
  ClaimQuantity.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimQuantity;
