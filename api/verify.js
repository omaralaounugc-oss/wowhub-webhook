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

    // أول استخدام — سجل hwid + وقت التفعيل + expires_at يبدأ من الآن
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

    // تحقق من انتهاء الصلاحية (بعد التفعيل فقط)
    if (new Date() > new Date(data.expires_at)) {
      return res.status(403).json({ valid: false, message: 'Key expired' })
    }

    // تحقق إذا نفس الجهاز
    if (data.hwid !== hwid) {
      return res.status(403).json({ valid: false, message: 'Key used on another device' })
    }

    return res.status(200).json({ valid: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
