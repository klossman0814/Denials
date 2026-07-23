const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimReference = sequelize.define('ClaimReference', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  qualifier: { type: DataTypes.STRING(10) },
  value: { type: DataTypes.STRING(200) },
  description: { type: DataTypes.STRING(200) },
}, {
  tableName: 'claim_references',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
    { fields: ['qualifier'] },
  ],
});

ClaimReference.associate = (models) => {
  ClaimReference.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimReference;
