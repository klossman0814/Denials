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
  try { res.json({ breakdown: await dashboardService.getPayerBreakdown() }); }
  catch (error) { next(error); }
};

exports.aging = async (req, res, next) => {
  try { res.json({ aging: await dashboardService.getAging() }); }
  catch (error) { next(error); }
};
