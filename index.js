// ###############################################################
// index.js — Express + Supabase-js (service role) + bcrypt + Google OAuth
// ###############################################################
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cors({ origin: '*', methods: ['GET','POST'] }));

// ---------- Boot logs ----------
function logBoot(k, v) { console.log(`[BOOT] ${k}: ${v}`); }
function logReq(req){ console.log(`[REQ] ${req.method} ${req.url}`); }
app.use((req,res,next)=>{ logReq(req); next(); });

// ---------- ENV ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;



if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[BOOT] Faltan SUPABASE_URL / SUPABASE_KEY'); process.exit(1);
}
if (!PUBLIC_BASE_URL) {
  console.error('[BOOT] Falta PUBLIC_BASE_URL (o RENDER_EXTERNAL_URL)'); process.exit(1);
}
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('[BOOT] Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET'); process.exit(1);
}

// ---------- Supabase client (usar service role key) ----------
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
console.log('[BOOT] Supabase client creado');

// ---------- Google OAuth ----------
const googleClient = new OAuth2Client({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: `${PUBLIC_BASE_URL}/auth/google/callback`,
});

// ---------- Polling store ----------
const txStore = new Map();
function putTx(state, val) {
  txStore.set(state, val);
  setTimeout(() => txStore.delete(state), 5*60*1000);
}

// ---------- Utils ----------
function safeUserRow(u) {
  // Campos en minúscula tal como llegan desde Supabase
  return { id: Number(u.id), nombre: u.nombreusuario, email: u.email };
}
function dbErr(tag, error) {
  console.error(`[DB][${tag}]`, error);
  return { ok:false, error: 'DB error' };
}

// ---------- Health ----------
app.get('/health', (_req, res) => res.json({ ok:true, message:'Server up (Supabase)' }));

// ================== REGISTER ==================
app.post('/auth/register', async (req, res) => {
  const username = (req.body?.username || '').trim();
  const email    = (req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password || '';

  console.log('[REGISTER] payload', { username, email });

  try {
    if (!username || !email || !password)
      return res.status(400).json({ ok:false, error:'Faltan campos' });

    // Hash bcrypt
    const hash = await bcrypt.hash(password, 10);
    console.log('[REGISTER] bcrypt hash =', hash);

    // Inserción
    const { data, error } = await supabase
      .from('usuario')
      .insert([{ nombreusuario: username, email, contrasenia: hash }])
      .select('id,nombreusuario,email')
      .single();

    if (error) {
      console.error('[REGISTER] DB insert error', error);
      return res.status(500).json({ ok:false, error:'DB error' });
    }

    console.log('[REGISTER] created user id', data.id);
    res.json({ ok:true, user: safeUserRow(data) });

  } catch (err) {
    console.error('[REGISTER] Exception', err);
    res.status(500).json({ ok:false, error:'Server error' });
  }
});


// ================== LOGIN ==================
app.post('/auth/login', async (req, res) => {
  const emailOrUser = (req.body?.emailOrUser || '').trim().toLowerCase();
  const password    = req.body?.password || '';

  console.log('[LOGIN] payload', { emailOrUser });

  if (!emailOrUser || !password)
    return res.status(400).json({ ok:false, error:'Faltan credenciales' });

  const row = await supabase
    .from('usuario')
    .select('id,nombreusuario,email,contrasenia')
    .or(`email.eq.${emailOrUser},nombreusuario.eq.${emailOrUser}`)
    .limit(1)
    .single();

  if (row.error) {
    if (row.status === 406) {
      // no row
      console.log('[LOGIN] no existe usuario');
      return res.status(401).json({ ok:false, error:'Credenciales inválidas' });
    }
    dbErr('login.select', row.error);
    return res.status(500).json({ ok:false, error:'Error del servidor' });
  }

  const ok = await bcrypt.compare(password, row.data.contrasenia || '');
  if (!ok) {
    console.log('[LOGIN] bcrypt FAIL');
    return res.status(401).json({ ok:false, error:'Credenciales inválidas' });
  }

  console.log('[LOGIN] OK id', row.data.id);
  return res.json({ ok:true, user: safeUserRow(row.data) });
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
  console.log('[GOOGLE][start] state', state);
  res.redirect(url);
});

// ================== GOOGLE: callback ==================
app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log('[GOOGLE][cb] code?', !!code, 'state', state);
  if (!code || !state) return res.status(400).send('Bad request');

  try {
    const { tokens } = await googleClient.getToken(code);
    console.log('[GOOGLE][cb] got tokens:', !!tokens?.id_token);

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email    = (payload.email || '').toLowerCase();
    const nombre   = payload.name || 'Jugador';
    console.log('[GOOGLE][cb] email', email, 'sub', googleId?.slice(0,6));

    // 1) por googleid
    let user = await supabase
      .from('usuario')
      .select('id,nombreusuario,email')
      .eq('googleid', googleId)
      .limit(1)
      .maybeSingle();

    if (user.error) { dbErr('google.select1', user.error); return res.status(500).send('DB error'); }
    if (user.data) {
      console.log('[GOOGLE][cb] match by googleid', user.data.id);
      putTx(state, { status:'ok', data:{ user: safeUserRow(user.data) } });
      return res.send('<html><body><p>Login con Google completado. Volver al juego.</p></body></html>');
    }

    // 2) por email
    user = await supabase
      .from('usuario')
      .select('id,nombreusuario,email')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (user.error) { dbErr('google.select2', user.error); return res.status(500).send('DB error'); }
    if (user.data) {
      console.log('[GOOGLE][cb] enlazar googleid a id', user.data.id);
      const upd = await supabase.from('usuario').update({ googleid: googleId }).eq('id', user.data.id);
      if (upd.error) { dbErr('google.update', upd.error); return res.status(500).send('DB error'); }
      putTx(state, { status:'ok', data:{ user: safeUserRow(user.data) } });
      return res.send('<html><body><p>Login con Google completado. Volver al juego.</p></body></html>');
    }

    // 3) crear
    const username = nombre.slice(0, 32);
    const ins = await supabase
      .from('usuario')
      .insert([{ nombreusuario: username, email, contrasenia: '', googleid: googleId }])
      .select('id,nombreusuario,email')
      .single();

    if (ins.error) { dbErr('google.insert', ins.error); return res.status(500).send('DB error'); }
    console.log('[GOOGLE][cb] creado id', ins.data.id);

    putTx(state, { status:'ok', data:{ user: safeUserRow(ins.data) } });
    return res.send('<html><body><p>Login con Google completado. Volver al juego.</p></body></html>');
  } catch (e) {
    console.error('[GOOGLE][cb] error', e?.message || e);
    putTx(state, { status:'error', error:'google_oauth_failed' });
    return res.status(400).send('Google auth failed');
  }
});

// ================== GOOGLE: polling ==================
app.get('/auth/google/tx/:state', (req, res) => {
  const rec = txStore.get(req.params.state);
  if (!rec) return res.json({ status:'pending' });
  return res.json(rec);
});

// ---------- Start ----------
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`[BOOT] API escuchando en :${port}`));
