// ###############################################
// index.js — Express + MariaDB + bcrypt (login + register)
// Resumen :
// - La comunicación entre el juego (Unity) y esta API viaja por HTTPS gracias a ngrok (TLS).
// - Las contraseñas NO se guardan en texto plano: se hashean con bcrypt.
// - /auth/register crea usuarios nuevos con email y usuario únicos.
// - /auth/login valida credenciales comparando el bcrypt del servidor.
// - CORS habilitado para permitir llamadas desde el cliente en desarrollo.
// ###############################################
require('dotenv').config();

const express = require('express');
const http    = require('http');        // Se corre en HTTP local; ngrok da HTTPS.
const mariadb = require('mariadb');
const cors    = require('cors');
const bcrypt  = require('bcrypt');

const app = express();

// Parseo JSON con límite razonable
app.use(express.json({ limit: '256kb' }));

// CORS abierto para desarrollo 
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));

// ------- Pool MariaDB -------
// Variables de entorno esperadas (ej. .env):
// DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, APP_PORT
const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sizzle',
  connectionLimit: 5,
});

// ================== Rutas básicas ==================
app.get('/health', (_req, res) => {
  // Endpoint de verificación simple 
  res.json({ ok: true, message: 'Server up' });
});

// ================== AUTH: REGISTER ==================
// Body: { username, email, password }
// Valida y crea un usuario con contraseña hasheada (bcrypt).
app.post('/auth/register', async (req, res) => {
  try {
    const username = (req.body?.username || '').trim();
    const email    = (req.body?.email    || '').trim().toLowerCase();
    const password = (req.body?.password || '');

    // Validaciones mínimas
    if (!username || !email || !password)
      return res.status(400).json({ ok:false, error:'Faltan campos' });

    if (username.length < 3 || username.length > 32)
      return res.status(400).json({ ok:false, error:'Usuario 3-32 chars' });

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk)
      return res.status(400).json({ ok:false, error:'Email inválido' });

    if (password.length < 4 || password.length > 100)
      return res.status(400).json({ ok:false, error:'Contraseña 4-100 chars' });

    let conn;
    try {
      conn = await pool.getConnection();

      // Unicidad: ni email ni usuario deben existir
      const exist = await conn.query(
        `SELECT Id FROM usuario WHERE Email = ? OR NombreUsuario = ? LIMIT 1`,
        [email, username]
      );
      if (exist && exist.length > 0)
        return res.status(409).json({ ok:false, error:'Usuario o email ya existe' });

      // Hash de contraseña (bcrypt)
      const hash = await bcrypt.hash(password, 10);

      const result = await conn.query(
        `INSERT INTO usuario (NombreUsuario, Email, Contrasenia)
         VALUES (?, ?, ?)`,
        [username, email, hash]
      );

      const newId = Number(result?.insertId);

      return res.json({
        ok: true,
        user: { id: newId, nombre: username, email }
      });
    } catch (_e) {
      return res.status(500).json({ ok:false, error:'Error del servidor' });
    } finally {
      if (conn) conn.release();
    }
  } catch (_e) {
    return res.status(500).json({ ok:false, error:'Error' });
  }
});

// ================== AUTH: LOGIN ==================
// Body: { emailOrUser, password }
// Busca por email o username y compara con bcrypt.
app.post('/auth/login', async (req, res) => {
  const emailOrUser = (req.body?.emailOrUser || '').trim();
  const password    = req.body?.password || '';

  if (!emailOrUser || !password)
    return res.status(400).json({ ok:false, error:'Faltan credenciales' });

  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      `SELECT Id, NombreUsuario, Email, Contrasenia
       FROM usuario
       WHERE Email = ? OR NombreUsuario = ?
       LIMIT 1`,
      [emailOrUser, emailOrUser]
    );

    if (!rows || rows.length === 0)
      return res.status(401).json({ ok:false, error:'Credenciales inválidas' });

    const u = rows[0];
    const hash = u.Contrasenia || '';

    let ok = false;
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
      ok = await bcrypt.compare(password, hash);
    } else {
      ok = (password === hash); 
    }

    if (!ok)
      return res.status(401).json({ ok:false, error:'Credenciales inválidas' });

    // Respuesta mínima: usuario autenticado (sin token por ahora)
    res.json({
      ok: true,
      user: { id: Number(u.Id), nombre: u.NombreUsuario, email: u.Email }
    });
  } catch (_e) {
    res.status(500).json({ ok:false, error:'Error del servidor' });
  } finally {
    if (conn) conn.release();
  }
});

// ================== Arranque ==================
const port = Number(process.env.APP_PORT || 3000);
http.createServer(app).listen(port, () => {
});
