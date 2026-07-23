const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RemittanceFile = sequelize.define('RemittanceFile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  total_payment: { type: DataTypes.DECIMAL(12, 2) },
  payment_method: { type: DataTypes.STRING(20) },
  payment_date: { type: DataTypes.DATEONLY },
  trace_number: { type: DataTypes.STRING(50) },
  sender_bank_id: { type: DataTypes.STRING(20) },
  sender_account: { type: DataTypes.STRING(30) },
  payer_name: { type: DataTypes.STRING(200) },
  payer_id_code: { type: DataTypes.STRING(50) },
  payee_name: { type: DataTypes.STRING(200) },
  payee_id_code: { type: DataTypes.STRING(50) },
  payee_tax_id: { type: DataTypes.STRING(20) },
}, {
  tableName: 'remittance_files',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['payer_name'] },
    { fields: ['file_id'] },
  ],
});

RemittanceFile.associate = (models) => {
  RemittanceFile.belongsTo(models.UploadedFile, { foreignKey: 'file_id' });
  RemittanceFile.hasMany(models.Remittance, { foreignKey: 'remittance_file_id' });
};

module.exports = RemittanceFile;
