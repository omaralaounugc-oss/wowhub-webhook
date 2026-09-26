import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const attempts = new Map();

export default async function handler(req, res) {
  // Rate limiting
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
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { key, hwid } = req.body

    if (!key) return res.status(400).json({ error: 'No key provided' })
    if (!hwid) return res.status(400).json({ error: 'No hwid provided' })

    const { data, error } = await supabase
      .from('keys')
      .select('key, expires_at, hwid, activated_at')
      .eq('key', key)
      .single()

    if (error || !data) {
      return res.status(403).json({ valid: false, message: 'Invalid key' })
    }

    // First use — register hwid + activation time + expires_at starts now
    if (!data.hwid) {
      const now = new Date()
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      await supabase
        .from('keys')
        .update({
          hwid: hwid,
          activated_at: now.toISOString(),
          expires_at: expires.toISOString(),
          used: true
        })
        .eq('key', key)
      return res.status(200).json({ valid: true })
    }

    // Check expiry (after activation only)
    if (new Date() > new Date(data.expires_at)) {
      return res.status(403).json({ valid: false, message: 'Key expired' })
    }

    // Check if same device
    if (data.hwid !== hwid) {
      return res.status(403).json({ valid: false, message: 'Key used on another device' })
    }

    return res.status(200).json({ valid: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
