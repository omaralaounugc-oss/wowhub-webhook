import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function generateKey() {
  const part1 = Math.floor(Math.random() * 9000000 + 1000000);
  const part2 = Math.floor(Math.random() * 9000 + 1000);
  const secret = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WOW-${part1}-${part2}-${secret}`;
}

export default async function handler(req, res) {
  try {
    // Delete expired keys
    await sql`DELETE FROM keys WHERE expires_at < NOW()`;

    // Add 500 new keys
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 500; i++) {
      const key = generateKey();
      await sql`
        INSERT INTO keys (key, expires_at, used)
        VALUES (${key}, ${expires}, false)
        ON CONFLICT (key) DO NOTHING
      `;
    }

    return res.status(200).json({ success: true, added: 500 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
