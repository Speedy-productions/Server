const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/google/start', authController.googleStart);
router.get('/google/callback', authController.googleCallback);
router.get('/google/tx/:state', authController.googleTx);

module.exports = router;
