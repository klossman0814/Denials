const sequelize = require('../config/database');
const User = require('./User');
const UploadedFile = require('./UploadedFile');
const Claim = require('./Claim');
const ClaimLine = require('./ClaimLine');
const Remittance = require('./Remittance');
const RemittanceFile = require('./RemittanceFile');
const RemittanceLine = require('./RemittanceLine');
const DenialReason = require('./DenialReason');
const Setting = require('./Setting');

User.associate?.({ UploadedFile });
UploadedFile.associate?.({ User, Claim, Remittance, RemittanceFile });
Claim.associate?.({ UploadedFile, ClaimLine, Remittance, DenialReason });
ClaimLine.associate?.({ Claim });
Remittance.associate?.({ UploadedFile, Claim, DenialReason, RemittanceFile, RemittanceLine });
RemittanceFile.associate?.({ UploadedFile, Remittance });
RemittanceLine.associate?.({ Remittance, DenialReason });
DenialReason.associate?.({ Remittance, Claim, ClaimLine, RemittanceLine });

module.exports = { sequelize, User, UploadedFile, Claim, ClaimLine, Remittance, RemittanceFile, RemittanceLine, DenialReason, Setting };
