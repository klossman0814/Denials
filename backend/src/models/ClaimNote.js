const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 837 NTE segment — claim notes
const ClaimNote = sequelize.define('ClaimNote', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  note_reference_code: { type: DataTypes.STRING(5) },
  note_text: { type: DataTypes.TEXT },
}, {
  tableName: 'claim_notes',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['claim_id'] }],
});

ClaimNote.associate = (models) => {
  ClaimNote.belongsTo(models.Claim, { foreignKey: 'claim_id' });
};

module.exports = ClaimNote;
