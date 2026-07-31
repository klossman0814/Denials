const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimLine = sequelize.define('ClaimLine', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  line_number: { type: DataTypes.INTEGER },
  procedure_code: { type: DataTypes.STRING(20) },
  modifier: { type: DataTypes.STRING(20) },
  charge_amount: { type: DataTypes.DECIMAL(10, 2) },
  unit_count: { type: DataTypes.DECIMAL(8, 2) },
  service_date: { type: DataTypes.DATEONLY },
  revenue_code: { type: DataTypes.STRING(10) },
  procedure_type: { type: DataTypes.STRING(5) },
  diagnosis_code: { type: DataTypes.STRING(20) },
  diagnosis_code_pointers: { type: DataTypes.TEXT },
  oral_cavity_code: { type: DataTypes.STRING(10) },
  tooth_code: { type: DataTypes.STRING(20) },
  tooth_surface: { type: DataTypes.STRING(10) },
  facility_code: { type: DataTypes.STRING(10) },
  type_of_service: { type: DataTypes.STRING(10) },
  unit_basis: { type: DataTypes.STRING(10) },
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
  ClaimLine.hasMany(models.DenialReason, { foreignKey: 'claim_line_id' });
  ClaimLine.hasMany(models.ClaimToothInfo, { foreignKey: 'claim_line_id' });
};

module.exports = ClaimLine;
