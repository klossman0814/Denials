const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RemittanceInpatient = sequelize.define('RemittanceInpatient', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  covered_days: { type: DataTypes.INTEGER },
  pps_code: { type: DataTypes.STRING(10) },
  total_covered_days: { type: DataTypes.INTEGER },
  drg: { type: DataTypes.STRING(10) },
  discharge_status: { type: DataTypes.STRING(5) },
  total_adjustment: { type: DataTypes.DECIMAL(10, 2) },
}, {
  tableName: 'remittance_inpatients',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['remittance_id'] },
  ],
});

RemittanceInpatient.associate = (models) => {
  RemittanceInpatient.belongsTo(models.Remittance, { foreignKey: 'remittance_id' });
};

module.exports = RemittanceInpatient;
