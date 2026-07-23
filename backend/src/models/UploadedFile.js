const crypto = require('crypto');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UploadedFile = sequelize.define('UploadedFile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  filename: { type: DataTypes.STRING(255), allowNull: false },
  file_type: { type: DataTypes.STRING(3), allowNull: false, validate: { isIn: [['837', '835']] } },
  file_path: { type: DataTypes.TEXT, allowNull: false },
  file_size: { type: DataTypes.BIGINT },
  content_hash: { type: DataTypes.STRING(64) },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending', validate: { isIn: [['pending', 'parsing', 'parsed', 'duplicate', 'error', 'replaced']] } },
  error_message: { type: DataTypes.TEXT },
  supersedes_id: { type: DataTypes.UUID, allowNull: true },
  correction_notes: { type: DataTypes.TEXT, allowNull: true },
  uploaded_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  parsed_at: { type: DataTypes.DATE },
}, {
  tableName: 'uploaded_files',
  timestamps: false,
  underscored: true,
  indexes: [
    { fields: ['content_hash'] },
    { fields: ['filename'] },
    { fields: ['file_type', 'status'] },
    { fields: ['uploaded_at'] },
    { fields: ['uploaded_by'] },
    { fields: ['status'] },
    { fields: ['file_type'] },
  ],
});

UploadedFile.associate = (models) => {
  UploadedFile.belongsTo(models.User, { foreignKey: 'uploaded_by' });
  UploadedFile.belongsTo(models.UploadedFile, { as: 'Supersedes', foreignKey: 'supersedes_id' });
  UploadedFile.hasOne(models.UploadedFile, { as: 'SupersededBy', foreignKey: 'supersedes_id' });
  UploadedFile.hasMany(models.Claim, { foreignKey: 'file_id' });
  UploadedFile.hasMany(models.Remittance, { foreignKey: 'file_id' });
};

module.exports = UploadedFile;
