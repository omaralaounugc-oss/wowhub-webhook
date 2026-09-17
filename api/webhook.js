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
    const { key, expires_at } = req.body

    if (!key) {
      return res.status(400).json({ error: 'No key provided' })
    }

    const { error } = await supabase
      .from('keys')
      .insert([{ key, expires_at }])

    if (error) throw error

    return res.status(200).json({ success: true, key })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
