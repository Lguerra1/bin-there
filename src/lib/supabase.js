import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Missing Supabase credentials. Copy .env.local.example to .env.local, fill in ' +
      'the two values from the Connect button in the dashboard, and restart the ' +
      'dev server.',
  )
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    // Keeps the session on the device so a scanned sticker does not ask for a
    // login every time.
    persistSession: true,
    autoRefreshToken: true,
  },
})
