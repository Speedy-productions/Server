const { PORT } = require('./config/env');
const express = require('express');
const cors = require('cors');
const { logReq } = require('./utils/logger');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use((req, res, next) => { logReq(req); next(); });

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, message: 'Server up (Supabase)' }));

// Routes
app.use('/auth', authRoutes);

app.listen(PORT, () => console.log(`[BOOT] API listening on port ${PORT}`));
