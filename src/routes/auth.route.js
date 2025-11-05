const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/google/start', authController.googleStart);
router.get('/google/callback', authController.googleCallback);
router.get('/google/tx/:state', authController.googleTx);

// Ruta protegida para validar sesión
router.get('/validate', authMiddleware, authController.validateToken);

module.exports = router;
