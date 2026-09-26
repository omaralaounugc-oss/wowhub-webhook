import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const attempts = new Map();

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  if (attempts.has(ip)) {
    const { count, timestamp } = attempts.get(ip);
    if (now - timestamp < 60000 && count >= 10) {
      return res.status(429).json({ error: 'Too many attempts. Wait 1 minute.' });
    }
    if (now - timestamp > 60000) {
      attempts.set(ip, { count: 1, timestamp: now });
    } else {
      attempts.set(ip, { count: count + 1, timestamp });
    }
  } else {
    attempts.set(ip, { count: 1, timestamp: now });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { key, hwid } = req.body;

    if (!key) return res.status(400).json({ error: 'No key provided' });
    if (!hwid) return res.status(400).json({ error: 'No hwid provided' });

    const rows = await sql`
      SELECT key, expires_at, hwid, activated_at
      FROM keys WHERE key = ${key}
    `;

    if (!rows || rows.length === 0) {
      return res.status(403).json({ valid: false, message: 'Invalid key' });
    }

    const data = rows[0];

    // First use — bind hwid and start 24h timer
    if (!data.hwid) {
      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt.getTime() + 24 * 60 * 60 * 1000);

      await sql`
        UPDATE keys SET
          hwid = ${hwid},
          activated_at = ${activatedAt.toISOString()},
          expires_at = ${expiresAt.toISOString()},
          used = true
        WHERE key = ${key}
      `;

      return res.status(200).json({ valid: true });
    }

    // Check expiry
    if (new Date() > new Date(data.expires_at)) {
      return res.status(403).json({ valid: false, message: 'Key expired' });
    }

    // Check device
    if (data.hwid !== hwid) {
      return res.status(403).json({ valid: false, message: 'Key used on another device' });
    }

    return res.status(200).json({ valid: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
