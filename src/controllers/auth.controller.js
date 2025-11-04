const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const {
  createUser,
  findUserByEmailOrUsername,
  findUserByGoogleId,
  findUserByEmail,
  linkGoogleId
} = require('../models/user.model');
const { safeUserRow } = require('../utils/helpers');
const { generateAuthUrl, verifyGoogleToken } = require('../services/google.service');

const txStore = new Map();
function putTx(state, val) {
  txStore.set(state, val);
  setTimeout(() => txStore.delete(state), 5 * 60 * 1000);
}

exports.register = async (req, res) => {
  const { username = '', email = '', password = '' } = req.body;
  if (!username.trim() || !email.trim() || !password)
    return res.status(400).json({ ok: false, error: 'Faltan campos' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await createUser(username.trim(), email.toLowerCase(), hash);
    if (error) return res.status(500).json({ ok: false, error: 'DB error' });
    res.json({ ok: true, user: safeUserRow(data) });
  } catch {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
};

exports.login = async (req, res) => {
  const emailOrUser = (req.body?.emailOrUser || '').trim().toLowerCase();
  const password = req.body?.password || '';
  if (!emailOrUser || !password)
    return res.status(400).json({ ok: false, error: 'Faltan credenciales' });

  const row = await findUserByEmailOrUsername(emailOrUser);
  if (row.error || !row.data)
    return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });

  const match = await bcrypt.compare(password, row.data.contrasenia || '');
  if (!match) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });

  res.json({ ok: true, user: safeUserRow(row.data) });
};

exports.googleStart = (req, res) => {
  const state = req.query.state || uuidv4();
  putTx(state, { status: 'pending' });
  res.redirect(generateAuthUrl(state));
};

exports.googleCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Bad request');

  try {
    const payload = await verifyGoogleToken(code);
    const googleId = payload.sub;
    const email = (payload.email || '').toLowerCase();
    const nombre = payload.name || 'Jugador';

    // 1) Buscar por googleid
    let user = await findUserByGoogleId(googleId);
    if (user.data) {
      putTx(state, { status: 'ok', data: { user: safeUserRow(user.data) } });
      return res.send('<html><body><p>Login con Google completado.</p></body></html>');
    }

    // 2) Buscar por email
    user = await findUserByEmail(email);
    if (user.data) {
      await linkGoogleId(user.data.id, googleId);
      putTx(state, { status: 'ok', data: { user: safeUserRow(user.data) } });
      return res.send('<html><body><p>Login con Google completado.</p></body></html>');
    }

    // 3) Crear nuevo usuario
    const ins = await createUser(nombre.slice(0, 32), email, '', googleId);
    putTx(state, { status: 'ok', data: { user: safeUserRow(ins.data) } });
    res.send('<html><body><p>Login con Google completado.</p></body></html>');
  } catch {
    putTx(state, { status: 'error', error: 'google_oauth_failed' });
    res.status(400).send('Google auth failed');
  }
};

exports.googleTx = (req, res) => {
  const rec = txStore.get(req.params.state);
  if (!rec) return res.json({ status: 'pending' });
  return res.json(rec);
};
