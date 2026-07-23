const { Op, fn, col, literal } = require('sequelize');
const { DenialReason, Claim, ClaimLine, RemittanceLine } = require('../models');

// CAS reason code descriptions (industry-standard)
const CAS_DESCRIPTIONS = {
  'CO': 'Contractual Obligation',
  'PR': 'Patient Responsibility',
  'OA': 'Other Adjustment',
  'PI': 'Payer Initiated',
  'CR': 'Contractual',
  'CO-1': 'Deductible',
  'CO-2': 'Coinsurance',
  'CO-3': 'Co-payment',
  'CO-4': 'Non-covered service',
  'CO-22': 'Payment adjusted based on prior payer(s) payments',
  'CO-23': 'Payment adjusted because charge exceeds fee schedule',
  'CO-29': 'Payment reduced or denied based on time limits',
  'CO-45': 'Charge exceeds fee schedule/maximum allowable',
  'CO-50': 'Payment adjusted based on multiple procedure rule',
  'CO-51': 'Payment denied based on medical necessity',
  'CO-97': 'The benefit for this service is included in the payment/allowance for another service',
  'CO-109': 'Claim/service not covered by this payer/contractor',
  'CO-151': 'Payment denied based on clinical validity',
  'CO-204': 'This service/equipment/drug is not covered under the patient\'s current benefit plan',
  'PR-1': 'Deductible amount',
  'PR-2': 'Coinsurance amount',
  'PR-3': 'Co-payment amount',
  'PR-4': 'Non-covered charge',
  'PR-6': 'Prior payer(s)\'s payment',
  'OA-23': 'Payment adjusted because charge exceeds fee schedule',
  'OA-30': 'Payment adjusted because patient is under age limit',
  'OA-92': 'Payment reduced due to manual review',
  'OA-100': 'Payment made to patient/insured',
  'OA-106': 'Payment adjusted based on a contractual agreement',
  'OA-108': 'Payment adjusted based on a bundling/multiple procedure rule',
  'OA-109': 'Claim/service not covered by this payer/contractor',
  'OA-110': 'Payment adjusted because service not authorized',
  'PI-1': 'Payer responsibility for this claim/service',
  'PI-30': 'Patient is under age limit',
};

function getReasonDescription(denialCode, existingDescription) {
  if (existingDescription && existingDescription !== '—') return existingDescription;
  if (!denialCode) return null;
  // Try full code first (e.g., "CO-45"), then group code (e.g., "CO")
  return CAS_DESCRIPTIONS[denialCode] || CAS_DESCRIPTIONS[denialCode.split('-')[0]] || null;
}

exports.listDenials = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, search, denial_code, payer, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (denial_code) where.denial_code = denial_code;
    if (search) {
      const escaped = search.replace(/'/g, "''");
      where[Op.or] = [
        literal(`"DenialReason"."denial_code" ILIKE '%${escaped}%'`),
        literal(`"DenialReason"."reason_description" ILIKE '%${escaped}%'`),
        literal(`"Claim"."claim_id" ILIKE '%${escaped}%'`),
        literal(`"Claim"."patient_first_name" ILIKE '%${escaped}%'`),
        literal(`"Claim"."patient_last_name" ILIKE '%${escaped}%'`),
      ];
    }

    const claimWhere = {};
    if (payer) claimWhere.payer_name = { [Op.iLike]: `%${payer}%` };
    if (status) claimWhere.status = status;

    const { rows, count } = await DenialReason.findAndCountAll({
      where,
      include: [
        {
          model: Claim,
          where: Object.keys(claimWhere).length ? claimWhere : undefined,
          attributes: [
            'id', 'claim_id', 'patient_last_name', 'patient_first_name',
            'patient_dob', 'subscriber_id', 'payer_name', 'provider_name',
            'provider_npi', 'total_charge', 'service_date_start', 'service_date_end', 'status',
          ],
          required: true,
        },
        {
          model: ClaimLine,
          attributes: ['procedure_code', 'service_date'],
          required: false,
        },
        {
          model: RemittanceLine,
          attributes: ['procedure_code', 'service_date'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      distinct: true,
    });

    // Summary + top code — only on page 1 (expensive aggregations)
    let summary = {
      totalDenials: 0, totalDeniedAmount: 0,
      uniqueCodes: 0, payersAffected: 0, topCode: null,
    };

    if (parseInt(page) === 1) {
      const summaryQuery = await DenialReason.findAll({
        attributes: [
          [fn('COUNT', col('DenialReason.id')), 'totalDenials'],
          [fn('COALESCE', fn('SUM', col('DenialReason.amount')), 0), 'totalDeniedAmount'],
          [fn('COUNT', literal('DISTINCT "DenialReason"."denial_code"')), 'uniqueCodes'],
          [fn('COUNT', literal('DISTINCT "Claim"."payer_name"')), 'payersAffected'],
        ],
        include: [{ model: Claim, attributes: [], required: true }],
        where: where,
        raw: true,
      });

      const topCode = await DenialReason.findAll({
        attributes: ['denial_code', [fn('COUNT', col('DenialReason.id')), 'count']],
        include: [{ model: Claim, attributes: [], required: true }],
        where,
        group: ['denial_code'],
        order: [[literal('"count"'), 'DESC']],
        limit: 1,
        raw: true,
      });

      summary = {
        totalDenials: parseInt(summaryQuery[0]?.totalDenials || 0),
        totalDeniedAmount: parseFloat(summaryQuery[0]?.totalDeniedAmount || 0),
        uniqueCodes: parseInt(summaryQuery[0]?.uniqueCodes || 0),
        payersAffected: parseInt(summaryQuery[0]?.payersAffected || 0),
        topCode: topCode.length ? { code: topCode[0].denial_code, count: parseInt(topCode[0].count) } : null,
      };
    }

    const denials = rows.map(d => {
      const json = d.toJSON();
      const claim = json.Claim || {};
      const claimLine = json.ClaimLine || {};
      const remittanceLine = json.RemittanceLine || {};

      // Procedure code: check RemittanceLine first (835 line-level), then ClaimLine (837 line-level)
      const procedureCode = remittanceLine?.procedure_code || claimLine?.procedure_code || null;

      // Service date: check RemittanceLine first (line-level denial), then Claim
      const serviceDateStart = remittanceLine?.service_date || claim.service_date_start || null;

      // Reason description: use CAS lookup if empty
      const reasonDescription = getReasonDescription(json.denial_code, json.reason_description);

      return {
        id: json.id,
        denialCode: json.denial_code,
        groupCode: json.group_code,
        amount: parseFloat(json.amount || 0),
        reasonDescription,
        createdAt: json.created_at,
        claimId: claim.id,
        claimNumber: claim.claim_id,
        patientName: `${claim.patient_first_name || ''} ${claim.patient_last_name || ''}`.trim() || null,
        patientDOB: claim.patient_dob,
        subscriberId: claim.subscriber_id,
        payerName: claim.payer_name,
        providerName: claim.provider_name,
        providerNPI: claim.provider_npi,
        serviceDateStart,
        serviceDateEnd: claim.service_date_end,
        claimStatus: claim.status,
        procedureCode,
        remittanceDate: json.remittance_date,
      };
    });

    res.json({
      denials,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
      summary,
    });
  } catch (error) {
    next(error);
  }
};
