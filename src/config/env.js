require('dotenv').config();

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  PUBLIC_BASE_URL,
  JWT_SECRET, 
  JWT_EXPIRES_IN,
  PORT

} = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error('Missing Google OAuth keys');
if (!PUBLIC_BASE_URL) throw new Error('Missing PUBLIC_BASE_URL');
if (!JWT_SECRET) throw new Error('Missing JWT_SECRET');


module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  PUBLIC_BASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN: JWT_EXPIRES_IN || '30d',
  PORT: PORT || 3000
};
