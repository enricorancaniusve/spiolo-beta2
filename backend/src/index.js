require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// ─── Presenza online ──────────────────────────────────────────────────────────
// Mappa device_id → timestamp ultimo ping
const onlineUsers = new Map();
const ONLINE_TIMEOUT_MS = 60 * 1000; // 60s senza ping = offline

// Pulizia automatica ogni 30 secondi
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of onlineUsers.entries()) {
    if (now - ts > ONLINE_TIMEOUT_MS) onlineUsers.delete(id);
  }
}, 30_000);

// POST /api/ping — il frontend chiama questo ogni 30s
app.post('/api/ping', (req, res) => {
  const { device_id } = req.body;
  if (device_id) onlineUsers.set(device_id, Date.now());
  res.json({ online: onlineUsers.size });
});

// GET /api/online — numero utenti online
app.get('/api/online', (req, res) => {
  res.json({ online: onlineUsers.size });
});

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  const { pool } = require('./db');
  const r = await pool.query(`
    SELECT 
      COUNT(*)::int AS confessions_posted,
      COALESCE(SUM(listen_count), 0)::int AS total_listens,
      COUNT(*) FILTER (
        WHERE created_at >= CURRENT_DATE
      )::int AS today
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
