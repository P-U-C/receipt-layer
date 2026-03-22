import { describe, it, expect } from 'vitest';
import { rowToReceipt } from '../src/lib/receipt';
import type { ReceiptRow } from '../src/types';

const makeRow = (o: Partial<ReceiptRow> = {}): ReceiptRow => ({
  receipt_id: 'rcpt_001', version: '0.1.0', capability: 'sentiment-analysis',
  provider_agent_id: '28362', provider_address: '0xB1e55EdD3176Ce9C9aF28F15b79e0c0eb8Fe51AA',
  provider_protocol: 'mpp', provider_endpoint: null,
  consumer_agent_id: null, consumer_address: '0x0000000000000000000000000000000000000001', consumer_protocol: 'http',
  spec_hash: null, payment_amount: '10000', payment_asset: 'USDC', payment_rail: 'mpp', payment_chain: 8453, payment_tx_hash: null,
  provider_signature: '0xsig1', consumer_signature: null, output_hash: null, execution_metadata: null,
  status: 'committed', chain_anchor_chain: null, chain_anchor_tx_hash: null, walrus_blob_id: null,
  created_at: '2026-03-22T00:00:00.000Z', delivered_at: null, acknowledged_at: null, ...o,
});

describe('rowToReceipt', () => {
  it('maps provider', () => { const r = rowToReceipt(makeRow()); expect(r.provider.address).toBe('0xB1e55EdD3176Ce9C9aF28F15b79e0c0eb8Fe51AA'); });
  it('maps payment', () => { const r = rowToReceipt(makeRow()); expect(r.payment?.amount).toBe('10000'); expect(r.payment?.chain).toBe(8453); });
  it('null payment when no amount', () => expect(rowToReceipt(makeRow({ payment_amount: null })).payment).toBeNull());
  it('parses execution_metadata', () => {
    const r = rowToReceipt(makeRow({ execution_metadata: JSON.stringify({ model: 'gpt-4' }) }));
    expect(r.execution_metadata?.model).toBe('gpt-4');
  });
  it('null on invalid metadata', () => expect(rowToReceipt(makeRow({ execution_metadata: 'bad' })).execution_metadata).toBeNull());
  it('chain_anchor present', () => {
    const r = rowToReceipt(makeRow({ chain_anchor_tx_hash: '0xtx', chain_anchor_chain: 'base' }));
    expect(r.chain_anchor?.tx_hash).toBe('0xtx');
  });
  it('preserves status', () => expect(rowToReceipt(makeRow({ status: 'acknowledged' })).status).toBe('acknowledged'));
});
