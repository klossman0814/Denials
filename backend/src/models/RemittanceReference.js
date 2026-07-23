const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RemittanceReference = sequelize.define('RemittanceReference', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  qualifier: { type: DataTypes.STRING(10) },
  value: { type: DataTypes.STRING(200) },
  description: { type: DataTypes.STRING(200) },
}, {
  tableName: 'remittance_references',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['remittance_id'] },
    { fields: ['qualifier'] },
  ],
});

RemittanceReference.associate = (models) => {
  RemittanceReference.belongsTo(models.Remittance, { foreignKey: 'remittance_id' });
};

module.exports = RemittanceReference;
