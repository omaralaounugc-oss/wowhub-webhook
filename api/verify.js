import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { key } = req.body

    if (!key) {
      return res.status(400).json({ error: 'No key provided' })
    }

    const { data, error } = await supabase
      .from('keys')
      .select('key, expires_at')
      .eq('key', key)
      .single()

    if (error || !data) {
      return res.status(403).json({ valid: false, message: 'Invalid key' })
    }

    const now = new Date()
    const expires = new Date(data.expires_at)

    if (now > expires) {
      return res.status(403).json({ valid: false, message: 'Key expired' })
    }

    return res.status(200).json({ valid: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
