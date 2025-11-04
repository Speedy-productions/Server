function safeUserRow(u) {
  return { id: Number(u.id), nombre: u.nombreusuario, email: u.email };
}

module.exports = { safeUserRow };
