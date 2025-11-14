const bcrypt = require("bcrypt");
const { createUser, findUserByEmailOrUsername } = require("../models/user.model");

const registrar = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    // Verifica que el usuario no exista en la base de datos
    const { data: existing } = await findUserByEmailOrUsername(email.toLowerCase());
    if (existing) {
      return res.status(400).json({ ok: false, error: "El correo ya está registrado" });
    }

    // Hashea la contraseña
    const hash = await bcrypt.hash(password, 10);

    // Se crea el usuario
    const { data, error } = await createUser(username, email.toLowerCase(), hash);

    if (error) {
      console.error(error);
      return res.status(500).json({ ok: false, error: "No se pudo crear el usuario" });
    }

    return res.json({
      ok: true,
      message: "Usuario creado correctamente",
      user: data
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

module.exports = { registrar };
