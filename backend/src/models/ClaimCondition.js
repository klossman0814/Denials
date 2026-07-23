const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimCondition = sequelize.define('ClaimCondition', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  category: { type: DataTypes.STRING(5) }, // CRC code/category
  qualifier: { type: DataTypes.STRING(10) },
  value: { type: DataTypes.STRING(5) },
}, {
  tableName: 'claim_conditions',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
  ],
});

ClaimCondition.associate = (models) => {
  ClaimCondition.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimCondition;
