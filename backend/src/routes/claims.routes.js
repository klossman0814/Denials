const { Router } = require('express');
const controller = require('../controllers/claims.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();
router.get('/', authenticate, controller.listClaims);
router.get('/:id', authenticate, controller.getClaim);
router.get('/:id/denials', authenticate, controller.getClaimDenials);

module.exports = router;
