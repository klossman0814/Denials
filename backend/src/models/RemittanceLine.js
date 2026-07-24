const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RemittanceLine = sequelize.define('RemittanceLine', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  line_number: { type: DataTypes.INTEGER },
  procedure_code: { type: DataTypes.STRING(20) },
  modifier: { type: DataTypes.STRING(30) },
  charge_amount: { type: DataTypes.DECIMAL(10, 2) },
  paid_amount: { type: DataTypes.DECIMAL(10, 2) },
  unit_count: { type: DataTypes.DECIMAL(8, 2) },
  service_date: { type: DataTypes.DATEONLY },
  line_control_number: { type: DataTypes.STRING(50) },
  patient_liability: { type: DataTypes.DECIMAL(10, 2) },
}, {
  tableName: 'remittance_lines',
  timestamps: false,
  underscored: true,
  indexes: [
    { fields: ['remittance_id'] },
    { fields: ['procedure_code'] },
  ],
});

RemittanceLine.associate = (models) => {
  RemittanceLine.belongsTo(models.Remittance, { foreignKey: 'remittance_id' });
  RemittanceLine.hasMany(models.DenialReason, { foreignKey: 'remittance_line_id' });
};

module.exports = RemittanceLine;
