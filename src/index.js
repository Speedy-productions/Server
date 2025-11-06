// Config
const { PORT } = require('./config/env');
const express = require('express');
const cors = require('cors');
const { logReq } = require('./utils/logger');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use((req, res, next) => { logReq(req); next(); });

// Routes
const authRoutes = require('./routes/auth.route');
const contraseniaRoutes = require('./routes/contrasenia.route')

app.use('/auth', authRoutes);
app.use('/contrasenia', contraseniaRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, message: 'Server up (Supabase)' }));



app.listen(PORT, () => console.log(`[BOOT] API listening on port ${PORT}`));
