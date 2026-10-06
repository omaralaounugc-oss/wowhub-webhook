import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const MIN_SECONDS = 15; // fastest a real user could finish the tasks

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nonce } = req.query;
  if (!nonce || !/^[a-f0-9]{32}$/.test(nonce)) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  try {
    // Consume the one-time session (must be old enough and not expired)
    const session = await sql`
      UPDATE sessions SET used = true
      WHERE nonce = ${nonce}
        AND used = false
        AND created_at < NOW() - INTERVAL '15 seconds'
        AND created_at > NOW() - INTERVAL '1 hour'
      RETURNING nonce
    `;
    if (!session || session.length === 0) {
      return res.status(403).json({ error: 'Invalid or expired session' });
    }

    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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
      // give the session back so the user can retry
      await sql`UPDATE sessions SET used = false WHERE nonce = ${nonce}`;
      return res.status(404).json({ error: 'No keys available' });
    }

    return res.status(200).json({ key: rows[0].key, expires_at: rows[0].expires_at });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
