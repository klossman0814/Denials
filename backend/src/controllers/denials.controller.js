const { Op, fn, col, literal } = require('sequelize');
const { DenialReason, Claim } = require('../models');

exports.listDenials = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, search, denial_code, payer, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (denial_code) where.denial_code = denial_code;
    if (search) {
      where[Op.or] = [
        { denial_code: { [Op.iLike]: `%${search}%` } },
        { reason_description: { [Op.iLike]: `%${search}%` } },
        { '$Claim.claim_id$': { [Op.iLike]: `%${search}%` } },
        { '$Claim.patient_first_name$': { [Op.iLike]: `%${search}%` } },
        { '$Claim.patient_last_name$': { [Op.iLike]: `%${search}%` } },
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
        attributes: ['denial_code', [fn('COUNT', col('id')), 'count']],
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
      return {
        id: json.id,
        denialCode: json.denial_code,
        groupCode: json.group_code,
        amount: parseFloat(json.amount || 0),
        reasonDescription: json.reason_description,
        createdAt: json.created_at,
        claimId: claim.id,
        claimNumber: claim.claim_id,
        patientName: `${claim.patient_first_name || ''} ${claim.patient_last_name || ''}`.trim() || null,
        patientDOB: claim.patient_dob,
        subscriberId: claim.subscriber_id,
        payerName: claim.payer_name,
        providerName: claim.provider_name,
        providerNPI: claim.provider_npi,
        serviceDateStart: claim.service_date_start,
        serviceDateEnd: claim.service_date_end,
        claimStatus: claim.status,
        procedureCode: null,
        remittanceDate: null,
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
