const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimLine = sequelize.define('ClaimLine', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  line_number: { type: DataTypes.INTEGER },
  procedure_code: { type: DataTypes.STRING(20) },
  diagnosis_code: { type: DataTypes.STRING(20) },
  charge_amount: { type: DataTypes.DECIMAL(10, 2) },
  service_date: { type: DataTypes.DATEONLY },
}, {
  tableName: 'claim_lines',
  timestamps: false,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
    { fields: ['procedure_code'] },
    { fields: ['service_date'] },
  ],
});

ClaimLine.associate = (models) => {
  ClaimLine.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimLine;
