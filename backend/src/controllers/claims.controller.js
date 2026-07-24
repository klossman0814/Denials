const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Claim, ClaimLine, Remittance, RemittanceLine, RemittanceFile, DenialReason } = require('../models');

exports.listClaims = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, payer, search, dateFrom, dateTo } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (status) where.status = status;
    if (payer) where.payer_name = { [Op.iLike]: `%${payer}%` };
    if (search) {
      where[Op.or] = [
        { patient_first_name: { [Op.iLike]: `%${search}%` } },
        { patient_last_name: { [Op.iLike]: `%${search}%` } },
        { claim_id: { [Op.iLike]: `%${search}%` } },
        { subscriber_id: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (dateFrom || dateTo) {
      where.service_date_start = {};
      if (dateFrom) where.service_date_start[Op.gte] = dateFrom;
      if (dateTo) where.service_date_start[Op.lte] = dateTo;
    }
    const { rows, count } = await Claim.findAndCountAll({
      where,
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COALESCE(SUM("total_paid"), 0)
              FROM "remittances"
              WHERE "remittances"."claim_id" = "Claim"."id"
            )`),
            'total_paid',
          ],
        ],
      },
      order: [['created_at', 'DESC']], limit: parseInt(limit), offset,
    });

    const claims = rows.map(c => c.toJSON());

    res.json({ claims, total: count, page: parseInt(page), totalPages: Math.ceil(count / parseInt(limit)) });
  } catch (error) { next(error); }
};

exports.getClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findByPk(req.params.id, {
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COALESCE(SUM("total_paid"), 0)
              FROM "remittances"
              WHERE "remittances"."claim_id" = "Claim"."id"
            )`),
            'total_paid',
          ],
        ],
      },
      include: [
        { model: ClaimLine },
        {
          model: Remittance,
          include: [
            { model: DenialReason },
            { model: RemittanceLine, include: [{ model: DenialReason }] },
            { model: RemittanceFile, attributes: ['payer_name', 'payer_id_code', 'total_payment', 'payment_date', 'trace_number', 'payment_method'] },
          ],
        },
        { model: DenialReason },
      ],
    });
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json({ claim });
  } catch (error) { next(error); }
};

exports.getClaimDenials = async (req, res, next) => {
  try {
    const denials = await DenialReason.findAll({
      where: { claim_id: req.params.id },
      include: [{ model: Remittance }],
      order: [['created_at', 'DESC']],
    });
    res.json({ denials });
  } catch (error) { next(error); }
};
