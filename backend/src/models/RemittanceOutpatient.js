const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RemittanceOutpatient = sequelize.define('RemittanceOutpatient', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reimbursement: { type: DataTypes.DECIMAL(10, 2) },
  remark_codes: { type: DataTypes.TEXT }, // comma-separated remark codes
}, {
  tableName: 'remittance_outpatients',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['remittance_id'] },
  ],
});

RemittanceOutpatient.associate = (models) => {
  RemittanceOutpatient.belongsTo(models.Remittance, { foreignKey: 'remittance_id' });
};

module.exports = RemittanceOutpatient;
