import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // حذف المفاتيح المنتهية
  await supabase
    .from('keys')
    .delete()
    .lt('expires_at', new Date().toISOString())

  // إضافة 500 مفتاح جديد
  const keys = Array.from({ length: 500 }, () => ({
    key: 'WOW-' + Math.floor(Math.random() * 9000000 + 1000000) + '-' + Math.floor(Math.random() * 9000 + 1000),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    used: false
  }))

  const { error } = await supabase.from('keys').insert(keys)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true, added: 500 })
}
