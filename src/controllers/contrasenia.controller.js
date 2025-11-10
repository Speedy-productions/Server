const path = require("path");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const supabase = require("../config/supabase");
const fs = require("fs");

// 📄 1. Mostrar el formulario HTML
const showForm = (req, res) => {
  const token = req.params.token;
  const filePath = path.join(__dirname, "../views/contrasenia.view.html");

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error al cargar el formulario");

    // Inyecta el token en el HTML (puede ser un <input hidden> o un script)
    const html = data.replace("{{TOKEN}}", token);
    res.send(html);
  });
};

// 📨 2. Enviar correo con link de restablecimiento
const sendMail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, error: "Falta el correo" });

  try {
    // Buscar usuario
    const { data: user, error } = await supabase
      .from("usuario")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user)
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });

    // Generar token y expiración
    const token = uuidv4();
    const expiration = Date.now() + 15 * 60 * 1000; // 15 minutos

    // Guardar token y expiración en BD
    await supabase
      .from("usuario")
      .update({
        reset_token: token,
        reset_expiration: expiration
      })
      .eq("id", user.id);

    // Enviar correo
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // true para 465, false para 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
});

    console.log("Generated token:", token);
    console.log("Expiration:", new Date(expiration));
    console.log("User ID:", user.id);

    const link = `https://serversizzle.onrender.com/contrasenia/restablecer/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Restablecer contraseña",
      text: `Aquí iría el ${link} para restablecer la contraseña.`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ ok: true, message: "Correo enviado" });

  } catch (err) {
    console.error("❌ Error al enviar el correo:", err);
    res.status(500).json({ ok: false, error: "Error al enviar el correo" });
  }
};

// 🔄 3. Restablecer la contraseña usando el token
const recuperar = async (req, res) => {
  const { token, nuevaContrasenia } = req.body;
  if (!token || !nuevaContrasenia)
    return res.status(400).json({ ok: false, error: "Faltan datos" });

  try {
    // Buscar usuario por token
    const { data: user, error } = await supabase
      .from("usuario")
      .select("*")
      .eq("reset_token", token)
      .single();

    if (error || !user)
      return res.status(400).json({ ok: false, error: "Token inválido" });

    // Validar expiración
    if (Date.now() > user.reset_expiration)
      return res.status(400).json({ ok: false, error: "El token ha expirado" });

    // Hashear nueva contraseña
    const hash = await bcrypt.hash(nuevaContrasenia, 10);

    // Actualizar contraseña y limpiar token
    await supabase
      .from("usuario")
      .update({
        contrasenia: hash,
        reset_token: null,
        reset_expiration: null
      })
      .eq("id", user.id);

    res.json({ ok: true, message: "Contraseña restablecida correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error al restablecer la contraseña" });
  }
};

module.exports = { showForm, sendMail, recuperar };
