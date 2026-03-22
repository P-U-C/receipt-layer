import { describe, it, expect, vi } from 'vitest';
import { storeOnWalrus, fetchFromWalrus } from '../src/lib/walrus';
import type { Receipt } from '../src/types';

const DUMMY_RECEIPT: Receipt = {
  receipt_id: 'rcpt_test',
  version: '0.1.0',
  capability: 'test',
  provider: { address: '0xB1e55EdD3176Ce9C9aF28F15b79e0c0eb8Fe51AA', protocol: 'http' },
  consumer: { address: '0x0000000000000000000000000000000000000001', protocol: 'http' },
  spec_hash: null,
  payment: null,
  provider_signature: null,
  consumer_signature: null,
  output_hash: null,
  execution_metadata: null,
  status: 'committed',
  chain_anchor: null,
  walrus_blob_id: null,
  walrus_url: null,
  created_at: '2026-03-22T00:00:00.000Z',
  delivered_at: null,
  acknowledged_at: null,
};

describe('storeOnWalrus', () => {
  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network fail')));
    expect(await storeOnWalrus(DUMMY_RECEIPT)).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await storeOnWalrus(DUMMY_RECEIPT)).toBeNull();
    vi.unstubAllGlobals();
  });

  it('parses newlyCreated blobId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ newlyCreated: { blobObject: { blobId: 'blob123' } } }),
    }));
    expect(await storeOnWalrus(DUMMY_RECEIPT)).toBe('blob123');
    vi.unstubAllGlobals();
  });

  it('parses alreadyCertified blobId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ alreadyCertified: { blobId: 'blob456' } }),
    }));
    expect(await storeOnWalrus(DUMMY_RECEIPT)).toBe('blob456');
    vi.unstubAllGlobals();
  });

  it('returns null when no blobId in response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }));
    expect(await storeOnWalrus(DUMMY_RECEIPT)).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('fetchFromWalrus', () => {
  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    expect(await fetchFromWalrus('xyz')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchFromWalrus('xyz')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns parsed receipt on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(DUMMY_RECEIPT),
    }));
    const result = await fetchFromWalrus('xyz') as Receipt | null;
    expect(result?.receipt_id).toBe('rcpt_test');
    vi.unstubAllGlobals();
  });
});
