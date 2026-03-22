import { describe, it, expect, vi } from 'vitest';
import { checkFreeTier, verifyPayment, buildPaymentRequest, FREE_COMMITS_PER_DAY, PRICE_WEI } from '../src/lib/mpp';
import type { Env } from '../src/types';

function makeEnv(kvStore: Record<string, string> = {}): Env {
  const store = { ...kvStore };
  return {
    DB: {} as D1Database,
    KV: {
      get: async (k: string) => store[k] ?? null,
      put: async (k: string, v: string) => { store[k] = v; },
      delete: async (k: string) => { delete store[k]; },
    } as unknown as KVNamespace,
  };
}

describe('checkFreeTier', () => {
  it('allows first request and decrements remaining', async () => {
    const env = makeEnv();
    const { allowed, remaining } = await checkFreeTier(env, '1.2.3.4');
    expect(allowed).toBe(true);
    expect(remaining).toBe(FREE_COMMITS_PER_DAY - 1);
  });

  it('denies when quota exhausted', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const env = makeEnv({ [`freetier:${today}:1.2.3.4`]: String(FREE_COMMITS_PER_DAY) });
    const { allowed, remaining } = await checkFreeTier(env, '1.2.3.4');
    expect(allowed).toBe(false);
    expect(remaining).toBe(0);
  });

  it('fails open on KV error', async () => {
    const env = {
      DB: {} as D1Database,
      KV: { get: async () => { throw new Error('kv down'); }, put: async () => {}, delete: async () => {} } as unknown as KVNamespace,
    };
    const { allowed } = await checkFreeTier(env, '1.2.3.4');
    expect(allowed).toBe(true);
  });
});

describe('buildPaymentRequest', () => {
  it('returns version 1.0', () => {
    const req = buildPaymentRequest('sentiment-analysis') as { version: string; accepts: unknown[] };
    expect(req.version).toBe('1.0');
  });

  it('includes both supported chains', () => {
    const req = buildPaymentRequest('test') as { accepts: Array<{ chainId: number }> };
    const ids = req.accepts.map((a) => a.chainId);
    expect(ids).toContain(8453); // Base
    expect(ids).toContain(4217); // Tempo
  });

  it('sets correct price', () => {
    const req = buildPaymentRequest('test') as { accepts: Array<{ maxAmountRequired: string }> };
    expect(req.accepts[0].maxAmountRequired).toBe(PRICE_WEI);
  });
});

describe('verifyPayment', () => {
  it('rejects invalid base64', async () => {
    const env = makeEnv();
    const { valid } = await verifyPayment(env, 'not-valid-base64!!!');
    expect(valid).toBe(false);
  });

  it('rejects missing txHash', async () => {
    const env = makeEnv();
    const receipt = btoa(JSON.stringify({ to: '0xB1e55EdD3176Ce9C9aF28F15b79e0c0eb8Fe51AA' }));
    const { valid, reason } = await verifyPayment(env, receipt);
    expect(valid).toBe(false);
    expect(reason).toContain('txHash');
  });

  it('rejects wrong recipient', async () => {
    const env = makeEnv();
    const receipt = btoa(JSON.stringify({ txHash: '0xabc', to: '0x0000000000000000000000000000000000000001' }));
    const { valid, reason } = await verifyPayment(env, receipt);
    expect(valid).toBe(false);
    expect(reason).toContain('recipient');
  });

  it('rejects replay attack', async () => {
    const env = makeEnv({ 'payment:used:0xtx123': '1' });
    const receipt = btoa(JSON.stringify({ txHash: '0xtx123', to: '0xB1e55EdD3176Ce9C9aF28F15b79e0c0eb8Fe51AA' }));
    const { valid, reason } = await verifyPayment(env, receipt);
    expect(valid).toBe(false);
    expect(reason).toContain('already used');
  });

  it('accepts valid receipt (RPC fail-open)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rpc down')));
    const env = makeEnv();
    const receipt = btoa(JSON.stringify({
      txHash: '0xnewtx999',
      to: '0xB1e55EdD3176Ce9C9aF28F15b79e0c0eb8Fe51AA',
      amount: '1000',
    }));
    const { valid } = await verifyPayment(env, receipt);
    expect(valid).toBe(true);
    vi.unstubAllGlobals();
  });
});
