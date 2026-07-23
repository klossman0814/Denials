const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimReportType = sequelize.define('ClaimReportType', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code: { type: DataTypes.STRING(10) },
  qualifier: { type: DataTypes.STRING(5) },
  attachment_transmission_code: { type: DataTypes.STRING(5) },
}, {
  tableName: 'claim_report_types',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
  ],
});

ClaimReportType.associate = (models) => {
  ClaimReportType.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimReportType;
