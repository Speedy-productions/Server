const supabase = require('../config/supabase');

async function createUser(username, email, hash, googleId = null) {
  return await supabase
    .from('usuario')
    .insert([{ nombreusuario: username, email, contrasenia: hash, googleid: googleId }])
    .select('id,nombreusuario,email')
    .single();
}

async function findUserByEmailOrUsername(value) {
  return await supabase
    .from('usuario')
    .select('id,nombreusuario,email,contrasenia')
    .or(`email.eq.${value},nombreusuario.eq.${value}`)
    .limit(1)
    .single();
}

async function findUserByGoogleId(googleId) {
  return await supabase
    .from('usuario')
    .select('id,nombreusuario,email')
    .eq('googleid', googleId)
    .limit(1)
    .maybeSingle();
}

async function findUserByEmail(email) {
  return await supabase
    .from('usuario')
    .select('id,nombreusuario,email')
    .eq('email', email)
    .limit(1)
    .maybeSingle();
}

async function linkGoogleId(userId, googleId) {
  return await supabase.from('usuario').update({ googleid: googleId }).eq('id', userId);
}

module.exports = {
  createUser,
  findUserByEmailOrUsername,
  findUserByGoogleId,
  findUserByEmail,
  linkGoogleId
};
