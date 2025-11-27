const express = require("express");
const router = express.Router();
const progresoController = require("../controllers/progreso.controller");

// Guardar la partida
router.post("/save/:userId", progresoController.save);

// Cargar la partida
router.get("/load/:userId", progresoController.load);

module.exports = router;