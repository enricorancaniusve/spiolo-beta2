const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 30`
    );
    res.json(result.rows.map(r => ({
      id: r.id, type: r.type, confessionId: r.confession_id,
      emoji: r.emoji, message: r.message, createdAt: r.created_at,
    })));
  } catch (err) { res.status(500).json({ error: 'Errore server' }); }
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM notifications WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
