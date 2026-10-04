import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const VALID_TOKEN = 'WOWHUB2026';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;
  if (token !== VALID_TOKEN) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  try {
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Atomically claim one key and start its 24h timer right now
    const rows = await sql`
      UPDATE keys
      SET used = true,
          activated_at = ${now.toISOString()},
          expires_at = ${expires.toISOString()}
      WHERE key = (
        SELECT key FROM keys
        WHERE used = false
          AND hwid IS NULL
          AND expires_at > ${now.toISOString()}
        ORDER BY expires_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING key, expires_at
    `;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No keys available' });
    }

    return res.status(200).json({ key: rows[0].key, expires_at: rows[0].expires_at });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
