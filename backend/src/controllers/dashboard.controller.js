const dashboardService = require('../services/dashboard.service');

exports.summary = async (req, res, next) => {
  try { res.json(await dashboardService.getSummary()); }
  catch (error) { next(error); }
};

exports.denialReasons = async (req, res, next) => {
  try { res.json({ reasons: await dashboardService.getDenialReasons(parseInt(req.query.limit) || 10) }); }
  catch (error) { next(error); }
};

exports.trends = async (req, res, next) => {
  try { res.json(await dashboardService.getTrends(parseInt(req.query.days) || 30)); }
  catch (error) { next(error); }
};

exports.payerBreakdown = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const result = await dashboardService.getPayerBreakdown(limit, offset);
    res.json(result);
  } catch (error) { next(error); }
};

exports.aging = async (req, res, next) => {
  try { res.json({ aging: await dashboardService.getAging() }); }
  catch (error) { next(error); }
};
