const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 837 MEA segment — measurements (e.g., patient weight, height)
const ClaimMeasurement = sequelize.define('ClaimMeasurement', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  measurement_reference: { type: DataTypes.STRING(5) }, // MEA01
  qualifier: { type: DataTypes.STRING(5) },            // MEA02
  value: { type: DataTypes.DECIMAL(12, 2) },           // MEA03
  unit: { type: DataTypes.STRING(10) },                // MEA04
}, {
  tableName: 'claim_measurements',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['claim_id'] }],
});

ClaimMeasurement.associate = (models) => {
  ClaimMeasurement.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimMeasurement;
