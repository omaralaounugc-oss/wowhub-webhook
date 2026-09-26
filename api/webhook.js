import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const key = req.query.key || (req.body && req.body.key);

    if (!key || key === 'UNIQUE_ID') {
      return res.status(400).json({ error: 'No valid key provided' });
    }

    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 24);

    // Check if key already exists
    const existing = await sql`
      SELECT key FROM keys WHERE key = ${key}
    `;

    if (existing && existing.length > 0) {
      return res.status(200).json({ success: true, key: key });
    }

    // Insert new key
    await sql`
      INSERT INTO keys (key, expires_at)
      VALUES (${key}, ${expires_at.toISOString()})
    `;

    return res.status(200).json({ success: true, key });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
