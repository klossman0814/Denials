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
  receiver_bank_id: { type: DataTypes.STRING(20) },
  receiver_account: { type: DataTypes.STRING(30) },
  payment_format_code: { type: DataTypes.STRING(5) },
  payment_format_desc: { type: DataTypes.STRING(50) },
  payer_name: { type: DataTypes.STRING(200) },
  payer_id_code: { type: DataTypes.STRING(50) },
  payee_name: { type: DataTypes.STRING(200) },
  payee_id_code: { type: DataTypes.STRING(50) },
  payee_tax_id: { type: DataTypes.STRING(20) },
  credit_debit_flag: { type: DataTypes.STRING(5) },
  // Payer address (N3/N4 under N1*PR)
  payer_address1: { type: DataTypes.STRING(200) },
  payer_address2: { type: DataTypes.STRING(200) },
  payer_city: { type: DataTypes.STRING(100) },
  payer_state: { type: DataTypes.STRING(50) },
  payer_zip: { type: DataTypes.STRING(20) },
  // Payer contact (PER under N1*PR)
  payer_contact_name: { type: DataTypes.STRING(100) },
  payer_contact_phone: { type: DataTypes.STRING(30) },
  payer_contact_email: { type: DataTypes.STRING(100) },
  payer_contact_fax: { type: DataTypes.STRING(30) },
  payer_contact_url: { type: DataTypes.STRING(200) },
  // Payee address (N3/N4 under N1*PE)
  payee_address1: { type: DataTypes.STRING(200) },
  payee_address2: { type: DataTypes.STRING(200) },
  payee_city: { type: DataTypes.STRING(100) },
  payee_state: { type: DataTypes.STRING(50) },
  payee_zip: { type: DataTypes.STRING(20) },
  // Payee contact (PER under N1*PE)
  payee_contact_name: { type: DataTypes.STRING(100) },
  payee_contact_phone: { type: DataTypes.STRING(30) },
  payee_contact_email: { type: DataTypes.STRING(100) },
  payee_contact_fax: { type: DataTypes.STRING(30) },
  payee_contact_url: { type: DataTypes.STRING(200) },
  // ISA/GS/ST envelope metadata
  sender_id: { type: DataTypes.STRING(50) },
  receiver_id: { type: DataTypes.STRING(50) },
  isa_date: { type: DataTypes.STRING(10) },
  isa_time: { type: DataTypes.STRING(10) },
  isa_control_number: { type: DataTypes.STRING(20) },
  isa_standards_id: { type: DataTypes.STRING(20) },
  gs_sender: { type: DataTypes.STRING(50) },
  gs_receiver: { type: DataTypes.STRING(50) },
  gs_date: { type: DataTypes.STRING(10) },
  gs_time: { type: DataTypes.STRING(10) },
  gs_control_number: { type: DataTypes.STRING(20) },
  gs_version: { type: DataTypes.STRING(20) },
  st_transaction_id: { type: DataTypes.STRING(10) },
  st_control_number: { type: DataTypes.STRING(20) },
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
  RemittanceFile.hasMany(models.ProviderAdjustment, { foreignKey: 'remittance_file_id' });
};

module.exports = RemittanceFile;
