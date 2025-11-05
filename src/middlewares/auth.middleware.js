const { verifyToken } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ ok: false, error: 'Token requerido' });

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });

  req.user = payload;
  next();
}

module.exports = { authMiddleware };
