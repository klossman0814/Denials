const { Router } = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { sequelize, Claim, Remittance, RemittanceFile, DenialReason } = require('../models');
const cache = require('../utils/queryCache');

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const cached = await cache.get('executive:summary');
    if (cached) return res.json(cached);

    // === KPI Metrics (simple counts and sums) ===
    const totalCharges = await Claim.sum('total_charge').then(r => r || 0);
    const totalPayments = await Remittance.sum('total_paid').then(r => r || 0);
    const totalAdjustments = await Remittance.sum('adjustment_amount').then(r => r || 0);

    const statusDist = await Claim.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('total_charge')), 'total']],
      group: ['status'], raw: true,
    });

    const totalClaims = statusDist.reduce((s, r) => s + parseInt(r.count), 0);
    const deniedStats = statusDist.find(s => s.status === 'denied') || {};
    const deniedCount = parseInt(deniedStats.count || 0);
    const deniedAmount = parseFloat(deniedStats.total || 0);
    const denialRate = totalClaims > 0 ? parseFloat((deniedCount / totalClaims * 100).toFixed(2)) : 0;
    const collectionRate = totalCharges > 0 ? parseFloat((totalPayments / totalCharges * 100).toFixed(2)) : 0;

    const matchCount = await sequelize.query(
      'SELECT COUNT(*) FROM claims c WHERE EXISTS (SELECT 1 FROM remittances r WHERE r.claim_id = c.id)',
      { type: sequelize.QueryTypes.SELECT, plain: true }
    ).then(r => parseInt(r.count, 10));
    const matchRate = totalClaims > 0 ? parseFloat((matchCount / totalClaims * 100).toFixed(2)) : 0;

    const avgDays = await Claim.findOne({
      attributes: [[fn('AVG', col('days_to_resolve')), 'avg']],
      where: { days_to_resolve: { [Op.gte]: 0 } },
      raw: true,
    });

    const remitCount = await Remittance.count();
    const matchedRemits = await Remittance.count({ where: { claim_id: { [Op.ne]: null } } });

    // === Monthly Revenue Trends (simplified to last 12 months) ===
    const monthlyRevenue = await sequelize.query(
      `SELECT
        to_char(DATE_TRUNC('month', COALESCE(r.remittance_date, c.service_date_start, c.created_at::date)), 'YYYY-MM') AS month,
        COUNT(DISTINCT c.id) AS claim_count,
        ROUND(COALESCE(SUM(c.total_charge), 0)::numeric, 2) AS total_charges,
        ROUND(COALESCE(SUM(r.total_paid), 0)::numeric, 2) AS total_payments,
        ROUND(COALESCE(SUM(r.adjustment_amount), 0)::numeric, 2) AS total_adjustments
       FROM claims c
       LEFT JOIN remittances r ON r.claim_id = c.id
       WHERE COALESCE(r.remittance_date, c.service_date_start, c.created_at::date) >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY 1 ORDER BY 1 ASC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    // === Payer Scorecard (top 10 by charges, simplified) ===
    const payerScorecard = await Promise.resolve().then(() =>
      sequelize.query(
        `SELECT
          c.payer_name,
          COUNT(DISTINCT c.id) AS claim_count,
          ROUND(COALESCE(SUM(c.total_charge), 0)::numeric, 2) AS total_charges,
          ROUND(COALESCE(SUM(r.total_paid), 0)::numeric, 2) AS total_payments,
          ROUND(COALESCE(SUM(r.adjustment_amount), 0)::numeric, 2) AS total_adjustments,
          ROUND(AVG(c.days_to_resolve) FILTER (WHERE c.days_to_resolve >= 0), 1) AS avg_days_to_resolve
         FROM claims c
         LEFT JOIN remittances r ON r.claim_id = c.id
         WHERE c.payer_name IS NOT NULL AND c.payer_name != ''
         GROUP BY c.payer_name
         ORDER BY total_charges DESC
         LIMIT 10`,
        { type: sequelize.QueryTypes.SELECT }
      )
    );

    // === Top Denial Codes by Financial Impact ===
    const topDenials = await DenialReason.findAll({
      attributes: ['denial_code', [fn('COUNT', col('DenialReason.id')), 'count'], [fn('SUM', col('DenialReason.amount')), 'total_amount']],
      group: ['denial_code'],
      order: [[literal('"total_amount"'), 'DESC']],
      limit: 10,
      raw: true,
    });

    // === Aging Summary ===
    const agingSummary = await Claim.findAll({
      attributes: [
        [literal(`CASE
          WHEN COALESCE(service_date_start, service_date_end, NULLIF(bht_date, '')::date, created_at::date) >= CURRENT_DATE - INTERVAL '30 days' THEN '0-30'
          WHEN COALESCE(service_date_start, service_date_end, NULLIF(bht_date, '')::date, created_at::date) >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60'
          WHEN COALESCE(service_date_start, service_date_end, NULLIF(bht_date, '')::date, created_at::date) >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90'
          WHEN COALESCE(service_date_start, service_date_end, NULLIF(bht_date, '')::date, created_at::date) >= CURRENT_DATE - INTERVAL '120 days' THEN '91-120'
          ELSE '120+'
        END`), 'bucket'],
        [fn('COUNT', col('id')), 'count'],
        [fn('COALESCE', fn('SUM', col('total_charge')), 0), 'total_charge'],
      ],
      group: [literal(1)],
      order: [[literal(1), 'ASC']],
      raw: true,
    });

    const result = {
      kpi: {
        totalCharges: parseFloat(totalCharges.toFixed(2)),
        totalPayments: parseFloat(totalPayments.toFixed(2)),
        totalAdjustments: parseFloat(totalAdjustments.toFixed(2)),
        netRevenue: parseFloat((totalPayments - totalAdjustments).toFixed(2)),
        denialRate,
        collectionRate,
        matchRate,
        avgDaysToResolve: avgDays?.avg ? parseFloat(parseFloat(avgDays.avg).toFixed(1)) : 0,
        totalClaims,
        deniedCount,
        deniedAmount: parseFloat(deniedAmount.toFixed(2)),
        totalRemittances: remitCount,
        matchedRemittances: matchedRemits,
      },
      monthlyRevenue,
      payerScorecard,
      topDenials: topDenials.map(d => ({
        code: d.denial_code,
        count: parseInt(d.count),
        totalAmount: parseFloat(d.total_amount || 0),
      })),
      agingSummary,
    };

    await cache.set('executive:summary', result, 1800000);
    res.json(result);
  } catch (error) { next(error); }
});

module.exports = router;
