const express = require("express");
const router = express.Router();
const { registrar } = require("../controllers/user.controller");

router.post("/registrar", registrar);

module.exports = router;
