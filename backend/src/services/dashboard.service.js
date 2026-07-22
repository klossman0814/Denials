const { Op, fn, col, literal } = require('sequelize');
const { Claim, Remittance, DenialReason } = require('../models');

class DashboardService {
  async getSummary() {
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
    return {
      totalClaims, totalCharges: parseFloat(totalCharges.toFixed(2)),
      totalPayments: parseFloat(totalPayments.toFixed(2)),
      totalAdjustments: parseFloat(totalAdjustments.toFixed(2)), denialRate,
      statusDistribution: statusDistribution.map(s => ({ status: s.status, count: parseInt(s.count) })),
    };
  }

  async getDenialReasons(limit = 10) {
    const reasons = await DenialReason.findAll({
      attributes: ['denial_code', 'group_code', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total_amount']],
      group: ['denial_code', 'group_code'],
      order: [[literal('"count"'), 'DESC']], limit, raw: true,
    });
    return reasons.map(r => ({
      code: r.denial_code, group: r.group_code,
      count: parseInt(r.count), totalAmount: parseFloat(r.total_amount || 0).toFixed(2),
    }));
  }

  async getTrends(days = 30) {
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
    return { claimTrends, denialTrends };
  }

  async getPayerBreakdown() {
    const payers = await Claim.findAll({
      attributes: ['payer_name', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('total_charge')), 'total_charge']],
      group: ['payer_name'], order: [[literal('"count"'), 'DESC']], raw: true,
    });
    return payers.map(p => ({
      payer: p.payer_name || 'Unknown', count: parseInt(p.count),
      totalCharge: parseFloat(p.total_charge || 0).toFixed(2),
    }));
  }

  async getAging() {
    const claims = await Claim.findAll({
      attributes: ['id', 'claim_id', 'status', 'created_at', 'patient_last_name', 'patient_first_name'],
      include: [{ model: Remittance, attributes: ['remittance_date', 'status'], required: false }],
      order: [['created_at', 'DESC']], limit: 50,
    });
    return claims.map(c => {
      const daysAging = Math.floor((new Date() - new Date(c.created_at)) / (1000 * 60 * 60 * 24));
      const resolvedDate = c.Remittances?.[0]?.remittance_date || null;
      const daysToResolve = resolvedDate
        ? Math.floor((new Date(resolvedDate) - new Date(c.created_at)) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: c.id, claimId: c.claim_id,
        patient: `${c.patient_first_name} ${c.patient_last_name}`.trim(),
        status: c.status, daysAging, daysToResolve,
      };
    });
  }
}

module.exports = new DashboardService();
