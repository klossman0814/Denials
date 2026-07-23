const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimToothInfo = sequelize.define('ClaimToothInfo', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  oral_cavity_code: { type: DataTypes.STRING(10) },
  tooth_code: { type: DataTypes.STRING(20) },
  tooth_surface: { type: DataTypes.STRING(10) },
}, {
  tableName: 'claim_tooth_infos',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_line_id'] },
  ],
});

ClaimToothInfo.associate = (models) => {
  ClaimToothInfo.belongsTo(models.ClaimLine, { foreignKey: 'claim_line_id' });
};

module.exports = ClaimToothInfo;
