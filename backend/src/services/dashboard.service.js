const { Op, fn, col, literal } = require('sequelize');
const { Claim, Remittance, DenialReason } = require('../models');
const cache = require('../utils/queryCache');

class DashboardService {
  async getSummary() {
    const cached = await cache.get('dashboard:summary');
    if (cached) return cached;
    const totalClaims = await Claim.count();
    const statusDistribution = await Claim.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'], raw: true,
    });
    const totalCharges = await Claim.sum('total_charge') || 0;
    const totalPayments = await Remittance.sum('total_paid') || 0;
    const totalAdjustments = await Remittance.sum('adjustment_amount') || 0;
    const deniedCount = statusDistribution.find(s => s.status === 'denied')?.count || 0;
    const denialRate = totalClaims > 0 ? parseFloat((deniedCount / totalClaims * 100).toFixed(1)) : 0;
    const deniedAmount = await Claim.sum('total_charge', { where: { status: 'denied' } }) || 0;
    const avgResolutionDays = await Claim.findOne({
      attributes: [
        [fn('AVG', col('days_to_resolve')), 'avg_days'],
      ],
      where: { status: { [Op.in]: ['paid', 'denied', 'partial'] }, days_to_resolve: { [Op.gte]: 0 } },
      raw: true,
    });
    const result = {
      totalClaims, totalCharges: parseFloat(totalCharges.toFixed(2)),
      totalPayments: parseFloat(totalPayments.toFixed(2)),
      totalAdjustments: parseFloat(totalAdjustments.toFixed(2)), denialRate,
      deniedCount, deniedAmount: parseFloat(deniedAmount.toFixed(2)),
      avgResolutionDays: avgResolutionDays?.avg_days ? parseFloat(parseFloat(avgResolutionDays.avg_days).toFixed(2)) : 0,
      statusDistribution: statusDistribution.map(s => ({ status: s.status, count: parseInt(s.count) })),
    };
    await cache.set('dashboard:summary', result);
    return result;
  }

  async getDenialReasons(limit = 10) {
    const cacheKey = `dashboard:denialReasons:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
    const reasons = await DenialReason.findAll({
      attributes: ['denial_code', 'group_code', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total_amount']],
      group: ['denial_code', 'group_code'],
      order: [[literal('"count"'), 'DESC']], limit, raw: true,
    });
    const result = reasons.map(r => ({
      code: r.denial_code, group: r.group_code,
      count: parseInt(r.count), totalAmount: parseFloat(r.total_amount || 0).toFixed(2),
    }));
    await cache.set(cacheKey, result);
    return result;
  }

  async getTrends(days = 30) {
    const cacheKey = `dashboard:trends:${days}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
    const since = new Date(); since.setDate(since.getDate() - days);
    const claimTrends = await Claim.findAll({
      attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
      where: { created_at: { [Op.gte]: since } },
      group: [fn('DATE', col('created_at'))], order: [[fn('DATE', col('created_at')), 'ASC']], raw: true,
    });
    const denialTrends = await DenialReason.findAll({
      attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
      where: { created_at: { [Op.gte]: since } },
      group: [fn('DATE', col('created_at'))], order: [[fn('DATE', col('created_at')), 'ASC']], raw: true,
    });
    const result = { claimTrends, denialTrends };
    await cache.set(cacheKey, result);
    return result;
  }

  async getPayerBreakdown(limit = 10, offset = 0) {
    const cacheKey = `dashboard:payerBreakdown:${limit}:${offset}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
    const payers = await Claim.findAll({
      attributes: ['payer_name', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('total_charge')), 'total_charge']],
      group: ['payer_name'], order: [[literal('"count"'), 'DESC']],
      limit, offset, raw: true,
    });
    const breakdown = payers.map(p => ({
      payer: p.payer_name || 'Unknown', count: parseInt(p.count),
      totalCharge: parseFloat(p.total_charge || 0).toFixed(2),
    }));
    // Total distinct payers for pagination
    const totalResult = await Claim.findAll({
      attributes: [[fn('COUNT', fn('DISTINCT', col('payer_name'))), 'total']],
      raw: true,
    });
    const total = parseInt(totalResult[0]?.total || 0);
    const result = { breakdown, total };
    await cache.set(cacheKey, result);
    return result;
  }

  async getAging() {
    const cached = await cache.get('dashboard:aging');
    if (cached) return cached;
    const buckets = await Claim.findAll({
      attributes: [
        [
          literal(`CASE
            WHEN COALESCE("service_date_start", "service_date_end", NULLIF("bht_date", '')::date, "created_at"::date) >= CURRENT_DATE - INTERVAL '30 days' THEN '0-30 days'
            WHEN COALESCE("service_date_start", "service_date_end", NULLIF("bht_date", '')::date, "created_at"::date) >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60 days'
            WHEN COALESCE("service_date_start", "service_date_end", NULLIF("bht_date", '')::date, "created_at"::date) >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90 days'
            WHEN COALESCE("service_date_start", "service_date_end", NULLIF("bht_date", '')::date, "created_at"::date) >= CURRENT_DATE - INTERVAL '120 days' THEN '91-120 days'
            ELSE '120+ days'
          END`),
          'bucket',
        ],
        [fn('COUNT', col('id')), 'count'],
        [fn('COALESCE', fn('SUM', col('total_charge')), 0), 'total_charge'],
      ],
      group: [literal('bucket')],
      order: [[literal('MIN(COALESCE("service_date_start", "service_date_end", NULLIF("bht_date", \'\')::date, "created_at"::date))'), 'ASC']],
      raw: true,
    });

    // Ensure all buckets are present even if empty
    const allBuckets = ['0-30 days', '31-60 days', '61-90 days', '91-120 days', '120+ days'];
    const bucketMap = {};
    buckets.forEach(b => { bucketMap[b.bucket] = { count: parseInt(b.count), totalCharge: parseFloat(b.total_charge) }; });
    const result = allBuckets.map(bucket => ({
      bucket,
      count: bucketMap[bucket]?.count || 0,
      totalCharge: bucketMap[bucket]?.totalCharge || 0,
    }));

    await cache.set('dashboard:aging', result);
    return result;
  }
}

module.exports = new DashboardService();