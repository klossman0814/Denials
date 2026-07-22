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
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending', validate: { isIn: [['pending', 'parsing', 'parsed', 'duplicate', 'error']] } },
  error_message: { type: DataTypes.TEXT },
  uploaded_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  parsed_at: { type: DataTypes.DATE },
}, {
  tableName: 'uploaded_files',
  timestamps: false,
  underscored: true,
  indexes: [
    { fields: ['content_hash'] },
    { fields: ['file_type', 'status'] },
  ],
});

UploadedFile.associate = (models) => {
  UploadedFile.belongsTo(models.User, { foreignKey: 'uploaded_by' });
  UploadedFile.hasMany(models.Claim, { foreignKey: 'file_id' });
  UploadedFile.hasMany(models.Remittance, { foreignKey: 'file_id' });
};

module.exports = UploadedFile;
