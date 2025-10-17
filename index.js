// ###############################################
// index.js — Auth local (email/pass) + Google OAuth con polling (Postgres)
// ###############################################
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcrypt');
const { v4: uuidv4 }   = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cors({ origin: '*', methods: ['GET','POST'] }));

// ---------- DB (Postgres/Supabase) ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // necesario con Supabase/Render
});

// ---------- Google OAuth ----------
const PUBLIC_BASE_URL     = process.env.PUBLIC_BASE_URL; // ej: https://xxx.onrender.com o https://xxx.ngrok-free.app
const GOOGLE_CLIENT_ID    = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET= process.env.GOOGLE_CLIENT_SECRET;

const googleClient = new OAuth2Client({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: `${PUBLIC_BASE_URL}/auth/google/callback`,
});

// ---------- Polling store (memoria) ----------
// txStore.set(state, { status: 'pending' | 'ok' | 'error', data?: {...}, error?: '...' })
const txStore = new Map();
function putTx(state, val) {
  txStore.set(state, val);
  setTimeout(() => txStore.delete(state), 5 * 60 * 1000);
}

// ---------- Util ----------
function safeUserRow(u) {
  // columnas en postgres llegan en minúsculas si no se usan comillas
  return { id: Number(u.id), nombre: u.nombreusuario, email: u.email };
}

// ---------- Health ----------
app.get('/health', (_req, res) => res.json({ ok: true, message: 'Server up' }));

// ================== AUTH: REGISTER ==================
// Body: { username, email, password }
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

    // ¿existe por email o usuario?
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

    const u = ins.rows[0];
    return res.json({ ok:true, user: safeUserRow(u) });
  } catch {
    return res.status(500).json({ ok:false, error:'Error del servidor' });
  }
});

// ================== AUTH: LOGIN (manual) ==================
// Body: { emailOrUser, password }
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
  const state = req.query.state || uuidv4(); // Unity puede generar su propio state
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
    const payload = ticket.getPayload(); // sub, email, name...
    const googleId = payload.sub;
    const email    = (payload.email || '').toLowerCase();
    const nombre   = payload.name || 'Jugador';

    // upsert usuario por googleId/email
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

    // notificar al polling-map
    putTx(state, { status: 'ok', data: { user: safeUserRow(user) } });

    // página simple de cierre
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

// ---------- Arranque ----------
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
