const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimDiagnosis = sequelize.define('ClaimDiagnosis', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  diagnosis_type: { type: DataTypes.STRING(30) }, // principal, admitting, other, external_cause, patient_reason
  qualifier: { type: DataTypes.STRING(10) }, // ABK, BK, ABF, BF, ABJ, BR, etc.
  code: { type: DataTypes.STRING(30) },
  sequence: { type: DataTypes.INTEGER },
}, {
  tableName: 'claim_diagnoses',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['claim_id'] },
    { fields: ['code'] },
    { fields: ['diagnosis_type'] },
  ],
});

ClaimDiagnosis.associate = (models) => {
  ClaimDiagnosis.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimDiagnosis;
