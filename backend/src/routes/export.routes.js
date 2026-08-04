const { Router } = require('express');
const controller = require('../controllers/export.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

const router = Router();

// Export all 835/837 files containing given CPT/HCPCS codes into <dir>/835 and <dir>/837
router.post('/by-procedure', authenticate, requireAdmin, controller.exportByProcedure);
router.get('/jobs/:id', authenticate, requireAdmin, controller.getExportJob);

module.exports = router;
