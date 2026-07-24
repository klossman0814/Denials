const { Router } = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { Claim, Remittance, DenialReason, sequelize } = require('../models');

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const limitNum = parseInt(limit);
    const offsetNum = (parseInt(page) - 1) * limitNum;

    const conditions = [
      sequelize.literal('EXISTS (SELECT 1 FROM "remittances" WHERE "remittances"."claim_id" = "Claim"."id")'),
    ];
    if (search) {
      conditions.push({
        [Op.or]: [
          { patient_first_name: { [Op.iLike]: `%${search}%` } },
          { patient_last_name: { [Op.iLike]: `%${search}%` } },
          { claim_id: { [Op.iLike]: `%${search}%` } },
          { payer_name: { [Op.iLike]: `%${search}%` } },
        ],
      });
    }
    const where = { [Op.and]: conditions };

    const { rows, count } = await Claim.findAndCountAll({
      where,
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) FROM "remittances" WHERE "remittances"."claim_id" = "Claim"."id"
            )`),
            'remittance_count',
          ],
          [
            sequelize.literal(`(
              SELECT COALESCE(SUM("total_paid"), 0) FROM "remittances" WHERE "remittances"."claim_id" = "Claim"."id"
            )`),
            'total_paid',
          ],
          [
            sequelize.literal(`(
              SELECT "remittance_date" FROM "remittances" WHERE "remittances"."claim_id" = "Claim"."id" ORDER BY "created_at" DESC LIMIT 1
            )`),
            'last_remittance_date',
          ],
          [
            sequelize.literal(`(
              SELECT STRING_AGG(DISTINCT "status", ', ') FROM "remittances" WHERE "remittances"."claim_id" = "Claim"."id"
            )`),
            'remittance_statuses',
          ],
        ],
      },
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset: offsetNum,
    });

    const claims = rows.map(c => c.toJSON());

    // Get denial summary for each claim
    const claimIds = claims.map(c => c.id);
    const denialSummary = claimIds.length > 0 ? await DenialReason.findAll({
      attributes: [
        'claim_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'denial_count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'denial_total'],
      ],
      where: { claim_id: { [Op.in]: claimIds } },
      group: ['claim_id'],
      raw: true,
    }) : [];
    const denialMap = {};
    denialSummary.forEach(d => { denialMap[d.claim_id] = { count: parseInt(d.denial_count), total: parseFloat(d.denial_total || 0) }; });

    const enriched = claims.map(c => ({
      ...c,
      denialCount: denialMap[c.id]?.count || 0,
      denialTotal: denialMap[c.id]?.total || 0,
    }));

    res.json({
      claims: enriched,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limitNum),
    });
  } catch (error) { next(error); }
});

module.exports = router;
