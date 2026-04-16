/**
 * Tests for src/core/script-router.ts
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAllRouteCache,
  clearCachedRoute,
  execRouteScript,
  getCachedRoute,
  setCachedRoute,
} from '../../src/core/script-router';
import type { ScriptRouterInput } from '../../src/core/script-router';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixtures = (name: string) => path.resolve(__dirname, '../fixtures', name);

const baseInput: ScriptRouterInput = {
  senderId: 'user_123',
  senderName: 'Test User',
  chatId: 'chat_456',
  chatType: 'p2p',
  accountId: 'acc_789',
  messageType: 'text',
  content: 'hello',
};

afterEach(() => {
  clearAllRouteCache();
});

// ---------------------------------------------------------------------------
// execRouteScript
// ---------------------------------------------------------------------------

describe('execRouteScript', () => {
  it('routes normal user to default-agent', async () => {
    const result = await execRouteScript({
      scriptPath: fixtures('route-ok.ts'),
      input: baseInput,
      timeout: 5000,
    });
    expect(result).toEqual({ agentId: 'default-agent' });
  });

  it('routes vip user to premium-agent', async () => {
    const result = await execRouteScript({
      scriptPath: fixtures('route-ok.ts'),
      input: { ...baseInput, senderId: 'vip_user' },
      timeout: 5000,
    });
    expect(result).toEqual({ agentId: 'premium-agent' });
  });

  it('returns null when script times out', { timeout: 10_000 }, async () => {
    const result = await execRouteScript({
      scriptPath: fixtures('route-timeout.ts'),
      input: baseInput,
      timeout: 500,
    });
    expect(result).toBeNull();
  });

  it('returns null when script exits with error', async () => {
    const result = await execRouteScript({
      scriptPath: fixtures('route-error.ts'),
      input: baseInput,
      timeout: 5000,
    });
    expect(result).toBeNull();
  });

  it('returns null when script returns invalid JSON', async () => {
    const result = await execRouteScript({
      scriptPath: fixtures('route-invalid-json.ts'),
      input: baseInput,
      timeout: 5000,
    });
    expect(result).toBeNull();
  });

  it('returns null when agentId is not in validAgentIds', async () => {
    const result = await execRouteScript({
      scriptPath: fixtures('route-ok.ts'),
      input: baseInput,
      timeout: 5000,
      validAgentIds: ['agent-a', 'agent-b'],
    });
    expect(result).toBeNull();
  });

  it('returns result when agentId is in validAgentIds', async () => {
    const result = await execRouteScript({
      scriptPath: fixtures('route-ok.ts'),
      input: baseInput,
      timeout: 5000,
      validAgentIds: ['default-agent', 'premium-agent'],
    });
    expect(result).toEqual({ agentId: 'default-agent' });
  });
});

// ---------------------------------------------------------------------------
// Route cache
// ---------------------------------------------------------------------------

describe('route cache', () => {
  it('returns undefined for unknown key', () => {
    expect(getCachedRoute('unknown')).toBeUndefined();
  });

  it('stores and retrieves a cached route', () => {
    setCachedRoute('session-1', 'agent-x', 60_000);
    expect(getCachedRoute('session-1')).toBe('agent-x');
  });

  it('overwrites existing cache entry', () => {
    setCachedRoute('session-1', 'agent-x', 60_000);
    setCachedRoute('session-1', 'agent-y', 60_000);
    expect(getCachedRoute('session-1')).toBe('agent-y');
  });

  it('clears a single cached route', () => {
    setCachedRoute('session-1', 'agent-x', 60_000);
    setCachedRoute('session-2', 'agent-y', 60_000);
    clearCachedRoute('session-1');
    expect(getCachedRoute('session-1')).toBeUndefined();
    expect(getCachedRoute('session-2')).toBe('agent-y');
  });

  it('clears all cached routes', () => {
    setCachedRoute('session-1', 'agent-x', 60_000);
    setCachedRoute('session-2', 'agent-y', 60_000);
    clearAllRouteCache();
    expect(getCachedRoute('session-1')).toBeUndefined();
    expect(getCachedRoute('session-2')).toBeUndefined();
  });

  it('returns undefined for expired cache entry', () => {
    setCachedRoute('session-1', 'agent-x', 1); // 1ms TTL
    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    expect(getCachedRoute('session-1')).toBeUndefined();
  });

  it('does not cache when ttl is 0', () => {
    setCachedRoute('session-1', 'agent-x', 0);
    expect(getCachedRoute('session-1')).toBeUndefined();
  });
});
