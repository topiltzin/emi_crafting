import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// This file tests the REAL src/modules/supabase-client.js — the rest of the suite mocks it
// globally in tests/setup.js, so it's the one place that needs to opt back out of that mock.
vi.unmock('../../src/modules/supabase-client.js');

describe('supabase-client (real module)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws a clear error when env vars are not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const { getSupabaseClient } = await import('../../src/modules/supabase-client.js');

    expect(() => getSupabaseClient()).toThrow(/Supabase is not configured/);
  });

  it('constructs a client once VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    const { getSupabaseClient } = await import('../../src/modules/supabase-client.js');

    const client = getSupabaseClient();
    expect(client.auth).toBeDefined();
    expect(client.storage).toBeDefined();
    expect(typeof client.from).toBe('function');

    // Calling it again must return the same cached instance, not construct a second client.
    expect(getSupabaseClient()).toBe(client);
  });

  it('getOwnerId throws until a session has been established', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    const { getOwnerId } = await import('../../src/modules/supabase-client.js');

    expect(() => getOwnerId()).toThrow('No active Supabase session.');
  });
});
