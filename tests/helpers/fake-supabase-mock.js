// Bridges the fake Supabase client (fake-supabase.js) into the global `vi.mock` of
// src/modules/supabase-client.js registered once in tests/setup.js, so individual test files
// don't each need their own vi.mock boilerplate for a dependency every test exercises.
import { createFakeSupabaseClient } from './fake-supabase.js';

let currentClient = null;

export function resetFakeClient(options) {
  currentClient = createFakeSupabaseClient(options);
  return currentClient;
}

export function getCurrentFakeClient() {
  if (!currentClient) {
    currentClient = createFakeSupabaseClient();
  }
  return currentClient;
}
