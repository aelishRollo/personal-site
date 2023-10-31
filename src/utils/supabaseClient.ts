import { createClient } from '@supabase/supabase-js';

const supabaseKey = process.env.REACT_APP_SUPABASE_API_KEY as string
const supabaseURL = process.env.REACT_APP_SUPABASE_URL as string

const supabase = createClient(supabaseKey, supabaseURL);

export default supabase;
