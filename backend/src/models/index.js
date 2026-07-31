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
const ClaimDiagnosis = require('./ClaimDiagnosis');
const ClaimReference = require('./ClaimReference');
const ClaimAmount = require('./ClaimAmount');
const ClaimCondition = require('./ClaimCondition');
const ClaimReportType = require('./ClaimReportType');
const ClaimFileInfo = require('./ClaimFileInfo');
const ClaimToothInfo = require('./ClaimToothInfo');
const RemittanceReference = require('./RemittanceReference');
const RemittanceAmount = require('./RemittanceAmount');
const RemittanceInpatient = require('./RemittanceInpatient');
const RemittanceOutpatient = require('./RemittanceOutpatient');
const ProviderAdjustment = require('./ProviderAdjustment');
const ProviderSummary = require('./ProviderSummary');
const LqCode = require('./LqCode');
const ClaimNote = require('./ClaimNote');
const ClaimQuantity = require('./ClaimQuantity');
const ClaimMeasurement = require('./ClaimMeasurement');
const ClaimAdjustment = require('./ClaimAdjustment');
const ClaimTransaction = require('./ClaimTransaction');

const models = {
  sequelize, User, UploadedFile, Claim, ClaimLine,
  Remittance, RemittanceFile, RemittanceLine, DenialReason, Setting,
  ClaimDiagnosis, ClaimReference, ClaimAmount, ClaimCondition,
  ClaimReportType, ClaimFileInfo, ClaimToothInfo,
  RemittanceReference, RemittanceAmount,
  RemittanceInpatient, RemittanceOutpatient, ProviderAdjustment,
  ProviderSummary, LqCode,
  ClaimNote, ClaimQuantity, ClaimMeasurement, ClaimAdjustment, ClaimTransaction,
};

User.associate?.(models);
UploadedFile.associate?.(models);
Claim.associate?.(models);
ClaimLine.associate?.(models);
Remittance.associate?.(models);
RemittanceFile.associate?.(models);
RemittanceLine.associate?.(models);
DenialReason.associate?.(models);

ClaimDiagnosis.associate?.(models);
ClaimReference.associate?.(models);
ClaimAmount.associate?.(models);
ClaimCondition.associate?.(models);
ClaimReportType.associate?.(models);
ClaimFileInfo.associate?.(models);
ClaimToothInfo.associate?.(models);
RemittanceReference.associate?.(models);
RemittanceAmount.associate?.(models);
RemittanceInpatient.associate?.(models);
RemittanceOutpatient.associate?.(models);
ProviderAdjustment.associate?.(models);
ProviderSummary.associate?.(models);
LqCode.associate?.(models);
ClaimNote.associate?.(models);
ClaimQuantity.associate?.(models);
ClaimMeasurement.associate?.(models);
ClaimAdjustment.associate?.(models);
ClaimTransaction.associate?.(models);

module.exports = models;
