const supabase = require('../config/supabase');

async function createMejoras(userId) {
  return await supabase
    .from('mejoras')
    .insert([{
      userId: userId,
      freidora: 0,
      parrilla: 0,
      cortar: 0
    }])
    .select('*')
    .single();
}

async function getMejoras(userId) {
  return await supabase
    .from('mejoras')
    .select('*')
    .eq('userId', userId)
    .single();
}

async function updateMejoras(userId, data) {
  return await supabase
    .from('mejoras')
    .update(data)
    .eq('userId', userId)
    .select('*')
    .single();
}

module.exports = {
  createMejoras,
  getMejoras,
  updateMejoras
};
