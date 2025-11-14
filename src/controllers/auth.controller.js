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
const { signToken } = require('../utils/jwt');

const txStore = new Map();
function putTx(state, val) {
  txStore.set(state, val);
  setTimeout(() => txStore.delete(state), 5 * 60 * 1000);
}

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

  const user = safeUserRow(row.data);
  const token = signToken(user);

  res.json({ ok: true, user, token });
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

    let user = await findUserByGoogleId(googleId);
    if (user.data) {
      const userData = safeUserRow(user.data);
      const token = signToken(userData);
      putTx(state, { status: 'ok', data: { user: userData, token } });
      return res.send('<html><body><p>Login con Google completado.</p></body></html>');
    }

    user = await findUserByEmail(email);
    if (user.data) {
      await linkGoogleId(user.data.id, googleId);
      const userData = safeUserRow(user.data);
      const token = signToken(userData);
      putTx(state, { status: 'ok', data: { user: userData, token } });
      return res.send('<html><body><p>Login con Google completado.</p></body></html>');
    }

    const ins = await createUser(nombre.slice(0, 32), email, '', googleId);
    const userData = safeUserRow(ins.data);
    const token = signToken(userData);
    putTx(state, { status: 'ok', data: { user: userData, token } });
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

// NUEVO ENDPOINT: validar token existente
exports.validateToken = (req, res) => {
  const user = req.user;
  res.json({ ok: true, user });
};
