import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';

const sql = neon(process.env.DATABASE_URL);

const LOOT_LINK = 'https://loot-link.com/s?9diqLQbJ';
const SITE = 'https://wowhub-webhook.vercel.app';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

    // Rate limit: max 10 sessions per IP per 10 minutes (stored in DB, works across instances)
    const recent = await sql`
      SELECT COUNT(*)::int AS c FROM sessions
      WHERE ip = ${ip} AND created_at > NOW() - INTERVAL '10 minutes'
    `;
    if (recent[0].c >= 10) {
      return res.status(429).send('Too many attempts. Try again later.');
    }

    const nonce = randomBytes(16).toString('hex');
    await sql`INSERT INTO sessions (nonce, ip) VALUES (${nonce}, ${ip})`;

    // Encrypt the real destination with Loot Labs Redirect API
    const dest = `${SITE}/index2.html?nonce=${nonce}`;
    const apiUrl =
      'https://creators.lootlabs.gg/api/public/url_encryptor' +
      `?destination_url=${encodeURIComponent(dest)}` +
      `&api_token=${process.env.LOOTLABS_API_TOKEN}`;

    const r = await fetch(apiUrl);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!data || typeof data.message !== 'string' || data.type === 'error') {
      return res.status(502).send('Could not create link. Try again.');
    }

    // data.message is already URL-encoded, append as-is
    return res.redirect(302, `${LOOT_LINK}&data=${data.message}`);
  } catch (err) {
    return res.status(500).send('Server error');
  }
}
