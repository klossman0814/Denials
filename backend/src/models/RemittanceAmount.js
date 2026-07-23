const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RemittanceAmount = sequelize.define('RemittanceAmount', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  qualifier: { type: DataTypes.STRING(10) },
  value: { type: DataTypes.DECIMAL(12, 2) },
  description: { type: DataTypes.STRING(200) },
}, {
  tableName: 'remittance_amounts',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['remittance_id'] },
    { fields: ['qualifier'] },
  ],
});

RemittanceAmount.associate = (models) => {
  RemittanceAmount.belongsTo(models.Remittance, { foreignKey: 'remittance_id' });
};

module.exports = RemittanceAmount;
