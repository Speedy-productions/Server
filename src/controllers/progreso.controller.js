const { updateSuministros, getSuministros } = require('../models/suministros.model');
const { updateMejoras, getMejoras } = require('../models/mejoras.model');

async function save(req, res) {
  try {
    const userId = req.params.userId; 
    const { suministros, mejoras } = req.body;

    if (!suministros || !mejoras) {
      return res.status(400).json({ error: 'Faltan datos en el cuerpo del JSON.' });
    }

    // Actualiza suministros
    await updateSuministros(userId, suministros);

    // Actualiza mejoras
    await updateMejoras(userId, mejoras);

    return res.json({ message: 'Datos guardados correctamente.' });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function load(req, res) {
    const userId = req.params.userId; 

    // Obtiene los datos actualizados
    const suministrosActualizados = await getSuministros(userId);
    const mejorasActualizadas = await getMejoras(userId);

    return res.json({
      userId,
      suministros: suministrosActualizados.data,
      mejoras: mejorasActualizadas.data
    });
}

module.exports = { save, load };