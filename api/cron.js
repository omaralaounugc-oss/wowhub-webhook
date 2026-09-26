import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function generateKey() {
  const part1 = Math.floor(Math.random() * 9000000 + 1000000);
  const part2 = Math.floor(Math.random() * 9000 + 1000);
  const secret = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WOW-${part1}-${part2}-${secret}`;
}

export default async function handler(req, res) {
  // Delete expired keys
  await supabase
    .from('keys')
    .delete()
    .lt('expires_at', new Date().toISOString())

  // Add 500 new keys
  const keys = Array.from({ length: 500 }, () => ({
    key: generateKey(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    used: false
  }))

  const { error } = await supabase.from('keys').insert(keys)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true, added: 500 })
}
