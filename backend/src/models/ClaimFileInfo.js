const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimFileInfo = sequelize.define('ClaimFileInfo', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  text: { type: DataTypes.TEXT },
}, {
  tableName: 'claim_file_infos',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
  ],
});

ClaimFileInfo.associate = (models) => {
  ClaimFileInfo.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimFileInfo;
