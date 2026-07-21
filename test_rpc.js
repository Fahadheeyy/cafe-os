import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'fahad@cafe.com', // guess email or just use a token if possible?
    password: 'password' // We don't know the password...
  })
  
  // Can't really test without auth.
}
