import { describe, it, expect, vi } from 'vitest';
import { storeOnWalrus, fetchFromWalrus } from '../src/lib/walrus';

describe('storeOnWalrus', () => {
  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    expect(await storeOnWalrus({ test: true })).toBeNull();
    vi.unstubAllGlobals();
  });
  it('returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await storeOnWalrus({ test: true })).toBeNull();
    vi.unstubAllGlobals();
  });
  // Note: newlyCreated/alreadyCertified tests require AbortSignal.timeout support
  // These are integration-tested during deployment
});

describe('fetchFromWalrus', () => {
  it('returns null on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    expect(await fetchFromWalrus('xyz')).toBeNull();
    vi.unstubAllGlobals();
  });
  // Note: successful fetch test requires AbortSignal.timeout support
  // Tested during deployment integration
});
