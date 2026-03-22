import { describe, it, expect } from 'vitest';
import type { Receipt, VerifyResult } from '../src/types';

function buildVerifyResult(overrides: Partial<Receipt> = {}): VerifyResult {
  const r: Receipt = {
    receipt_id: 'rcpt_test',
    version: '0.1.0',
    capability: 'test',
    provider: { address: '0xA000000000000000000000000000000000000001', protocol: 'http' },
    consumer: { address: '0xB000000000000000000000000000000000000002', protocol: 'http' },
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
    ...overrides,
  };
  return {
    receipt_id: r.receipt_id,
    status: r.status,
    provider_verified: r.provider_signature !== null,
    consumer_verified: r.consumer_signature !== null,
    walrus_verified: r.walrus_blob_id !== null,
    walrus_url: r.walrus_url,
    chain_anchor: r.chain_anchor,
    receipt: r,
  };
}

describe('VerifyResult shape', () => {
  it('provider_verified false when no signature', () => {
    expect(buildVerifyResult({ provider_signature: null }).provider_verified).toBe(false);
  });

  it('provider_verified true when signature present', () => {
    expect(buildVerifyResult({ provider_signature: '0xsig' }).provider_verified).toBe(true);
  });

  it('consumer_verified false without signature', () => {
    expect(buildVerifyResult({ consumer_signature: null }).consumer_verified).toBe(false);
  });

  it('consumer_verified true when signature present', () => {
    expect(buildVerifyResult({ consumer_signature: '0xsig2' }).consumer_verified).toBe(true);
  });

  it('walrus_verified false when no blob_id', () => {
    expect(buildVerifyResult({ walrus_blob_id: null }).walrus_verified).toBe(false);
  });

  it('walrus_verified true when blob_id present', () => {
    expect(buildVerifyResult({ walrus_blob_id: 'blob123' }).walrus_verified).toBe(true);
  });

  it('walrus_url passes through from receipt', () => {
    const url = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/blob123';
    expect(buildVerifyResult({ walrus_url: url }).walrus_url).toBe(url);
  });

  it('status reflects receipt status', () => {
    expect(buildVerifyResult({ status: 'delivered' }).status).toBe('delivered');
    expect(buildVerifyResult({ status: 'acknowledged' }).status).toBe('acknowledged');
  });
});
