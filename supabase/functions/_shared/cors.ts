// Shared CORS headers for Supabase Edge Functions invoked directly from the browser client.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
