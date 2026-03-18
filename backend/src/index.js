require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const audioDir = process.env.AUDIO_DIR || '/tmp/spiolo-audio';

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Serve audio files
app.use('/api/audio', express.static(audioDir));

// Routes
app.use('/api/confessions', require('./routes/confessions'));
app.use('/api/notifications', require('./routes/notifications'));

// Stats
app.get('/api/stats', async (req, res) => {
  const { pool } = require('./db');
  const r = await pool.query(`
    SELECT COUNT(*)::int AS confessions_posted,
           COALESCE(SUM(listen_count),0)::int AS total_listens
    FROM confessions
  `);
  res.json(r.rows[0]);
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.use((req, res) => res.status(404).json({ error: 'Non trovato' }));

async function start() {
  await initDB();
  app.listen(PORT, () => console.log(`🐦 Spiolo backend su porta ${PORT}`));
}
start().catch(err => { console.error(err); process.exit(1); });
