const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 835 LQ segment — industry code / remark code (e.g., LQ*HE*N290)
const LqCode = sequelize.define('LqCode', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  qualifier: { type: DataTypes.STRING(10) },
  code: { type: DataTypes.STRING(50) },
  description: { type: DataTypes.STRING(200) },
}, {
  tableName: 'lq_codes',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['remittance_id'] },
    { fields: ['remittance_file_id'] },
  ],
});

LqCode.associate = (models) => {
  LqCode.belongsTo(models.Remittance, { foreignKey: 'remittance_id' });
  LqCode.belongsTo(models.RemittanceFile, { foreignKey: 'remittance_file_id' });
};

module.exports = LqCode;
