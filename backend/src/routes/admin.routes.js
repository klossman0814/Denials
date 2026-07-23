const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { User } = require('../models');
const adminController = require('../controllers/admin.controller');

const router = Router();

router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try { res.json({ users: await User.findAll({ attributes: { exclude: ['password_hash'] } }) }); }
  catch (error) { next(error); }
});

router.post('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
    const user = await User.create({ username, email, password_hash: password, role: role || 'staff' });
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (error) { next(error); }
});

router.put('/users/:id/role', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['staff', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role. Must be "staff" or "admin".' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.role = role;
    await user.save();
    res.json({ user: user.toSafeJSON() });
  } catch (error) { next(error); }
});

// Settings (admin only)
router.get('/settings', authenticate, requireAdmin, adminController.getSettings);
router.put('/settings', authenticate, requireAdmin, adminController.updateSettings);

// Data deletion endpoints (admin only)
router.delete('/data/837', authenticate, requireAdmin, adminController.delete837Data);
router.delete('/data/835', authenticate, requireAdmin, adminController.delete835Data);
router.delete('/files', authenticate, requireAdmin, adminController.clearUploadedFiles);

module.exports = router;
