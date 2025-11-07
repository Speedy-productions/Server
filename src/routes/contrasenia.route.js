const express = require("express");
const router = express.Router();
const contraseniaController = require("../controllers/contrasenia.controller");

// Mostrar formulario HTML
router.get("/restablecer/:token", contraseniaController.showForm);

// Enviar correo con link para restablecer contraseña
router.post("/send-mail", contraseniaController.sendMail);

// Restablecer contraseña (token y nueva contraseña)
router.post("/recuperar", contraseniaController.recuperar);

module.exports = router;
