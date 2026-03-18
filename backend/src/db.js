const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS confessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        text TEXT NOT NULL,
        category VARCHAR(20) NOT NULL CHECK (category IN ('love','school','secrets','funny','drama')),
        audio_url TEXT,
        listen_count INTEGER DEFAULT 0,
        reactions JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(20) NOT NULL,
        confession_id UUID REFERENCES confessions(id) ON DELETE CASCADE,
        emoji VARCHAR(10),
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ DB pronto');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
