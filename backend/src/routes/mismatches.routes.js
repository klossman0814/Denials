const { Router } = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { Claim, Remittance, RemittanceFile, sequelize } = require('../models');

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const limitNum = parseInt(limit);
    const offsetNum = (parseInt(page) - 1) * limitNum;

    // === Claims with NO matching 835 remittance ===
    let claimsWhere = 'NOT EXISTS (SELECT 1 FROM "remittances" WHERE "remittances"."claim_id" = "Claim"."id")';
    const claimsReplacements = {};
    if (search) {
      claimsWhere += ` AND (
        "patient_first_name" ILIKE :search OR
        "patient_last_name" ILIKE :search OR
        "claim_id" ILIKE :search
      )`;
      claimsReplacements.search = `%${search}%`;
    }
    const claimsNo835 = await Claim.findAndCountAll({
      where: sequelize.literal(claimsWhere),
      replacements: Object.keys(claimsReplacements).length > 0 ? claimsReplacements : undefined,
      order: [['created_at', 'DESC']],
      limit: limitNum, offset: offsetNum,
    });

    // === Remittances with NO matching 837 claim ===
    const remitWhere = { claim_id: null };
    if (search) {
      remitWhere[Op.or] = [
        { patient_first_name: { [Op.iLike]: `%${search}%` } },
        { patient_last_name: { [Op.iLike]: `%${search}%` } },
        { patient_member_id: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const remitsNo837 = await Remittance.findAndCountAll({
      where: remitWhere,
      include: [{ model: RemittanceFile, attributes: ['payer_name', 'payment_date', 'total_payment'] }],
      order: [['created_at', 'DESC']],
      limit: limitNum, offset: offsetNum,
    });

    const claims = claimsNo835.rows.map(c => c.toJSON());
    const remits = remitsNo837.rows.map(r => r.toJSON());

    res.json({
      claimsNo835: claims,
      claimsNo835Total: claimsNo835.count,
      remitsNo837: remits,
      remitsNo837Total: remitsNo837.count,
      page: parseInt(page),
      totalPages: Math.ceil(Math.max(claimsNo835.count, remitsNo837.count) / limitNum),
    });
  } catch (error) { next(error); }
});

module.exports = router;
