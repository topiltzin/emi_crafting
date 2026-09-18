import { createClient } from '@supabase/supabase-js';

let client = null;
let currentSession = null;

export function getSupabaseClient() {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).'
    );
  }

  client = createClient(url, anonKey);
  client.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
  });

  return client;
}

export async function getSession() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  currentSession = data.session;
  return currentSession;
}

export async function signInOwner(email, password) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentSession = data.session;
  return currentSession;
}

// Synchronous accessor for code paths (e.g. building Storage object paths) that need the
// owner's id without an extra await; only valid once a session has been established via
// getSession()/signInOwner() above.
export function getOwnerId() {
  if (!currentSession) {
    throw new Error('No active Supabase session.');
  }
  return currentSession.user.id;
}

// Test-only helper: clears the cached client/session so each test file gets a fresh module
// state instead of leaking a mocked client across test files.
export function resetSupabaseClientForTests() {
  client = null;
  currentSession = null;
}
