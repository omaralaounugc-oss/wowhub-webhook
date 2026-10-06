import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const MAX_KEYS = 1000; // change this when you upgrade Neon

function generateKey() {
  const part1 = Math.floor(Math.random() * 9000000 + 1000000);
  const part2 = Math.floor(Math.random() * 9000 + 1000);
  const secret = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WOW-${part1}-${part2}-${secret}`;
}

export default async function handler(req, res) {
  try {
    // 1. Delete expired keys (used keys after 24h, unused keys after 7 days)
    await sql`DELETE FROM keys WHERE expires_at < NOW()`;

    // 1b. Clean up old one-time sessions
    await sql`DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '1 day'`;

    // 2. Count what's left
    const result = await sql`SELECT COUNT(*)::int AS count FROM keys`;
    const total = result[0].count;
    const missing = MAX_KEYS - total;

    if (missing <= 0) {
      return res.status(200).json({ success: true, added: 0, total });
    }

    // 3. Create only the missing keys, in one single query
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const newKeys = Array.from({ length: missing }, generateKey);

    await sql`
      INSERT INTO keys (key, expires_at, used)
      SELECT k, ${expires}::timestamptz, false
      FROM unnest(${newKeys}::text[]) AS k
      ON CONFLICT (key) DO NOTHING
    `;

    return res.status(200).json({ success: true, added: missing, total: MAX_KEYS });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
