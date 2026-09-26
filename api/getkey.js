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
    const now = new Date().toISOString();

    const rows = await sql`
      SELECT key, expires_at FROM keys
      WHERE used = false
      AND hwid IS NULL
      AND expires_at > ${now}
      ORDER BY expires_at ASC
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No keys available' });
    }

    const data = rows[0];

    await sql`
      UPDATE keys SET used = true WHERE key = ${data.key}
    `;

    return res.status(200).json({ key: data.key, expires_at: data.expires_at });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
