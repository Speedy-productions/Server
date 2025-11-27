const supabase = require('../config/supabase');

async function createSuministros(userId) {
  return await supabase
    .from('suministros')
    .insert([{
      userId: userId,
      tomate: 0,
      lechuga: 0,
      carne: 0,
      papa: 0,
      pan: 0,
      dinero: 0
    }])
    .select('*')
    .single();
}

async function getSuministros(userId) {
  return await supabase
    .from('suministros')
    .select('*')
    .eq('userId', userId)
    .single();
}

async function updateSuministros(userId, data) {
  return await supabase
    .from('suministros')
    .update(data)
    .eq('userId', userId)
    .select('*')
    .single();
}

module.exports = {
  createSuministros,
  getSuministros,
  updateSuministros
};
