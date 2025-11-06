const express = require('express');
const router = express.Router();
const contraseniaController = require('../controllers/contrasenia.controller.js');

router.get('/contrasenia', contraseniaController.showForm);

module.exports = router;