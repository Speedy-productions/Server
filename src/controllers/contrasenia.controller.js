// controllers/contrasenia.controller.js
const path = require("path");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { Resend } = require("resend");
const supabase = require("../config/supabase");
const fs = require("fs");

const resend = new Resend(process.env.RESEND_API_KEY);

// 📄 1. Mostrar el formulario HTML (igual que ya lo tienes)
const showForm = (req, res) => {
  const token = req.params.token;
  const filePath = path.join(__dirname, "../views/contrasenia.view.html");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error al cargar el formulario");
    const html = data.replace("{{TOKEN}}", token);
    res.send(html);
  });
};

// 📨 2. Enviar correo con link de restablecimiento (Resend)
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

    if (error || !user) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    }

    // Generar token y expiración (15 min)
    const token = uuidv4();
    const expiration = Date.now() + 15 * 60 * 1000;

    await supabase
      .from("usuario")
      .update({
        reset_token: token,
        reset_expiration: expiration
      })
      .eq("id", user.id);

    // Construir link al formulario
    const link = `https://serversizzle.onrender.com/contrasenia/restablecer/${token}`;

    // Enviar con Resend
    const { data, error: sendError } = await resend.emails.send({
      // Para producción: usa un remitente de TU DOMINIO verificado en Resend, ejemplo:
      // from: "Soporte <no-reply@tudominio.com>",
      // Mientras pruebas puedes usar el sender de onboarding de Resend:
      from: "Sizzle Mail <no-reply@sizzle-mail.lat>",
      to: email,
      subject: "Restablecer contraseña",
      html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;">
          <h2>Restablecer tu contraseña</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña. Este enlace expira en <strong>15 minutos</strong>.</p>
          <p><a href="${link}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0ea5e9;color:white;text-decoration:none">Restablecer contraseña</a></p>
          <p>Si no solicitaste esto, ignora este correo.</p>
        </div>`,
      text: `Usa este enlace para restablecer tu contraseña (expira en 15 minutos): ${link}`
    });

    if (sendError) {
      console.error("❌ Resend error:", sendError);
      return res.status(500).json({ ok: false, error: "No se pudo enviar el correo" });
    }

    // Logs útiles (no sensibles)
    console.log("Generated token:", token);
    console.log("Expiration:", new Date(expiration));
    console.log("User ID:", user.id);
    console.log("Resend message id:", data?.id);

    return res.json({ ok: true, message: "Correo enviado" });
  } catch (err) {
    console.error("❌ Error al enviar el correo:", err);
    return res.status(500).json({ ok: false, error: "Error al enviar el correo" });
  }
};

// 🔄 3. Restablecer la contraseña (igual que ya lo tienes)
const recuperar = async (req, res) => {
  const { token, nuevaContrasenia } = req.body;
  if (!token || !nuevaContrasenia)
    return res.status(400).json({ ok: false, error: "Faltan datos" });

  try {
    const { data: user, error } = await supabase
      .from("usuario")
      .select("*")
      .eq("reset_token", token)
      .single();

    if (error || !user)
      return res.status(400).json({ ok: false, error: "Token inválido" });

    if (Date.now() > user.reset_expiration)
      return res.status(400).json({ ok: false, error: "El token ha expirado" });

    const hash = await bcrypt.hash(nuevaContrasenia, 10);

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
