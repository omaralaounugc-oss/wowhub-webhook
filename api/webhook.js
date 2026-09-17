import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // يستقبل المفتاح من GET (Postback) أو POST (body)
    const key = req.query.key || (req.body && req.body.key)

    if (!key) {
      return res.status(400).json({ error: 'No key provided' })
    }

    // تاريخ انتهاء 30 يوم من الآن
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + 30)

    // تحقق إذا المفتاح موجود مسبقاً
    const { data: existing } = await supabase
      .from('keys')
      .select('key')
      .eq('key', key)
      .single()

    if (existing) {
      return res.status(200).json({ success: true, message: 'Key already exists' })
    }

    // أضف المفتاح الجديد
    const { error } = await supabase
      .from('keys')
      .insert([{ key: key, expires_at: expires_at.toISOString() }])

    if (error) throw error

    return res.status(200).json({ success: true, key })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
