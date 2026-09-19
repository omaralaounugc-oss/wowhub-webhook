import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token } = req.query
  if (token !== 'WOWHUB2026') {
    return res.status(403).json({ error: 'Invalid token' })
  }

  try {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('keys')
      .select('key, expires_at')
      .eq('used', false)
      .is('hwid', null)
      .gt('expires_at', now)
      .order('expires_at', { ascending: true })
      .limit(1)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'No keys available' })
    }

    await supabase
      .from('keys')
      .update({ used: true })
      .eq('key', data.key)

    return res.status(200).json({ key: data.key, expires_at: data.expires_at })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
