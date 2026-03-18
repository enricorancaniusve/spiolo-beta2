const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

// Store audio files locally in /tmp/audio (Railway has ephemeral storage — fine for MVP)
const audioDir = process.env.AUDIO_DIR || '/tmp/spiolo-audio';
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

const storage = multer.diskStorage({
  destination: audioDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.webm`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // max 10MB

// GET /api/confessions
router.get('/', async (req, res) => {
  const { category, sort = 'recent', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let orderBy = 'created_at DESC';
  if (sort === 'popular') orderBy = 'listen_count DESC';

  let where = category ? `WHERE category = $1` : '';
  const params = category ? [category, parseInt(limit), offset] : [parseInt(limit), offset];

  try {
    const result = await pool.query(
      `SELECT * FROM confessions ${where} ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM confessions ${where}`,
      category ? [category] : []
    );
    res.json({
      confessions: result.rows.map(fmt),
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore server' });
  }
});

// GET /api/confessions/trending
router.get('/trending', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM confessions
      WHERE created_at > NOW() - INTERVAL '7 days'
      ORDER BY listen_count DESC LIMIT 20
    `);
    res.json(result.rows.map(fmt));
  } catch (err) {
    res.status(500).json({ error: 'Errore server' });
  }
});

// GET /api/confessions/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM confessions WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Non trovato' });
    res.json(fmt(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/confessions — upload audio + testo
router.post('/', upload.single('audio'), async (req, res) => {
  const { text, category } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Testo mancante' });
  if (!['love','school','secrets','funny','drama'].includes(category))
    return res.status(400).json({ error: 'Categoria non valida' });
  if (text.length > 1000) return res.status(400).json({ error: 'Testo troppo lungo' });
  if (!req.file) return res.status(400).json({ error: 'Audio mancante' });

  // Build public URL for this audio file
  const audioUrl = `/api/audio/${req.file.filename}`;

  try {
    const result = await pool.query(
      `INSERT INTO confessions (text, category, audio_url) VALUES ($1, $2, $3) RETURNING *`,
      [text.trim(), category, audioUrl]
    );
    res.status(201).json(fmt(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/confessions/:id/listen
router.post('/:id/listen', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE confessions SET listen_count = listen_count + 1 WHERE id = $1 RETURNING listen_count`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Non trovato' });
    const count = result.rows[0].listen_count;
    if ([10, 50, 100, 500].includes(count)) {
      await pool.query(
        `INSERT INTO notifications (type, confession_id, message) VALUES ('trending', $1, $2)`,
        [req.params.id, `La tua confessione ha raggiunto ${count} ascolti! 🔥`]
      );
    }
    res.json({ listenCount: count });
  } catch (err) {
    res.status(500).json({ error: 'Errore server' });
  }
});

// POST /api/confessions/:id/react
router.post('/:id/react', async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji mancante' });
  try {
    const result = await pool.query(
      `UPDATE confessions
       SET reactions = jsonb_set(reactions, ARRAY[$1], (COALESCE(reactions->$1,'0')::int+1)::text::jsonb)
       WHERE id = $2 RETURNING reactions`,
      [emoji, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Non trovato' });
    await pool.query(
      `INSERT INTO notifications (type, confession_id, emoji, message) VALUES ('reaction', $1, $2, $3)`,
      [req.params.id, emoji, `Qualcuno ha reagito ${emoji} alla tua confessione!`]
    );
    res.json({ reactions: result.rows[0].reactions });
  } catch (err) {
    res.status(500).json({ error: 'Errore server' });
  }
});

function fmt(row) {
  return {
    id: row.id,
    text: row.text,
    category: row.category,
    audioUrl: row.audio_url,
    listenCount: row.listen_count,
    reactions: row.reactions || {},
    createdAt: row.created_at,
  };
}

module.exports = router;
