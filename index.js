// ###############################################################
// index.js — API para Render: Postgres (Supabase) + bcrypt + Google OAuth
// ###############################################################
// - No .env ni ejecución local.
// - TLS lo termina Render; aquí va HTTP normal con app.listen(PORT).
// - Usa process.env.DATABASE_URL (Postgres/Supabase) y RENDER_EXTERNAL_URL.
// - Para Google OAuth, configura también GOOGLE_CLIENT_ID/SECRET y PUBLIC_BASE_URL
//   si no quieres depender de RENDER_EXTERNAL_URL.
//
// Endpoints:
//   GET  /health
//   POST /auth/register      { username, email, password }
//   POST /auth/login         { emailOrUser, password }
//   GET  /auth/google/start  (?state=optional)
//   GET  /auth/google/callback   (redirect URI en Google Console)
//   GET  /auth/google/tx/:state  -> { status: 'pending'|'ok'|'error', data? }
// ###############################################################

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcrypt');
const { v4: uuidv4 }   = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cors({ origin: '*', methods: ['GET','POST'] }));

// ---------- DB (Postgres: Supabase/Render) ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // requerido por Supabase/Render
});

// ---------- URLs y OAuth ----------
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || // (opcional) fuerza una URL pública concreta
  process.env.RENDER_EXTERNAL_URL; // URL pública que expone Render (https://...onrender.com)

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!process.env.DATABASE_URL) throw new Error('Falta env DATABASE_URL');
if (!PUBLIC_BASE_URL)          throw new Error('Falta PUBLIC_BASE_URL o RENDER_EXTERNAL_URL');
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
  throw new Error('Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');

const googleClient = new OAuth2Client({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: `${PUBLIC_BASE_URL}/auth/google/callback`,
});

// ---------- Polling store (memoria, expira en 5 min) ----------
const txStore = new Map();
function putTx(state, val) {
  txStore.set(state, val);
  setTimeout(() => txStore.delete(state), 5 * 60 * 1000);
}

// ---------- Util ----------
function safeUserRow(u) {
  return { id: Number(u.id), nombre: u.nombreusuario, email: u.email };
}

// ---------- Health ----------
app.get('/health', (_req, res) => res.json({ ok: true, message: 'Server up (Render)' }));

// ================== AUTH: REGISTER ==================
app.post('/auth/register', async (req, res) => {
  try {
    const username = (req.body?.username || '').trim();
    const email    = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';

    if (!username || !email || !password)
      return res.status(400).json({ ok:false, error:'Faltan campos' });
    if (username.length < 3 || username.length > 32)
      return res.status(400).json({ ok:false, error:'Usuario 3-32 chars' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ ok:false, error:'Email inválido' });
    if (password.length < 4 || password.length > 100)
      return res.status(400).json({ ok:false, error:'Contraseña 4-100 chars' });

    const exist = await pool.query(
      `select id from usuario where email = $1 or nombreusuario = $2 limit 1`,
      [email, username]
    );
    if (exist.rows.length > 0)
      return res.status(409).json({ ok:false, error:'Usuario o email ya existe' });

    const hash = await bcrypt.hash(password, 10);
    const ins = await pool.query(
      `insert into usuario (nombreusuario, email, contrasenia)
       values ($1, $2, $3)
       returning id, nombreusuario, email`,
      [username, email, hash]
    );

    return res.json({ ok:true, user: safeUserRow(ins.rows[0]) });
  } catch {
    return res.status(500).json({ ok:false, error:'Error del servidor' });
  }
});

// ================== AUTH: LOGIN ==================
app.post('/auth/login', async (req, res) => {
  try {
    const emailOrUser = (req.body?.emailOrUser || '').trim().toLowerCase();
    const password    = req.body?.password || '';

    if (!emailOrUser || !password)
      return res.status(400).json({ ok:false, error:'Faltan credenciales' });

    const q = await pool.query(
      `select id, nombreusuario, email, contrasenia
         from usuario
        where email = $1 or nombreusuario = $1
        limit 1`,
      [emailOrUser]
    );
    if (q.rows.length === 0)
      return res.status(401).json({ ok:false, error:'Credenciales inválidas' });

    const u = q.rows[0];
    const ok = await bcrypt.compare(password, u.contrasenia);
    if (!ok) return res.status(401).json({ ok:false, error:'Credenciales inválidas' });

    return res.json({ ok:true, user: safeUserRow(u) });
  } catch {
    return res.status(500).json({ ok:false, error:'Error del servidor' });
  }
});

// ================== GOOGLE: start ==================
app.get('/auth/google/start', (req, res) => {
  const state = req.query.state || uuidv4();
  putTx(state, { status: 'pending' });

  const url = googleClient.generateAuthUrl({
    access_type: 'online',
    prompt: 'consent',
    scope: ['openid', 'email', 'profile'],
    state,
  });
  res.redirect(url);
});

// ================== GOOGLE: callback ==================
app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Bad request');

  try {
    const { tokens } = await googleClient.getToken(code);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email    = (payload.email || '').toLowerCase();
    const nombre   = payload.name || 'Jugador';

    let user;
    const byGoogle = await pool.query(
      `select id, nombreusuario, email from usuario where googleid = $1 limit 1`,
      [googleId]
    );
    if (byGoogle.rows.length > 0) {
      user = byGoogle.rows[0];
    } else {
      const byEmail = await pool.query(
        `select id, nombreusuario, email from usuario where email = $1 limit 1`,
        [email]
      );
      if (byEmail.rows.length > 0) {
        await pool.query(`update usuario set googleid = $1 where id = $2`, [googleId, byEmail.rows[0].id]);
        user = byEmail.rows[0];
      } else {
        const username = nombre.slice(0, 32);
        const ins = await pool.query(
          `insert into usuario (nombreusuario, email, contrasenia, googleid)
           values ($1, $2, '', $3)
           returning id, nombreusuario, email`,
          [username, email, googleId]
        );
        user = ins.rows[0];
      }
    }

    putTx(state, { status: 'ok', data: { user: safeUserRow(user) } });
    res.send(`<html><body><p>Login con Google completado. Volver al juego.</p></body></html>`);
  } catch {
    putTx(state, { status: 'error', error: 'google_oauth_failed' });
    res.status(400).send('Google auth failed');
  }
});

// ================== GOOGLE: polling ==================
app.get('/auth/google/tx/:state', (req, res) => {
  const record = txStore.get(req.params.state);
  if (!record) return res.json({ status: 'pending' });
  return res.json(record);
});

// ---------- Arranque (Render asigna PORT) ----------
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`API escuchando en :${port} (Render)`);
});
